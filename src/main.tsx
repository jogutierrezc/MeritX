import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SpacetimeProvider } from './context/SpacetimeContext.tsx'

createRoot(document.getElementById('root')!).render(
  <SpacetimeProvider>
    <App />
  </SpacetimeProvider>,
)
