import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthMenu } from './components/AuthMenu'
import { LoadingScreen } from './components/LoadingScreen'
import { useAuth } from './lib/auth'
import { createNewFamily } from './lib/storage'
import './App.css'

/** `/` creates a new empty tree when signed in; otherwise offers login or guest. */
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
        <h1>Välkommen</h1>
        <p className="app__hint">
          Logga in för att skapa och spara egna träd i molnet, eller fortsätt
          som gäst med ett tomt träd i den här webbläsaren.
        </p>
        <div className="app__auth-gate-choices">
          <div className="app__auth-gate-choice">
            <p className="app__auth-gate-choice-title">Har du ett konto?</p>
            <p className="app__auth-gate-choice-text">
              Skapa nya träd, bjud in familjen och spara ändringar.
            </p>
            <AuthMenu showLabel />
          </div>
          <div className="app__auth-gate-choice app__auth-gate-choice--guest">
            <p className="app__auth-gate-choice-title">Fortsätt som gäst</p>
            <p className="app__auth-gate-choice-text">
              Börja med ett tomt träd här. Det sparas i den här sessionen tills
              du anger e-post och sparar det på ett konto. Familjeträd som
              Davidsson öppnas via delningslänk.
            </p>
            <Link className="app__tool app__tool--primary" to="/gast">
              Fortsätt som gäst
            </Link>
          </div>
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
          <Link to="/gast">Fortsätt som gäst</Link>
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
