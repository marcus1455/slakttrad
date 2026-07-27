import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import { AccountPage } from './AccountPage'
import TreeApp from './App'
import { AuthCallbackPage } from './AuthCallbackPage'
import { FallbackToNew, NewTreeRedirect } from './NewTreeRedirect'
import { AuthProvider } from './lib/auth'
import { DEFAULT_TREE_SLUG } from './lib/supabase'

function EditTreePage() {
  const { slug = DEFAULT_TREE_SLUG } = useParams()
  return <TreeApp mode="edit" slug={slug} />
}

function ShareTreePage() {
  const { token = '' } = useParams()
  return <TreeApp mode="view" shareToken={token} />
}

export function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<NewTreeRedirect />} />
          <Route path="/konto" element={<AccountPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/trad/:slug" element={<EditTreePage />} />
          <Route path="/dela/:token" element={<ShareTreePage />} />
          <Route path="*" element={<FallbackToNew />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
