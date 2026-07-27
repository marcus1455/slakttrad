import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AuthMenu } from './components/AuthMenu'
import { LoadingScreen } from './components/LoadingScreen'
import { useAuth } from './lib/auth'
import { createNewFamily } from './lib/storage'
import './App.css'

/** `/` creates a new empty tree when signed in; otherwise prompts for login. */
export function NewTreeRedirect() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false
    ;(async () => {
      try {
        const loaded = await createNewFamily()
        if (cancelled) return
        navigate(`/trad/${loaded.meta.slug}`, { replace: true })
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Kunde inte skapa träd')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate, user, loading])

  if (loading) {
    return <LoadingScreen title="Släktträd" message="Laddar" />
  }

  if (!user) {
    return (
      <div className="app app--state app--auth-gate">
        <p className="app__brand">Släktträd</p>
        <h1>Skapa ditt träd</h1>
        <p className="app__hint">
          Logga in med e-post för att skapa ett nytt släktträd. Befintliga träd
          (t.ex. Davidsson) går fortfarande att öppna via sin länk.
        </p>
        <div className="app__auth-gate-actions">
          <AuthMenu showLabel />
          <a className="app__tool" href="/trad/davidsson">
            Öppna Davidsson
          </a>
        </div>
        {error ? <p className="app__hint app__hint--error">{error}</p> : null}
      </div>
    )
  }

  if (error) {
    return (
      <div className="app app--state">
        <p>{error}</p>
        <p>
          <a href="/trad/davidsson">Öppna Davidsson-trädet</a>
        </p>
      </div>
    )
  }

  return <LoadingScreen title="Släktträd" message="Skapar nytt träd" />
}

/** Unknown routes → start a new board. */
export function FallbackToNew() {
  return <Navigate to="/" replace />
}
