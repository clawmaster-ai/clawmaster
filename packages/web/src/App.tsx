import { Suspense, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { SetupWizard } from './modules/setup'
import { LoadingState } from './shared/components/LoadingState'
import { registeredModules } from './modules/registry'
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

function hasAnyDemoParam(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  const demo = params.get('demo')
  // demo=install 走安装向导 demo，其他 demo 值直接跳过向导进入主界面
  return !!demo && demo !== 'install'
}

function App() {
  const [appReady, setAppReady] = useState(hasAnyDemoParam)

  if (!appReady) {
    return <SetupWizard onComplete={() => setAppReady(true)} />
  }

  return (
    <Layout>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          {/* 自动注册的模块路由 */}
          {registeredModules.map((mod) => (
            <Route key={mod.id} path={mod.route.path} element={<mod.route.component />} />
          ))}
          {/* 旧页面路由（第二周迁移到模块后移除） */}
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
      </Suspense>
    </Layout>
  )
}

export default App
