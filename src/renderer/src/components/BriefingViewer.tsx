import { useState, useEffect, useCallback } from 'react'
import { Sunrise } from 'lucide-react'
import './BriefingViewer.css'
import LoadingSkeleton from './LoadingSkeleton'

interface GatewayEvent {
  type: string
  event?: string
  payload?: unknown
  timestamp?: number
}

interface ParsedBriefing {
  weather?: {
    current: string
    temp: string
    conditions: string
  }
  tasks?: {
    next: string
    inProgress: number
    blocked: string
  }
  github?: {
    repos: Array<{
      name: string
      commits: number
      prs: string
      ci: string
    }>
  }
  reddit?: Array<{
    subreddit: string
    title: string
    summary: string
  }>
  korean?: {
    word: string
    romanization: string
    meaning: string
    example: string
  }
}

export default function BriefingViewer(): React.JSX.Element {
  const [briefings, setBriefings] = useState<string[]>([])
  const [selectedBriefing, setSelectedBriefing] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedBriefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memoize parseBriefing
  const parseBriefing = useCallback((text: string): ParsedBriefing => {
    const result: ParsedBriefing = {}

    // Parse weather
    const weatherMatch = text.match(/☀️\s*\*\*(.+?)\*\*\s*\|\s*\*\*(.+?)\*\*/)
    if (weatherMatch) {
      result.weather = {
        current: weatherMatch[1],
        temp: weatherMatch[2],
        conditions: weatherMatch[1]
      }
    }

    // Parse tasks
    const taskMatch = text.match(/Next up:\s*(.+?)(?:\n|$)/)
    if (taskMatch) {
      result.tasks = {
        next: taskMatch[1],
        inProgress: 0,
        blocked: 'None'
      }
    }

    // Parse Korean word
    const koreanMatch = text.match(/\*\*(.+?)\*\*\s*\((.+?)\)\s*\n.+?:\s*(.+?)(?:\n|$)/)
    if (koreanMatch) {
      result.korean = {
        word: koreanMatch[1],
        romanization: koreanMatch[2],
        meaning: koreanMatch[3],
        example: ''
      }
    }

    return result
  }, [])

  // Load briefings with error handling and cleanup
  useEffect(() => {
    let mounted = true

    const loadBriefings = async () => {
      try {
        const events = await window.api.gateway.events()
        if (!mounted) return

        const morningEvents = events
          .filter((e: GatewayEvent) => {
            const eventType = e.type || e.event || ''
            return eventType.toLowerCase().includes('morning') || eventType.toLowerCase().includes('briefing')
          })
          .slice(0, 10)
          .reverse()

        if (morningEvents.length > 0) {
          const texts = morningEvents.map((e: GatewayEvent) =>
            typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload || '')
          )
          setBriefings(texts)
          setSelectedBriefing(texts[0])
        }
        setError(null)
      } catch (err) {
        console.error('Failed to load briefings:', err)
        if (mounted) {
          setError('Failed to load briefings')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadBriefings()

    return () => {
      mounted = false
    }
  }, [])

  // Update parsed when selection changes
  useEffect(() => {
    if (selectedBriefing) {
      setParsed(parseBriefing(selectedBriefing))
    }
  }, [selectedBriefing, parseBriefing])

  if (loading) {
    return <LoadingSkeleton variant="card" count={3} />
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="briefing-viewer">
      <div className="briefing-sidebar">
        <div className="sidebar-header">
          <h3>Recent Briefings</h3>
        </div>
        <div className="briefing-list">
          {briefings.length === 0 ? (
            <div className="empty-state">
              <p>No briefings yet</p>
              <p className="empty-hint">Morning briefings appear at 9:30am KST</p>
            </div>
          ) : (
            briefings.map((b, i) => (
              <div
                key={i}
                className={`briefing-item ${selectedBriefing === b ? 'active' : ''}`}
                onClick={() => setSelectedBriefing(b)}
              >
                <Sunrise className="briefing-item-icon" />
                <div className="briefing-item-content">
                  <div className="briefing-item-title">Morning Briefing</div>
                  <div className="briefing-item-date">
                    {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="briefing-content">
        {!parsed ? (
          <div className="empty-state">
            <p>Select a briefing to view</p>
          </div>
        ) : (
          <div className="briefing-card">
            <div className="briefing-header">
              <Sunrise className="briefing-icon" />
              <h2>Morning Briefing</h2>
            </div>

            {parsed.weather && (
              <section className="briefing-section">
                <h3 className="section-title">🌤️ Weather</h3>
                <div className="weather-card">
                  <div className="weather-main">
                    <span className="weather-temp">{parsed.weather.temp}</span>
                    <span className="weather-condition">{parsed.weather.conditions}</span>
                  </div>
                  <div className="weather-location">Seoul, South Korea</div>
                </div>
              </section>
            )}

            {parsed.tasks && (
              <section className="briefing-section">
                <h3 className="section-title">📋 Tasks</h3>
                <div className="tasks-card">
                  <div className="task-item">
                    <span className="task-label">Next up:</span>
                    <span className="task-value">{parsed.tasks.next}</span>
                  </div>
                </div>
              </section>
            )}

            {parsed.github && (
              <section className="briefing-section">
                <h3 className="section-title">💻 GitHub</h3>
                <div className="github-list">
                  {parsed.github.repos.map((repo, i) => (
                    <div key={i} className="github-card">
                      <div className="repo-name">{repo.name}</div>
                      <div className="repo-stats">
                        <span>{repo.commits} commits</span>
                        <span>{repo.prs}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {parsed.reddit && parsed.reddit.length > 0 && (
              <section className="briefing-section">
                <h3 className="section-title">🔥 Reddit Highlights</h3>
                <div className="reddit-list">
                  {parsed.reddit.map((post, i) => (
                    <div key={i} className="reddit-card">
                      <div className="reddit-sub">r/{post.subreddit}</div>
                      <div className="reddit-title">{post.title}</div>
                      <div className="reddit-summary">{post.summary}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {parsed.korean && (
              <section className="briefing-section">
                <h3 className="section-title">🇰🇷 Korean Word of the Day</h3>
                <div className="korean-card">
                  <div className="korean-word">{parsed.korean.word}</div>
                  <div className="korean-romanization">{parsed.korean.romanization}</div>
                  <div className="korean-meaning">{parsed.korean.meaning}</div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
