import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App'
import Home from './routes/Home'
import Project from './routes/Project'
import { ErrorBoundary } from './components/ErrorBoundary'

const router = createBrowserRouter([
  {
    path: '/', 
    element: <App />, 
    children: [
      { index: true, element: <Home /> },
      { path: 'project/:id', element: <Project /> }
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>
)

// Service Worker handling: unregister in dev, register in production
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Unregister in development to prevent caching issues
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister()
        console.log('Service Worker unregistered (dev mode)')
      }
    })
  } else {
    // Register in production for offline functionality
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.error('Service Worker registration failed:', err))
  }
}
