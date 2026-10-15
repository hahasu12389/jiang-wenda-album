import { useState, useEffect, type ImgHTMLAttributes } from 'react'

// ============================================================
//  SmartImage：带骨架占位、懒加载、加载失败兜底的图片组件。
//  单张图片失败只显示友好占位，不会让整个页面崩溃。
// ============================================================

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  fallbackEmoji?: string
}

export default function SmartImage({
  src,
  alt,
  fallbackEmoji = '📷',
  className,
  ...rest
}: Props) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  // 切换 src 时（如分页/换图）重置状态
  useEffect(() => {
    setStatus('loading')
  }, [src])

  if (status === 'error') {
    return (
      <div className="img-error" role="img" aria-label={alt}>
        <span className="big">{fallbackEmoji}</span>
        <span>图片暂时走丢了 (´• ω •`)</span>
      </div>
    )
  }

  return (
    <>
      {status === 'loading' && <div className="skeleton">🐸</div>}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={className ? `${className} ${status === 'loaded' ? 'loaded' : ''}` : ''}
        style={status === 'loaded' ? undefined : { opacity: 0 }}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        {...rest}
      />
    </>
  )
}
