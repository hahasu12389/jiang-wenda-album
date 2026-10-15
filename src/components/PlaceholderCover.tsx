// 空相册的默认占位封面（纯 CSS/SVG，绝不出现破损图标）
export default function PlaceholderCover({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="placeholder-cover" role="img" aria-label={`${label} 暂无照片`}>
      <span style={{ filter: 'grayscale(0.2)' }}>{emoji}</span>
    </div>
  )
}
