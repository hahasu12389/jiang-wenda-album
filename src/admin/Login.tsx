import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// 管理员登录页：不提供任何注册入口。
// 管理员账号只能由项目所有者在 Supabase 控制台创建并授权。
export default function Login() {
  const { signIn, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 已经是管理员则直接进入后台（声明式重定向，避免渲染期副作用）
  if (isAdmin) {
    return <Navigate to="/admin/photos" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('请输入邮箱和密码。')
      return
    }
    setSubmitting(true)
    try {
      await signIn(email, password)
      // 登录成功后，AuthContext 会异步校验 is_admin；
      // 稍等一拍再跳转，由 AdminRoute 做最终把关。
      setTimeout(() => navigate('/admin/photos', { replace: true }), 400)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试。')
      setSubmitting(false)
    }
  }

  return (
    <div className="container login-wrap">
      <div className="form-card">
        <h1>🐸 管理员入口</h1>
        <p className="sub">仅限姜闻达本人登录 · 未授权用户无法进入</p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">管理员邮箱</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? '登录中…' : '登录后台'}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center' }}>
          本系统不开放注册。管理员账号需在 Supabase 控制台创建并授权。
        </p>
      </div>
    </div>
  )
}
