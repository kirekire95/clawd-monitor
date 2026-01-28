import { useState, useEffect, useCallback, useMemo } from 'react'
import { Activity, Clock, MessageSquare, Sunrise, LayoutDashboard, X, Menu, Sparkles } from 'lucide-react'
import './App.css'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import FilteredEvents from './components/FilteredEvents'
import CronJobs from './components/CronJobs'
import SendMessage from './components/SendMessage'
import BriefingViewer from './components/BriefingViewer'
import Skills from './components/Skills'
import ErrorBoundary from './components/ErrorBoundary'

interface GatewayStatus {
  connected: boolean
  url: string
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'events', label: 'Events', icon: Activity },
  { id: 'cron', label: 'Cron Jobs', icon: Clock },
  { id: 'message', label: 'Send Message', icon: MessageSquare },
  { id: 'briefing', label: 'Briefing', icon: Sunrise }
] as const

type TabId = typeof TABS[number]['id']

function App(): React.JSX.Element {
  const [status, setStatus] = useState<GatewayStatus>({ connected: false, url: 'ws://127.0.0.1:18789' })
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const currentTab = useMemo(() => TABS.find((t) => t.id === activeTab) || TABS[0], [activeTab])

  const handleConnect = useCallback(() => {
    window.api.gateway.connect()
  }, [])

  const handleDisconnect = useCallback(() => {
    window.api.gateway.disconnect()
  }, [])

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId as TabId)
    setMobileMenuOpen(false)
  }, [])

  const handleSidebarCollapse = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
  }, [])

  const handleMobileClose = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  const handleMobileToggle = useCallback(() => {
    setMobileMenuOpen((prev) => !prev)
  }, [])

  useEffect(() => {
    let mounted = true

    const loadStatus = async () => {
      try {
        const result = await window.api.gateway.status()
        if (mounted) {
          setStatus(result)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Failed to load gateway status:', error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadStatus()

    const unsubscribe = window.api.gateway.onStatusChange((newStatus) => {
      if (mounted) {
        setStatus(newStatus)
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  return (
    <div className="app">
      <Sidebar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleSidebarCollapse}
        mobileOpen={mobileMenuOpen}
        onMobileClose={handleMobileClose}
      />

      <div className={`main-content ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <header className="header">
          <div className="header-left">
            <button
              className="menu-toggle"
              onClick={handleMobileToggle}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
            <div className="header-title">
              <currentTab.icon className="tab-icon" />
              <h1>{currentTab.label}</h1>
            </div>
          </div>

          <div className="header-right">
            {isLoading ? (
              <div className="status-badge">Loading...</div>
            ) : (
              <div className={`status-badge ${status.connected ? 'connected' : 'disconnected'}`}>
                <span className={`status-dot ${status.connected ? 'pulse' : ''}`}></span>
                <span className="status-text">{status.connected ? 'Connected' : 'Disconnected'}</span>
              </div>
            )}
            {!status.connected ? (
              <button className="btn btn-primary btn-sm" onClick={handleConnect} disabled={isLoading}>
                Connect
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={handleDisconnect}>
                Disconnect
              </button>
            )}
          </div>
        </header>

        <main className="content">
          <ErrorBoundary>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'skills' && <Skills />}
            {activeTab === 'events' && <FilteredEvents />}
            {activeTab === 'cron' && <CronJobs />}
            {activeTab === 'message' && <SendMessage />}
            {activeTab === 'briefing' && <BriefingViewer />}
          </ErrorBoundary>
        </main>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={handleMobileClose} />
      )}
    </div>
  )
}

export default App
