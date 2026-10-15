import { useState } from 'react'
import type { PhotoWithUrls } from '../lib/types'
import SmartImage from './SmartImage'
import Lightbox from './Lightbox'

// 杂志错落网格：根据宽高比决定单元格尺寸，整洁且不破坏节奏
function spanClass(photo: PhotoWithUrls, i: number): string {
  const ratio = photo.width && photo.height ? photo.width / photo.height : 0.75
  if (ratio > 1.25) return 'wide'
  if (ratio < 0.82) return 'tall'
  // 偶尔让第 6 张变宽，制造节奏
  if (i % 7 === 6 && ratio >= 0.9) return 'wide'
  return ''
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('zh-CN')
  } catch {
    return ''
  }
}

export default function PhotoGrid({ photos }: { photos: PhotoWithUrls[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <>
      <div className="photo-grid">
        {photos.map((photo, i) => (
          <figure
            key={photo.id}
            className={`photo-cell ${spanClass(photo, i)}`}
            onClick={() => setLightboxIndex(i)}
            style={{ margin: 0 }}
          >
            <SmartImage
              src={photo.thumbUrl}
              alt={photo.title || '照片'}
              fallbackEmoji="🖼️"
            />
            {(photo.title || photo.photo_date) && (
              <figcaption className="cap">
                {photo.title}
                {photo.photo_date && <div style={{ opacity: 0.75 }}>{fmtDate(photo.photo_date)}</div>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  )
}
