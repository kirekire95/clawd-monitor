import { ChevronLeft, ChevronRight, Shell } from 'lucide-react'
import './Sidebar.css'

interface Tab {
  readonly id: string
  readonly label: string
  readonly icon: React.ComponentType<{ className?: string }>
}

interface SidebarProps {
  tabs: readonly Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({
  tabs,
  activeTab,
  onTabChange,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileClose
}: SidebarProps): React.JSX.Element {
  return (
    <>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <Shell className="logo-icon" />
            {!collapsed && <span className="logo-text">Clawd Monitor</span>}
          </div>
          <button
            className="collapse-btn"
            onClick={() => onCollapsedChange(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  onTabChange(tab.id)
                  onMobileClose()
                }}
                title={collapsed ? tab.label : undefined}
              >
                <Icon className="nav-icon" />
                {!collapsed && <span className="nav-label">{tab.label}</span>}
                {activeTab === tab.id && <span className="nav-indicator" />}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="gateway-status-mini">
            <div className={`status-dot-mini ${activeTab === 'dashboard' ? 'pulse' : ''}`}></div>
            {!collapsed && <span className="status-text-mini">Gateway Ready</span>}
          </div>
        </div>
      </aside>
    </>
  )
}
