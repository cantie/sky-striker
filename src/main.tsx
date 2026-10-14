import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useAccount } from './store/account'

// Restore a session / finish a Keycloak redirect; guests just carry on offline.
// Loopback co-op waits for that so a GUEST_COOP=false server can refuse a guest first.
const q = new URLSearchParams(location.search)
void useAccount.getState().init().then(() => {
  if (q.get('coop') === 'loopback') void import('./net/coop/active').then((m) => m.startLoopbackCoop(q))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
