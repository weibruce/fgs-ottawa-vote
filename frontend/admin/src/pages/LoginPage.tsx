/**
 * 登入頁
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { setToken } from '../api/client'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!username.trim() || !password || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await login(username.trim(), password)
      setToken(res.access_token)
      localStorage.setItem('admin_username', res.username || username.trim())
      navigate('/')
    } catch {
      setError('帳號或密碼錯誤')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
          <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-2xl mx-auto">
            佛
          </div>
          <h1 className="text-xl font-bold text-ink text-center mt-4">佛光山投票系統</h1>
          <p className="text-sm text-gray text-center mt-1">後台管理 · 請輸入管理員帳號</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-ink mb-1">帳號</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full h-11 rounded-lg bg-light-bg border border-border px-4 text-base outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-ink mb-1">密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 rounded-lg bg-light-bg border border-border px-4 text-base outline-none focus:border-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!username.trim() || !password || loading}
              className="w-full h-12 rounded-xl bg-primary text-white font-bold text-base disabled:opacity-50 hover:bg-primary-hover transition-colors"
            >
              {loading ? '登入中...' : '登入'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
