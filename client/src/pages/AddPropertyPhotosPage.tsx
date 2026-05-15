import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadPropertyDraft, savePropertyDraft, type PropertyDraftPhoto } from '../lib/propertyDraft'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic']
const MAX_SIZE_BYTES = 10 * 1024 * 1024

/** Old default placeholder ids – filter these out when loading draft */
const LEGACY_PLACEHOLDER_IDS = new Set(['living-room', 'kitchen', 'bedroom'])

const photoTips = [
  'Include photos of all main rooms',
  'Take photos during the day with good lighting',
  "Show the property's best features",
  'Avoid personal items in photos',
]

export function AddPropertyPhotosPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const draft = loadPropertyDraft()
  const [uploadedPhotos, setUploadedPhotos] = useState<PropertyDraftPhoto[]>(() => {
    const loaded = draft.photos.filter((p) => !LEGACY_PLACEHOLDER_IDS.has(p.id))
    return loaded
  })
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    savePropertyDraft({
      ...loadPropertyDraft(),
      photos: uploadedPhotos,
    })
  }, [uploadedPhotos])

  function removePhoto(id: string) {
    setUploadedPhotos((current) => {
      const photo = current.find((p) => p.id === id)
      if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl)
      const next = current.filter((p) => p.id !== id)
      if (next.length === 0) return []
      return next.map((p, index) => ({ ...p, cover: index === 0 }))
    })
  }

  function processFiles(files: FileList | null) {
    if (!files?.length) return
    setUploadError(null)
    const accepted: PropertyDraftPhoto[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const isAccepted =
        ACCEPTED_TYPES.includes(file.type) ||
        file.type === 'image/heic' ||
        file.name.toLowerCase().endsWith('.heic')
      if (!isAccepted) {
        setUploadError(`${file.name} is not supported. Use JPG, PNG, or HEIC.`)
        continue
      }
      if (file.size > MAX_SIZE_BYTES) {
        setUploadError(`${file.name} is over 10MB.`)
        continue
      }
      const id = `photo-${Date.now()}-${i}`
      accepted.push({
        id,
        label: file.name.replace(/\.[^/.]+$/, '') || `Photo ${uploadedPhotos.length + accepted.length + 1}`,
        cover: uploadedPhotos.length === 0 && accepted.length === 0,
        previewUrl: URL.createObjectURL(file),
        file,
      })
    }
    if (accepted.length > 0) {
      setUploadedPhotos((current) => {
        const next = [...current, ...accepted]
        if (next.some((p) => p.cover)) return next
        return next.map((p, i) => ({ ...p, cover: i === 0 }))
      })
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    processFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function makeCover(id: string) {
    setUploadedPhotos((current) => {
      const selected = current.find((photo) => photo.id === id)
      if (!selected) return current
      const rest = current.filter((photo) => photo.id !== id)
      return [{ ...selected, cover: true }, ...rest.map((photo) => ({ ...photo, cover: false }))]
    })
  }

  useEffect(() => {
    return () => {
      uploadedPhotos.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- revoke on unmount only

  function handleSaveDraft() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-full px-4 py-10">
      <div className="mx-auto max-w-[544px]">
        <Link
          to="/onboarding/property/amenities"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
          <h1 className="text-[2rem] font-medium text-gray-900">Upload Photos</h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">Upload at least 5 photos of your property.</p>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
              <span>Step 4 of 4</span>
              <span>75% Complete</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div className="h-2 w-3/4 rounded-full bg-gray-900" />
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            className="mt-7 cursor-pointer rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 transition-colors hover:border-gray-300 hover:bg-gray-100"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic"
              multiple
              className="hidden"
              onChange={(e) => {
                processFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <div className="mx-auto flex max-w-[270px] flex-col items-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 01 1 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="mt-6 text-[1.35rem] font-medium text-gray-900">Drag and drop photos here</p>
              <p className="mt-2 text-sm text-gray-500">or click to browse your computer</p>

              <button
                type="button"
                className="mt-5 inline-flex gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary/90"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h3l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                Browse Files
              </button>

              <p className="mt-5 text-xs text-gray-500">Supported formats: JPG, PNG, HEIC (Max 10MB each)</p>
              {uploadError ? <p className="mt-3 text-sm text-red-600">{uploadError}</p> : null}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-gray-200 bg-white px-4 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.35rem] font-medium text-gray-900">Uploaded Photos</h2>
              <span className="text-sm text-gray-500">{uploadedPhotos.length} of 5 minimum</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {uploadedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-300"
                >
                  <button
                    type="button"
                    aria-label={`Remove ${photo.label}`}
                    onClick={() => removePhoto(photo.id)}
                    className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white hover:bg-black"
                  >
                    ×
                  </button>
                  <div className="flex h-[136px] items-center justify-center overflow-hidden">
                    {photo.previewUrl ? (
                      <img
                        src={photo.previewUrl}
                        alt={photo.label}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm text-white">{photo.label}</span>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => makeCover(photo.id)}
                      onKeyDown={(e) => e.key === 'Enter' && makeCover(photo.id)}
                      className={`inline-flex cursor-pointer rounded px-2 py-1 text-[11px] ${
                        photo.cover ? 'bg-gray-900 text-white' : 'bg-white/90 text-gray-500'
                      }`}
                    >
                      {photo.cover ? '★ Cover' : 'Make Cover'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl bg-gray-50 px-4 py-4">
              <p className="text-sm font-medium text-gray-900">Photo Tips</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                {photoTips.map((tip) => (
                  <li key={tip}>• {tip}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">
            {uploadedPhotos.length >= 5
              ? 'You have enough photos to continue'
              : `Upload ${5 - uploadedPhotos.length} more photo${5 - uploadedPhotos.length === 1 ? '' : 's'} to continue`}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={() => navigate('/onboarding/property/preview', { state: { photos: uploadedPhotos } })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            Next: Preview Property
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm leading-6 text-gray-700">
              <span className="font-medium text-gray-900">Need help?</span> Make sure your address is accurate as this will be used for tenant searches and background verification.
            </p>
          </div>
        </div>

        {saved ? <p className="mt-4 text-sm text-emerald-600">Draft saved for this browser session.</p> : null}
      </div>
    </div>
  )
}
