import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { PropertyDraftPhoto } from './propertyDraft'
import { preparePropertyPhoto, propertyPhotoError as fileError } from './preparePropertyPhoto'

const BUCKET = 'property-images'
export const MAX_PROPERTY_PHOTOS = 5

function restoredPhotos(photos: PropertyDraftPhoto[]): PropertyDraftPhoto[] {
  return photos.map((photo) => photo.url
    ? { ...photo, uploadStatus: 'complete', uploadProgress: 100 }
    : { ...photo, uploadStatus: 'error', uploadError: 'Upload not completed. Select this photo again to retry.' })
}

type UploadRun = { cancelled: boolean; xhr?: XMLHttpRequest }

export function usePropertyPhotoUploads(
  userId: string | undefined,
  initialPhotos: () => PropertyDraftPhoto[],
  persist: (photos: PropertyDraftPhoto[]) => void,
) {
  const [photos, setPhotoState] = useState(() => restoredPhotos(initialPhotos()))
  const photosRef = useRef(photos)
  const persistRef = useRef(persist)
  persistRef.current = persist
  const runs = useRef(new Map<string, UploadRun>())
  // Avoid decoding several large iPhone photos simultaneously on mobile.
  const preparationQueue = useRef<Promise<unknown>>(Promise.resolve())
  const [error, setError] = useState<string | null>(null)
  const [persistenceError, setPersistenceError] = useState<string | null>(null)

  function setPhotos(
    next: PropertyDraftPhoto[] | ((current: PropertyDraftPhoto[]) => PropertyDraftPhoto[]),
    shouldPersist = true,
  ) {
    const updated = typeof next === 'function' ? next(photosRef.current) : restoredPhotos(next)
    if (typeof next !== 'function') {
      runs.current.forEach((run, id) => {
        if (!updated.some((photo) => photo.id === id)) {
          run.cancelled = true
          run.xhr?.abort()
          runs.current.delete(id)
        }
      })
    }
    photosRef.current = updated
    setPhotoState(updated)
    if (!shouldPersist) return
    try {
      persistRef.current(updated)
      setPersistenceError(null)
    } catch {
      setPersistenceError('Could not save photo links in this browser. Free up browser storage and save again before leaving.')
    }
  }

  function patchPhoto(id: string, patch: Partial<PropertyDraftPhoto>) {
    setPhotos((current) => current.map((photo) => photo.id === id ? { ...photo, ...patch } : photo))
  }

  async function uploadPhoto(id: string, file: File) {
    const validationError = fileError(file)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!userId) {
      setError(`${file.name}: You must be signed in to upload photos.`)
      return
    }
    const previous = runs.current.get(id)
    if (previous) {
      previous.cancelled = true
      previous.xhr?.abort()
    }
    const run: UploadRun = { cancelled: false }
    runs.current.set(id, run)
    patchPhoto(id, { file, uploadStatus: 'uploading', uploadProgress: 0, uploadError: undefined })
    try {
      const preparation = preparationQueue.current.then(() => run.cancelled ? null : preparePropertyPhoto(file))
      preparationQueue.current = preparation.catch(() => undefined)
      const prepared = await preparation
      if (run.cancelled || !prepared) return
      const previousPreview = photosRef.current.find((photo) => photo.id === id)?.previewUrl
      if (previousPreview) URL.revokeObjectURL(previousPreview)
      patchPhoto(id, { previewUrl: URL.createObjectURL(prepared) })
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (run.cancelled) return
      if (sessionError || !data.session || data.session.user.id !== userId) {
        throw new Error('Your session has expired. Sign in again, then retry.')
      }
      const path = `${userId}/${id}.jpg`
      // XHR exposes real byte progress; Supabase's fetch uploader does not.
      // Use the same Storage endpoint, session authorization, and own-folder RLS.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        run.xhr = xhr
        xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`)
        xhr.setRequestHeader('Authorization', `Bearer ${data.session!.access_token}`)
        xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY)
        xhr.setRequestHeader('x-upsert', 'true')
        xhr.timeout = 120000
        xhr.upload.onprogress = (event) => {
          if (!run.cancelled && event.lengthComputable) {
            // 100% is reserved for Storage confirming the completed upload.
            patchPhoto(id, { uploadProgress: Math.min(99, Math.round(event.loaded / event.total * 100)) })
          }
        }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Photo upload failed (${xhr.status}). Please retry.`))
        xhr.onerror = () => reject(new Error('Photo upload failed. Check your connection and retry.'))
        xhr.ontimeout = () => reject(new Error('Photo upload timed out. Please retry.'))
        xhr.onabort = () => reject(new Error('Photo upload interrupted. Please retry.'))
        const body = new FormData()
        body.append('cacheControl', '3600')
        body.append('', prepared)
        xhr.send(body)
      })
      if (run.cancelled) return
      const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path)
      patchPhoto(id, {
        url: publicUrl.publicUrl, file: undefined, uploadStatus: 'complete',
        uploadProgress: 100, uploadError: undefined,
      })
    } catch (uploadError) {
      if (!run.cancelled) {
        patchPhoto(id, {
          uploadStatus: 'error',
          uploadError: `${file.name}: ${uploadError instanceof Error ? uploadError.message : 'Photo upload failed. Please retry.'}`,
        })
      }
    } finally {
      if (runs.current.get(id) === run) runs.current.delete(id)
    }
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    if (!userId) {
      setError(Array.from(files, (file) => `${file.name}: You must be signed in to upload photos.`).join('\n'))
      return
    }
    const accepted: PropertyDraftPhoto[] = []
    const skipped: string[] = []
    for (const file of Array.from(files)) {
      const validationError = fileError(file)
      if (validationError) {
        skipped.push(validationError)
        continue
      }
      if (photosRef.current.length + accepted.length >= MAX_PROPERTY_PHOTOS) {
        skipped.push(`${file.name}: Not added. You can add up to 5 photos; remove a photo first.`)
        continue
      }
      accepted.push({
        id: crypto.randomUUID(),
        label: file.name.replace(/\.[^/.]+$/, '') || 'Property photo',
        cover: photosRef.current.length + accepted.length === 0,
        previewUrl: URL.createObjectURL(file), file,
        uploadStatus: 'uploading', uploadProgress: 0,
      })
    }
    setError(skipped.length ? skipped.join('\n') : null)
    setPhotos((current) => [...current, ...accepted])
    accepted.forEach((photo) => void uploadPhoto(photo.id, photo.file!))
  }

  function removePhoto(id: string) {
    const run = runs.current.get(id)
    if (run) {
      run.cancelled = true
      run.xhr?.abort()
      runs.current.delete(id)
    }
    const photo = photosRef.current.find((item) => item.id === id)
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl)
    setPhotos((current) => current.filter((item) => item.id !== id).map((item, i) => ({ ...item, cover: i === 0 })))
  }

  function retryPhoto(id: string, replacement?: File) {
    const photo = photosRef.current.find((item) => item.id === id)
    const file = replacement ?? photo?.file
    if (!photo || !file) return
    if (replacement && !fileError(replacement)) {
      if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl)
      patchPhoto(id, { previewUrl: URL.createObjectURL(replacement) })
    }
    void uploadPhoto(id, file)
  }

  const incomplete = photos.some((photo) => !photo.url)
  const uploading = photos.some((photo) => photo.uploadStatus === 'uploading')
  useEffect(() => {
    if (!uploading) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])

  useEffect(() => () => {
    runs.current.forEach((run) => { run.cancelled = true; run.xhr?.abort() })
    runs.current.clear()
    photosRef.current.forEach((photo) => photo.previewUrl && URL.revokeObjectURL(photo.previewUrl))
  }, [])

  return {
    photos, setPhotos, addFiles, removePhoto, retryPhoto, incomplete, uploading,
    error: [persistenceError, error].filter(Boolean).join('\n') || null,
    persistPhotos: () => {
      setPhotos((current) => current)
      // Persistence is synchronous; callers can stop rather than claim success.
      try { persistRef.current(photosRef.current); return true } catch { return false }
    },
  }
}
