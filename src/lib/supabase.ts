import { createClient } from '@supabase/supabase-js'

// 只读取前端公开环境变量。缺失时给出明确报错，而不是静默失败。
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // 不直接抛错崩溃，方便在未配置时看到友好提示页（见 ConfigWarning）
  console.warn(
    '[Supabase] 缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY。请复制 .env.example 为 .env 并填写后重启 dev server。'
  )
}

export const isSupabaseConfigured = Boolean(url && anonKey)

// 单例 Supabase 客户端
// - persistSession: 把登录态保存在 localStorage（仅用于“记住登录状态”，不用于共享照片）
// - autoRefreshToken: 自动刷新 access token
// - detectSessionInUrl: 处理邮箱确认 / OAuth 回跳
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
