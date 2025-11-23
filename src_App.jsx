import React from 'react'
import CosmicClock3D from './src_components_CosmicClock3D.jsx'

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CosmicClock3D initialTimeZone="local" />
    </div>
  )
}
