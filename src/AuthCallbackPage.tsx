import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingScreen } from './components/LoadingScreen'
import { supabase } from './lib/supabase'

function isPasswordRecoveryCallback(): boolean {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return (
    search.get('type') === 'recovery' ||
    hash.get('type') === 'recovery' ||
    sessionStorage.getItem('auth_recovery') === '1'
  )
}

/** Completes magic-link / OAuth / password-recovery and returns to the app. */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem('auth_recovery', '1')
      }
    })

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

        if (isPasswordRecoveryCallback()) {
          sessionStorage.removeItem('auth_recovery')
          navigate('/aterstall-losenord', { replace: true })
          return
        }

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
      sub.subscription.unsubscribe()
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
