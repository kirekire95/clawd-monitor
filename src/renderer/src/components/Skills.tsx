import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Bot,
  Brain,
  Apple,
  Code,
  Sunrise,
  Search,
  Github,
  MessageSquare,
  Play,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react'
import './Skills.css'

interface Skill {
  name: string
  description: string
  emoji: string
  path: string
  lastRun?: string
  status?: string
}

interface AutonomousSession {
  id: string
  tool: string
  project: string
  task: string
  started: string
  status: 'running' | 'completed' | 'failed'
  result?: string
}

interface NotesSyncStatus {
  lastSync?: string
  noteCount?: number
  todoCount?: number
}

const SKILL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'autonomous-dev': Bot,
  'codex-dev': Code,
  'daily-planner': Brain,
  'apple-notes-sync': Apple,
  'morning-briefing': Sunrise,
  research: Search,
  'github-status': Github,
  'reddit-monitor': MessageSquare
}

export default function Skills(): React.JSX.Element {
  const [skills, setSkills] = useState<Skill[]>([])
  const [autonomousSessions, setAutonomousSessions] = useState<AutonomousSession[]>([])
  const [notesSyncStatus, setNotesSyncStatus] = useState<NotesSyncStatus>({})
  const [loading, setLoading] = useState(true)
  const [runningSkill, setRunningSkill] = useState<string | null>(null)
  const isLoadingRef = useRef(false)

  const loadSkills = useCallback(async () => {
    if (isLoadingRef.current) return
    isLoadingRef.current = true

    try {
      // Load skills from the skills directory
      const result = await window.api.skills.list()
      if (result.success && Array.isArray(result.skills)) {
        setSkills(result.skills)
      }

      // Load autonomous work status
      const autonomousResult = await window.api.skills.autonomousStatus()
      if (autonomousResult.success && Array.isArray(autonomousResult.sessions)) {
        setAutonomousSessions(autonomousResult.sessions)
      }

      // Load notes sync status
      const notesResult = await window.api.skills.notesSyncStatus()
      if (notesResult.success) {
        setNotesSyncStatus(notesResult.status || {})
      }
    } catch (err) {
      console.error('Failed to load skills:', err)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [])

  useEffect(() => {
    loadSkills()
    const interval = setInterval(loadSkills, 60000) // Refresh every 60s (skills don't change often)
    return () => clearInterval(interval)
  }, [loadSkills])

  const handleRunSkill = async (skillName: string) => {
    setRunningSkill(skillName)
    try {
      await window.api.skills.run(skillName)
      // Refresh after a short delay
      setTimeout(loadSkills, 2000)
    } catch (err) {
      console.error('Failed to run skill:', err)
    } finally {
      setRunningSkill(null)
    }
  }

  const formatTimeAgo = (dateStr?: string): string => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="status-icon spinning" />
      case 'success':
      case 'completed':
        return <CheckCircle className="status-icon success" />
      case 'error':
      case 'failed':
        return <AlertCircle className="status-icon error" />
      default:
        return <Clock className="status-icon idle" />
    }
  }

  if (loading) {
    return (
      <div className="skills-loading">
        <RefreshCw className="spinning" />
        <span>Loading skills...</span>
      </div>
    )
  }

  const activeAutonomous = autonomousSessions.filter((s) => s.status === 'running')
  const recentAutonomous = autonomousSessions.filter((s) => s.status !== 'running').slice(0, 5)

  return (
    <div className="skills">
      {/* Status Cards */}
      <div className="skills-status-grid">
        <div className="status-card">
          <div className="status-card-header">
            <Bot className="status-card-icon" />
            <h3>Autonomous Work</h3>
          </div>
          <div className="status-card-value">{activeAutonomous.length}</div>
          <div className="status-card-label">Active sessions</div>
        </div>

        <div className="status-card">
          <div className="status-card-header">
            <Apple className="status-card-icon" />
            <h3>Notes Sync</h3>
          </div>
          <div className="status-card-value">{notesSyncStatus.todoCount || 0}</div>
          <div className="status-card-label">
            Open todos | Last sync: {formatTimeAgo(notesSyncStatus.lastSync)}
          </div>
        </div>

        <div className="status-card">
          <div className="status-card-header">
            <Code className="status-card-icon" />
            <h3>Available Skills</h3>
          </div>
          <div className="status-card-value">{skills.length}</div>
          <div className="status-card-label">Loaded from workspace</div>
        </div>
      </div>

      {/* Active Autonomous Sessions */}
      {activeAutonomous.length > 0 && (
        <div className="skills-card">
          <div className="card-header">
            <h3>Running Autonomous Sessions</h3>
          </div>
          <div className="autonomous-list">
            {activeAutonomous.map((session) => (
              <div key={session.id} className="autonomous-item running">
                <div className="autonomous-icon">
                  {session.tool === 'codex' ? <Code /> : <Bot />}
                </div>
                <div className="autonomous-info">
                  <div className="autonomous-project">{session.project}</div>
                  <div className="autonomous-task">{session.task}</div>
                </div>
                <div className="autonomous-status">
                  <RefreshCw className="spinning" />
                  <span>Running</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills Grid */}
      <div className="skills-card">
        <div className="card-header">
          <h3>Available Skills</h3>
          <button className="text-btn" onClick={loadSkills}>
            <RefreshCw className="btn-icon" />
            Refresh
          </button>
        </div>
        <div className="skills-grid">
          {skills.map((skill) => {
            const Icon = SKILL_ICONS[skill.name] || Brain
            const isRunning = runningSkill === skill.name
            return (
              <div key={skill.name} className="skill-card">
                <div className="skill-header">
                  <div className="skill-icon">
                    <Icon />
                  </div>
                  <div className="skill-meta">
                    <div className="skill-name">
                      {skill.emoji} {skill.name}
                    </div>
                    <div className="skill-description">{skill.description}</div>
                  </div>
                </div>
                <div className="skill-footer">
                  <div className="skill-status">
                    {getStatusIcon(skill.status)}
                    <span className="skill-last-run">
                      {skill.lastRun ? formatTimeAgo(skill.lastRun) : 'Never run'}
                    </span>
                  </div>
                  <button
                    className="skill-run-btn"
                    onClick={() => handleRunSkill(skill.name)}
                    disabled={isRunning}
                  >
                    {isRunning ? <RefreshCw className="spinning" /> : <Play />}
                    <span>{isRunning ? 'Running...' : 'Run'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Autonomous Work */}
      {recentAutonomous.length > 0 && (
        <div className="skills-card">
          <div className="card-header">
            <h3>Recent Autonomous Work</h3>
          </div>
          <div className="autonomous-list">
            {recentAutonomous.map((session) => (
              <div key={session.id} className={`autonomous-item ${session.status}`}>
                <div className="autonomous-icon">
                  {session.tool === 'codex' ? <Code /> : <Bot />}
                </div>
                <div className="autonomous-info">
                  <div className="autonomous-project">{session.project}</div>
                  <div className="autonomous-task">{session.task}</div>
                  {session.result && (
                    <div className="autonomous-result">{session.result}</div>
                  )}
                </div>
                <div className={`autonomous-status ${session.status}`}>
                  {getStatusIcon(session.status)}
                  <span>{session.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
