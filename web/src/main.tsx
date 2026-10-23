import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import { AuthProvider } from './lib/auth'
import { CartProvider } from './lib/cart'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
