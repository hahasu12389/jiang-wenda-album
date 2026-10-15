// 环境变量未配置时的友好提示页（避免直接白屏）
export default function ConfigWarning() {
  return (
    <div className="config-warning">
      <h2>🐸 还没有配置 Supabase 连接</h2>
      <p>网站需要连接 Supabase 云端数据库和存储才能显示照片。请按以下步骤操作：</p>
      <ol style={{ lineHeight: 2, paddingLeft: 20 }}>
        <li>
          在项目根目录复制 <code>.env.example</code> 并命名为 <code>.env</code>
        </li>
        <li>
          填入 <code>VITE_SUPABASE_URL</code> 和 <code>VITE_SUPABASE_ANON_KEY</code>
          （在 Supabase 控制台 Project Settings → API 获取）
        </li>
        <li>
          在 Supabase SQL Editor 执行 <code>supabase/schema.sql</code>
        </li>
        <li>
          重启开发服务器：<code>npm run dev</code>
        </li>
      </ol>
      <p className="hint" style={{ color: '#6b655a', fontSize: 14 }}>
        详细步骤见项目根目录 <code>README.md</code> 的部署教程。
      </p>
    </div>
  )
}
