import { RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import { registerServiceWorker } from './pwa'
import { getRouter } from './router'

const router = getRouter()

const rootElement = document.getElementById('app')
if (!rootElement) throw new Error('index.html is missing the #app element')

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(<RouterProvider router={router} />)
}

registerServiceWorker()
