import { useEffect, useState, useCallback, useRef } from 'react'
import { Activity, Clock, Send, Sunrise, TrendingUp, Zap, AlertCircle, CheckCircle } from 'lucide-react'
import './Dashboard.css'
import LoadingSkeleton from './LoadingSkeleton'

interface CronJob {
  id: string
  name: string
  enabled: boolean
  state: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    status?: string
  }
}

interface StatCard {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  trend?: string
  color: 'orange' | 'blue' | 'green' | 'purple'
}

export default function Dashboard(): React.JSX.Element {
  const [events, setEvents] = useState<unknown[]>([])
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isLoadingRef = useRef(false)

  // Memoize loadData with lock to prevent stacking
  const loadData = useCallback(async () => {
    if (isLoadingRef.current) return // Skip if already loading
    isLoadingRef.current = true

    try {
      const [, eventsResult, cronResult] = await Promise.all([
        window.api.gateway.status(),
        window.api.gateway.events(),
        window.api.cron.status()
      ])
      if (Array.isArray(eventsResult)) {
        setEvents(eventsResult.slice(0, 100))
      }
      if (cronResult.success && Array.isArray(cronResult.jobs)) {
        setCronJobs(cronResult.jobs as CronJob[])
      }
      setError(null)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [])

  // Proper cleanup with mounted flag
  useEffect(() => {
    let mounted = true

    loadData()

    const interval = setInterval(() => {
      if (mounted) {
        loadData()
      }
    }, 10000) // Increased from 5s to 10s

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [loadData])

  const stats: StatCard[] = [
    {
      title: 'Events (24h)',
      value: events.length,
      icon: Activity,
      color: 'blue',
      trend: '+12%'
    },
    {
      title: 'Active Jobs',
      value: cronJobs.filter((j) => j.enabled).length,
      icon: Clock,
      color: 'purple'
    },
    {
      title: 'Messages Sent',
      value: '0',
      icon: Send,
      color: 'green',
      trend: 'Today'
    },
    {
      title: 'Briefings',
      value: events.filter((e: any) => e?.type?.includes('morning')).length,
      icon: Sunrise,
      color: 'orange',
      trend: 'This week'
    }
  ]

  const nextJob = cronJobs
    .filter((j) => j.enabled && j.state.nextRunAtMs)
    .sort((a, b) => (a.state.nextRunAtMs || 0) - (b.state.nextRunAtMs || 0))[0]

  const runningJobs = cronJobs.filter((j) => j.state.status === 'running')
  const failedJobs = cronJobs.filter((j) => j.state.status === 'failed')

  const formatNextRun = (ms?: number): string => {
    if (!ms) return 'Not scheduled'
    const diff = ms - Date.now()
    if (diff <= 0) return 'Due now'
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `In ${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `In ${hours}h ${minutes % 60}m`
  }

  if (loading) {
    return <LoadingSkeleton variant="card" count={4} />
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button className="btn btn-primary btn-sm" onClick={loadData}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="stats-grid">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <div key={i} className={`stat-card stat-${stat.color}`}>
              <div className="stat-header">
                <div className="stat-icon">
                  <Icon />
                </div>
                {stat.trend && (
                  <span className="stat-trend">
                    <TrendingUp className="trend-icon" />
                    {stat.trend}
                  </span>
                )}
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.title}</div>
            </div>
          )
        })}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="quick-actions">
            <button className="action-btn" onClick={() => window.api.gateway.connect()}>
              <Zap className="action-icon" />
              <span>Connect Gateway</span>
            </button>
            <button className="action-btn" onClick={() => window.api.gateway.clear()}>
              <CheckCircle className="action-icon" />
              <span>Clear Events</span>
            </button>
            <button className="action-btn" onClick={loadData}>
              <Activity className="action-icon" />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <h3>Next Run</h3>
          </div>
          {nextJob ? (
            <div className="next-run">
              <Clock className="next-run-icon" />
              <div className="next-run-info">
                <div className="next-run-name">{nextJob.name}</div>
                <div className="next-run-time">{formatNextRun(nextJob.state.nextRunAtMs)}</div>
              </div>
            </div>
          ) : (
            <div className="empty-state-sm">No upcoming runs</div>
          )}
        </div>

        {(runningJobs.length > 0 || failedJobs.length > 0) && (
          <div className="dashboard-card">
            <div className="card-header">
              <h3>Job Status</h3>
            </div>
            <div className="job-status-list">
              {runningJobs.map((job) => (
                <div key={job.id} className="job-status-item running">
                  <Activity className="status-icon" />
                  <span>{job.name}</span>
                  <span className="status-badge">Running</span>
                </div>
              ))}
              {failedJobs.map((job) => (
                <div key={job.id} className="job-status-item failed">
                  <AlertCircle className="status-icon" />
                  <span>{job.name}</span>
                  <span className="status-badge">Failed</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-card">
        <div className="card-header">
          <h3>Recent Activity</h3>
          <button className="text-btn" onClick={() => (window as any).location.hash = '#events'}>
            View All
          </button>
        </div>
        <div className="activity-list">
          {events.slice(0, 5).map((event: any, i) => (
            <div key={i} className="activity-item">
              <div className="activity-time">
                {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '-'}
              </div>
              <div className="activity-details">
                <div className="activity-type">{event.type || event.event || 'unknown'}</div>
                {event.payload && typeof event.payload === 'string' && (
                  <div className="activity-preview">{event.payload.slice(0, 100)}</div>
                )}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="empty-state-sm">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  )
}
