import { useEffect, useCallback } from 'react'
import type { PhotoWithUrls } from '../lib/types'

// ============================================================
//  灯箱：大图预览、上一张/下一张、键盘方向键、关闭。
//  关闭后由父组件保持滚动位置（不重置列表）。
// ============================================================

interface Props {
  photos: PhotoWithUrls[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

export default function Lightbox({ photos, index, onClose, onNavigate }: Props) {
  const total = photos.length
  const prev = useCallback(() => onNavigate((index - 1 + total) % total), [index, total, onNavigate])
  const next = useCallback(() => onNavigate((index + 1) % total), [index, total, onNavigate])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    // 打开时锁定背景滚动
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
  }, [onClose, prev, next])

  if (total === 0) return null
  const photo = photos[index]
  if (!photo) return null

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <span className="lb-counter">
        {index + 1} / {total}
      </span>
      <button
        className="lb-btn lb-close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="关闭"
      >
        ✕
      </button>
      {total > 1 && (
        <>
          <button
            className="lb-btn lb-prev"
            onClick={(e) => {
              e.stopPropagation()
              prev()
            }}
            aria-label="上一张"
          >
            ‹
          </button>
          <button
            className="lb-btn lb-next"
            onClick={(e) => {
              e.stopPropagation()
              next()
            }}
            aria-label="下一张"
          >
            ›
          </button>
        </>
      )}

      <div className="stage" onClick={(e) => e.stopPropagation()}>
        <img src={photo.url} alt={photo.title || '照片'} />
      </div>
      <div className="info" onClick={(e) => e.stopPropagation()}>
        {photo.title && <div>{photo.title}</div>}
        {photo.description && <div style={{ fontSize: 13, opacity: 0.75 }}>{photo.description}</div>}
        {photo.photo_date && <div className="date">{fmtDate(photo.photo_date)}</div>}
      </div>
    </div>
  )
}
