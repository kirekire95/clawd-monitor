import { useEffect, useState, useCallback, useRef } from 'react'
import { Clock, RefreshCw } from 'lucide-react'
import './CronJobs.css'
import LoadingSkeleton from './LoadingSkeleton'

interface CronJob {
  id: string
  name: string
  enabled: boolean
  schedule: {
    kind: string
    expr?: string
    everyMs?: number
    tz?: string
  }
  agentId: string
  state: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    status?: string
  }
}

interface CronRun {
  id: string
  jobId: string
  startedAt: number
  completedAt?: number
  status: string
  output?: string
}

export default function CronJobs(): React.JSX.Element {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [runs, setRuns] = useState<CronRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const isLoadingRef = useRef(false)

  // Memoize loadData with lock to prevent stacking
  const loadData = useCallback(async () => {
    if (isLoadingRef.current) return
    isLoadingRef.current = true

    try {
      const [jobsResult, runsResult] = await Promise.all([
        window.api.cron.status(),
        window.api.cron.runs()
      ])

      if (jobsResult.success && Array.isArray(jobsResult.jobs)) {
        setJobs(jobsResult.jobs as CronJob[])
      }
      if (runsResult.success && Array.isArray(runsResult.runs)) {
        setRuns(runsResult.runs as CronRun[])
      }
      setError(null)
    } catch (err) {
      console.error('Failed to load cron data:', err)
      setError('Failed to load cron jobs')
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
    }, 15000) // Increased to 15s

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [loadData])

  const formatSchedule = (job: CronJob): string => {
    if (job.schedule.kind === 'cron' && job.schedule.expr) {
      return `Cron: ${job.schedule.expr}${job.schedule.tz ? ` (${job.schedule.tz})` : ''}`
    }
    if (job.schedule.kind === 'every' && job.schedule.everyMs) {
      const minutes = Math.floor(job.schedule.everyMs / 60000)
      return `Every: ${minutes}m`
    }
    return job.schedule.kind
  }

  const formatTimestamp = (ms?: number): string => {
    if (!ms) return '-'
    return new Date(ms).toLocaleString()
  }

  const getNextRun = (job: CronJob): string => {
    if (!job.state.nextRunAtMs) return 'Not scheduled'
    const diff = job.state.nextRunAtMs - Date.now()
    if (diff <= 0) return 'Due now'
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `In ${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `In ${hours}h ${minutes % 60}m`
  }

  const getStatusBadge = (status?: string): React.JSX.Element => {
    if (!status) return <span className="status-badge idle">idle</span>
    switch (status) {
      case 'running':
        return <span className="status-badge running">running</span>
      case 'completed':
        return <span className="status-badge completed">done</span>
      case 'failed':
        return <span className="status-badge failed">failed</span>
      default:
        return <span className="status-badge idle">{status}</span>
    }
  }

  const jobRuns = selectedJob
    ? runs.filter(r => r.jobId === selectedJob).slice(0, 10)
    : runs.slice(0, 10)

  if (loading) {
    return <LoadingSkeleton variant="list" count={5} />
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
    <div className="cron-jobs">
      <div className="cron-section">
        <div className="section-header">
          <h2>Scheduled Jobs</h2>
          <button className="btn-icon" onClick={loadData} title="Refresh">
            <RefreshCw className="icon" />
          </button>
        </div>

        <div className="jobs-list">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={`job-card ${selectedJob === job.id ? 'selected' : ''}`}
              onClick={() => setSelectedJob(job.id)}
            >
              <div className="job-header">
                <div className="job-title">
                  <Clock className="job-icon" />
                  <span className="job-name">{job.name}</span>
                  {!job.enabled && <span className="job-disabled">(disabled)</span>}
                </div>
                {getStatusBadge(job.state.status)}
              </div>
              <div className="job-details">
                <div className="job-detail">
                  <span className="detail-label">Schedule:</span>
                  <span className="detail-value">{formatSchedule(job)}</span>
                </div>
                <div className="job-detail">
                  <span className="detail-label">Agent:</span>
                  <span className="detail-value">{job.agentId}</span>
                </div>
                <div className="job-detail">
                  <span className="detail-label">Next run:</span>
                  <span className="detail-value">{getNextRun(job)}</span>
                </div>
                <div className="job-detail">
                  <span className="detail-label">Last run:</span>
                  <span className="detail-value">{formatTimestamp(job.state.lastRunAtMs)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cron-section">
        <div className="section-header">
          <h2>Recent Runs {selectedJob && '(filtered)'}</h2>
          {selectedJob && (
            <button className="btn-text" onClick={() => setSelectedJob(null)}>
              Clear filter
            </button>
          )}
        </div>

        <div className="runs-list">
          {jobRuns.length === 0 ? (
            <div className="empty-state">No runs yet</div>
          ) : (
            jobRuns.map((run) => (
              <div key={run.id} className={`run-card ${run.status}`}>
                <div className="run-header">
                  <span className="run-status">
                    {run.status === 'completed' && '✓'}
                    {run.status === 'failed' && '✗'}
                    {run.status === 'running' && '⟳'}
                  </span>
                  <span className="run-time">{formatTimestamp(run.startedAt)}</span>
                  {run.completedAt && (
                    <span className="run-duration">
                      {Math.round((run.completedAt - run.startedAt) / 1000)}s
                    </span>
                  )}
                </div>
                {run.output && (
                  <div className="run-output">
                    <pre>{run.output.slice(0, 500)}{run.output.length > 500 && '...'}</pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
