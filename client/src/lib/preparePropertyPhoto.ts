export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export const PROPERTY_PHOTO_ACCEPT = '.jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif,image/heic-sequence,image/heif-sequence'

export function isHeif(file: File): boolean {
  return /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf](-sequence)?$/i.test(file.type)
}

export function propertyPhotoError(file: File): string | null {
  return isHeif(file) || ['image/jpeg', 'image/png'].includes(file.type) || /\.(jpe?g|png)$/i.test(file.name)
    ? null : `${file.name}: unsupported format. Use JPG, PNG, HEIC, or HEIF.`
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode this photo. It may be damaged or use an unsupported codec.')) }
    image.src = url
  })
}

/** Decode locally, preserve orientation via browser decoding, and upload only JPEG bytes. */
export async function preparePropertyPhoto(file: File): Promise<File> {
  const invalid = propertyPhotoError(file)
  if (invalid) throw new Error(invalid)
  let image: HTMLImageElement
  try {
    // Native decoding supports more recent iPhone codecs on some browsers.
    image = await loadImage(file)
  } catch (error) {
    if (!isHeif(file)) throw error
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 })
    // A property photo represents one still image, not every frame of a burst.
    const still = Array.isArray(converted) ? converted[0] : converted
    if (!still) throw new Error('HEIC/HEIF conversion returned no image.')
    image = await loadImage(still)
  }
  const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight))
  if (!Number.isFinite(scale) || !image.naturalWidth || !image.naturalHeight) {
    throw new Error('This photo has invalid dimensions.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  try {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser cannot resize photos.')
    // JPEG has no alpha channel; flatten transparent PNG backgrounds to white.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not compress this photo.')), 'image/jpeg', 0.85)
    })
    if (jpeg.size > MAX_PHOTO_BYTES) {
      throw new Error('Still exceeds 10 MB after resizing and compression. Choose a smaller photo.')
    }
    return new File([jpeg], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' })
  } finally {
    canvas.width = 0
    canvas.height = 0
    image.src = ''
  }
}
