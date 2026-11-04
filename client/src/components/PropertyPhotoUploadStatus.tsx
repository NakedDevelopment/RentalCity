import type { PropertyDraftPhoto } from '../lib/propertyDraft'
import { PROPERTY_PHOTO_ACCEPT } from '../lib/preparePropertyPhoto'

export function PropertyPhotoUploadStatus({
  photo, onRetry,
}: {
  photo: PropertyDraftPhoto
  onRetry: (id: string, file?: File) => void
}) {
  if (photo.url) return <p className="bg-white px-2 py-1 text-xs text-green-700">Uploaded</p>
  if (photo.uploadStatus === 'uploading') {
    return (
      <div className="bg-white px-2 py-2" role="status">
        <p className="text-xs text-gray-700">{photo.uploadProgress ? `Uploading ${photo.uploadProgress}%` : 'Preparing / uploading photo…'}</p>
        <progress className="mt-1 h-2 w-full" max={100} value={photo.uploadProgress ?? 0} aria-label={`Uploading ${photo.label}`} />
      </div>
    )
  }
  return (
    <div className="bg-white px-2 py-2">
      <p className="text-xs text-red-700" role="alert">{photo.uploadError ?? 'Upload not completed.'}</p>
      {photo.file ? (
        <button type="button" onClick={() => onRetry(photo.id)} className="mt-1 text-xs font-medium text-gray-900 underline">
          Retry upload
        </button>
      ) : (
        <label className="mt-1 inline-block cursor-pointer text-xs font-medium text-gray-900 underline">
          Select photo to retry
          <input
            type="file"
            accept={PROPERTY_PHOTO_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onRetry(photo.id, file)
              event.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
