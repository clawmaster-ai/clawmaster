import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { SetupWizard } from './modules/setup'
import Dashboard from './pages/Dashboard'
import Gateway from './pages/Gateway'
import Channels from './pages/Channels'
import Models from './pages/Models'
import Skills from './pages/Skills'
import Agents from './pages/Agents'
import Config from './pages/Config'
import Docs from './pages/Docs'
import Logs from './pages/Logs'
import Settings from './pages/Settings'

function App() {
  const [appReady, setAppReady] = useState(false)

  if (!appReady) {
    return <SetupWizard onComplete={() => setAppReady(true)} />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/gateway" element={<Gateway />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/models" element={<Models />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/config" element={<Config />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default App
