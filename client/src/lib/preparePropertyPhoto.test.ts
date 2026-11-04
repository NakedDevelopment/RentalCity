import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isHeif, propertyPhotoError, preparePropertyPhoto, MAX_PHOTO_BYTES } from './preparePropertyPhoto'

test('accepts HEIF/HEIC by extension or MIME, including blank MIME and large inputs', () => {
  for (const [name, type] of [
    ['IPHONE.HEIF', ''], ['photo.heic', 'application/octet-stream'],
    ['photo', 'image/heif'], ['photo', 'image/heic-sequence'],
  ]) {
    const file = new File(['photo'], name, { type })
    assert.equal(isHeif(file), true)
    assert.equal(propertyPhotoError(file), null)
  }
  assert.equal(propertyPhotoError(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], 'large.jpg')), null)
  assert.match(propertyPhotoError(new File(['bad'], 'rejected.gif'))!, /rejected.gif.*unsupported/)
})

test('browser pipeline resizes, encodes JPEG at 0.85, checks final size, and releases resources', async () => {
  let width = 6000
  let height = 4000
  let outputSize = 100
  let decodeFails = false
  const revoked: string[] = []
  let encoding: unknown[] = []
  const context = { fillStyle: '', fillRect() {}, drawImage() {} }
  const canvas = {
    width: 0, height: 0, getContext: () => context,
    toBlob(callback: (blob: Blob) => void, mime: string, quality: number) {
      encoding = [mime, quality, canvas.width, canvas.height]
      callback(new Blob([new Uint8Array(outputSize)], { type: mime }))
    },
  }
  const originalImage = globalThis.Image
  const originalDocument = globalThis.document
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  Object.assign(globalThis, {
    Image: class {
      naturalWidth = width
      naturalHeight = height
      onload = () => {}
      onerror = () => {}
      set src(value: string) { if (value) queueMicrotask(() => decodeFails ? this.onerror() : this.onload()) }
    },
    document: { createElement: () => canvas },
  })
  URL.createObjectURL = () => 'blob:test'
  URL.revokeObjectURL = (url) => { revoked.push(url) }
  try {
    const input = new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], 'large.png', { type: 'image/png' })
    const output = await preparePropertyPhoto(input)
    assert.equal(output.name, 'large.jpg')
    assert.equal(output.type, 'image/jpeg')
    assert.deepEqual(encoding, ['image/jpeg', 0.85, 2560, 1707])
    assert.equal(context.fillStyle, '#ffffff')
    assert.equal(canvas.width, 0)
    assert.equal(revoked.length, 1)
    width = 400; height = 800
    await preparePropertyPhoto(new File(['photo'], 'native.HEIF'))
    assert.deepEqual(encoding, ['image/jpeg', 0.85, 400, 800])
    outputSize = MAX_PHOTO_BYTES + 1
    await assert.rejects(preparePropertyPhoto(input), /Still exceeds 10 MB after resizing and compression/)
    assert.equal(canvas.width, 0)
    decodeFails = true
    await assert.rejects(preparePropertyPhoto(input), /Could not decode/)
    await assert.rejects(preparePropertyPhoto(new File(['gif'], 'bad.gif')), /bad.gif.*unsupported/)
  } finally {
    Object.assign(globalThis, { Image: originalImage, document: originalDocument })
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  }
})
