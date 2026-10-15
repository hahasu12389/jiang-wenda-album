import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// ============================================================
//  认证上下文。
//  管理员身份判定：已登录 + profiles.is_admin = true。
//  is_admin 只能由拥有管理员权限的账号通过数据库变更（或 SQL 初始化），
//  客户端没有任何接口可以把自己设为管理员（由 RLS 保证）。
// ============================================================

interface AuthState {
  session: Session | null
  user: User | null
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // 查询当前用户是否在 profiles 表中且 is_admin = true
    async function checkAdmin(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .maybeSingle()
      if (mounted) setIsAdmin(Boolean(data?.is_admin))
    }

    // 初始会话
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return
      setSession(s)
      if (s?.user) checkAdmin(s.user.id)
      setLoading(false)
    })

    // 监听登录 / 登出 / token 刷新
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s)
      if (s?.user) {
        checkAdmin(s.user.id)
      } else {
        setIsAdmin(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) {
      // 给出清晰、友好的中文提示
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('邮箱或密码错误，请检查后重试。')
      }
      throw new Error(error.message)
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, isAdmin, loading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
