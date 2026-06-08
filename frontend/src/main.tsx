import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth-store'
import { PlanProvider } from './lib/plan-store'
import { WbStoreProvider } from './lib/wb-store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlanProvider>
          <WbStoreProvider>
            <App />
          </WbStoreProvider>
        </PlanProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
