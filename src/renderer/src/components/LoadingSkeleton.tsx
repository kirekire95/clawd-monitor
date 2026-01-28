import './LoadingSkeleton.css'

interface LoadingSkeletonProps {
  variant?: 'card' | 'list' | 'stat' | 'text'
  count?: number
}

export default function LoadingSkeleton({ variant = 'card', count = 1 }: LoadingSkeletonProps): React.JSX.Element {
  if (variant === 'stat') {
    return (
      <div className="skeleton stat-skeleton">
        <div className="skeleton-icon"></div>
        <div className="skeleton-value"></div>
        <div className="skeleton-label"></div>
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className="skeleton-list">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-item">
            <div className="skeleton-item-icon"></div>
            <div className="skeleton-item-content">
              <div className="skeleton-item-title"></div>
              <div className="skeleton-item-subtitle"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <div className="skeleton-text">
        <div className="skeleton-line"></div>
        <div className="skeleton-line short"></div>
      </div>
    )
  }

  // card (default)
  return (
    <div className="skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card"></div>
      ))}
    </div>
  )
}
