import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useAccount } from './store/account'

// Restore a session / finish a Keycloak redirect; guests just carry on offline
void useAccount.getState().init()

// Co-op test drive against the in-browser server + bot wingmate
const q = new URLSearchParams(location.search)
if (q.get('coop') === 'loopback') void import('./net/coop/active').then((m) => m.startLoopbackCoop(q))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
