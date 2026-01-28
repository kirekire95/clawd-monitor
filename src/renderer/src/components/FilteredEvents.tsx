import { useState, useEffect, useCallback, useMemo } from 'react'
import { Activity, Clock, Globe, Send, Bot } from 'lucide-react'
import './FilteredEvents.css'
import LoadingSkeleton from './LoadingSkeleton'

interface GatewayEvent {
  type: string
  event?: string
  payload?: unknown
  seq?: number
  stateVersion?: number
  timestamp?: number
}

const EVENT_FILTERS = [
  { id: 'all', label: 'All Events', icon: Activity },
  { id: 'cron', label: 'Cron Jobs', icon: Clock },
  { id: 'gateway', label: 'Gateway', icon: Globe },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'agent', label: 'Agent', icon: Bot }
] as const

function getEventIcon(type: string): React.ComponentType<{ className?: string }> {
  if (type.includes('cron')) return Clock
  if (type.includes('gateway')) return Globe
  if (type.includes('telegram')) return Send
  if (type.includes('agent')) return Bot
  return Activity
}

export default function FilteredEvents(): React.JSX.Element {
  const [events, setEvents] = useState<GatewayEvent[]>([])
  const [filter, setFilter] = useState('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memoize filtered events to prevent recalculation
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events
    return events.filter((event) => {
      const eventType = event.type || event.event || ''
      return eventType.toLowerCase().includes(filter)
    })
  }, [events, filter])

  // Memoize format function
  const formatTimestamp = useCallback((timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString()
  }, [])

  // Stable event handler with proper cleanup
  const handleEvent = useCallback((event: GatewayEvent) => {
    setEvents((prev) => {
      const updated = [event, ...prev].slice(0, 100)
      if (autoScroll) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          const container = document.querySelector('.filtered-events-list')
          if (container) {
            container.scrollTop = 0
          }
        })
      }
      return updated
    })
  }, [autoScroll])

  // Load events with error handling
  const loadEvents = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.gateway.events()
      setEvents(result)
    } catch (err) {
      console.error('Failed to load events:', err)
      setError('Failed to load events')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle clear with error handling
  const handleClear = useCallback(async () => {
    try {
      await window.api.gateway.clear()
      setEvents([])
    } catch (err) {
      console.error('Failed to clear events:', err)
      setError('Failed to clear events')
    }
  }, [])

  // Initial load and event listener setup with proper cleanup
  useEffect(() => {
    loadEvents()

    const unsubscribe = window.api.gateway.onEvent(handleEvent)

    return () => {
      unsubscribe()
    }
  }, [handleEvent, loadEvents])

  if (isLoading) {
    return <LoadingSkeleton variant="list" count={5} />
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button className="btn btn-primary btn-sm" onClick={loadEvents}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="filtered-events">
      <div className="events-toolbar">
        <div className="filter-tabs">
          {EVENT_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`filter-tab ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              aria-label={`Show ${f.label.toLowerCase()}`}
            >
              <f.icon className="filter-icon" />
              <span className="filter-label">{f.label}</span>
              <span className="filter-count">
                {f.id === 'all'
                  ? events.length
                  : events.filter((e) => {
                      const eventType = e.type || e.event || ''
                      return eventType.toLowerCase().includes(f.id)
                    }).length}
              </span>
            </button>
          ))}
        </div>

        <div className="toolbar-actions">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              aria-label="Enable auto-scroll"
            />
            <span>Auto-scroll</span>
          </label>
          <button className="btn btn-secondary" onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>

      <div className="filtered-events-list">
        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <p>No events yet</p>
            <p className="empty-hint">Events will appear when the Gateway is active</p>
          </div>
        ) : (
          filteredEvents.map((event, index) => {
            const Icon = getEventIcon(event.type || event.event || '')
            return (
              <div key={`${event.seq || index}-${event.timestamp || Date.now()}`} className="event-card">
                <div className="event-header">
                  <Icon className="event-icon" />
                  <span className="event-type">{event.type || event.event || 'unknown'}</span>
                  <span className="event-time">
                    {event.timestamp ? formatTimestamp(event.timestamp) : '-'}
                  </span>
                </div>
                {event.payload !== undefined && event.payload !== null && (
                  <pre className="event-data">
                    {typeof event.payload === 'string'
                      ? event.payload
                      : JSON.stringify(event.payload, null, 2) ?? ''}
                  </pre>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
