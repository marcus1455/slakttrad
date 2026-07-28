import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingScreen } from './components/LoadingScreen'
import { supabase } from './lib/supabase'

/** Completes magic-link login and returns to home / previous tree. */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Handles both PKCE (?code=) and implicit (#access_token) callbacks
        const url = window.location.href
        if (url.includes('code=')) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(url)
          if (exchangeError) throw exchangeError
        } else {
          const { error: sessionError } = await supabase.auth.getSession()
          if (sessionError) throw sessionError
        }
        if (cancelled) return
        const next = sessionStorage.getItem('auth_next') ?? '/'
        sessionStorage.removeItem('auth_next')
        navigate(next, { replace: true })
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Inloggningen misslyckades')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (error) {
    return (
      <div className="app app--state">
        <p>{error}</p>
        <p>
          <a href="/">Till startsidan</a>
        </p>
      </div>
    )
  }

  return <LoadingScreen title="Släktträd" message="Loggar in" />
}
