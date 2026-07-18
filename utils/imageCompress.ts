const MAX_EDGE = 2560
const TARGET_QUALITY = 0.92
const MIN_QUALITY = 0.75
/** data URL 长度上限（仅作压缩中间态） */
const MAX_DATA_URL_LENGTH = 5_000_000

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = src
  })
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality)
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * 将本地图片压缩为 JPEG data URL（上传前压缩用）。
 */
export async function fileToWallpaperDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('图片过大（请小于 25MB）')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法处理图片')
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    let quality = TARGET_QUALITY
    let dataUrl = canvasToJpegDataUrl(canvas, quality)
    while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > MIN_QUALITY) {
      quality -= 0.08
      dataUrl = canvasToJpegDataUrl(canvas, quality)
    }
    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      throw new Error('压缩后仍过大，请换一张更小的图片')
    }
    return dataUrl
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** 压缩后转为 Blob，便于 FormData 上传图床 */
export async function fileToWallpaperBlob(file: File): Promise<Blob> {
  const dataUrl = await fileToWallpaperDataUrl(file)
  return dataUrlToBlob(dataUrl)
}
