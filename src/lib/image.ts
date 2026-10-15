import { UPLOAD_LIMITS } from '../config/site'

// ============================================================
//  客户端图片处理：
//   - 校验类型 / 大小
//   - 使用 Canvas 压缩大图、生成缩略图（原图不直接用于网格）
//   - 生成安全、唯一的文件命名，避免重名覆盖
// ============================================================

export interface ProcessedImage {
  original: Blob // 压缩后的大图（用于灯箱）
  thumb: Blob // 网格缩略图
  width: number
  height: number
  ext: string
}

export function validateFile(file: File): string | null {
  if (!UPLOAD_LIMITS.allowedTypes.includes(file.type)) {
    return `不支持的文件类型：${file.name}（仅支持 JPG / PNG / WebP / GIF）`
  }
  if (file.size > UPLOAD_LIMITS.maxFileSize) {
    return `图片过大：${file.name}（单张上限 ${UPLOAD_LIMITS.maxFileSize / 1024 / 1024}MB）`
  }
  return null
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败，文件可能已损坏'))
    }
    img.src = url
  })
}

function drawToCanvas(img: HTMLImageElement, maxEdge: number): HTMLCanvasElement {
  let { width, height } = img
  if (width > maxEdge || height > maxEdge) {
    if (width >= height) {
      height = Math.round((height * maxEdge) / width)
      width = maxEdge
    } else {
      width = Math.round((width * maxEdge) / height)
      height = maxEdge
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建图片处理画布（浏览器不支持 Canvas）')
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))),
      type,
      quality
    )
  })
}

// GIF 直接保留原文件（Canvas 压缩会丢动画），不做压缩
export async function processImage(file: File): Promise<ProcessedImage> {
  const error = validateFile(file)
  if (error) throw new Error(error)

  const isGif = file.type === 'image/gif'
  const outputType = isGif ? 'image/gif' : 'image/jpeg'
  const ext = isGif ? 'gif' : 'jpg'

  if (isGif) {
    // GIF：原图与缩略图都用原文件（网格可接受），尺寸信息无法稳定获取
    return {
      original: file,
      thumb: file,
      width: 0,
      height: 0,
      ext,
    }
  }

  const img = await loadImage(file)
  const largeCanvas = drawToCanvas(img, UPLOAD_LIMITS.largeSize)
  const thumbCanvas = drawToCanvas(img, UPLOAD_LIMITS.thumbSize)

  const original = await canvasToBlob(largeCanvas, outputType, UPLOAD_LIMITS.quality)
  const thumb = await canvasToBlob(thumbCanvas, outputType, UPLOAD_LIMITS.quality)

  return {
    original,
    thumb,
    width: largeCanvas.width,
    height: largeCanvas.height,
    ext,
  }
}

// 生成安全唯一文件名：时间戳 + 随机串，去掉所有特殊字符，杜绝覆盖与路径穿越
export function safeFileName(ext: string, prefix = 'full'): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 10)
  const base = `${yyyy}${mm}${dd}-${Date.now()}-${rand}`
  return `${prefix}/${base}.${ext}`
}

// 大图路径 -> 缩略图路径（约定命名）
export function thumbPathOf(storagePath: string): string {
  // storagePath 形如 "full/20261014-xxx.jpg"
  return storagePath.replace(/^full\//, 'thumb/')
}
