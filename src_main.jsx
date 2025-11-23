import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './src_App.jsx'
import './src_styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
