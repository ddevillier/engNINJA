
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App'
import Home from './routes/Home'
import Project from './routes/Project'

const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <Home /> },
    { path: 'project/:id', element: <Project /> }
  ]}
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)

// Register a simple service worker to enable offline‑first behaviour
// See MDN cache‑first strategy documentation: if a response exists in the cache
// it is returned, otherwise the network is used and the result is cached
//【941111253573582†L275-L339】
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('service worker registration failed', err)
    })
  })
}
