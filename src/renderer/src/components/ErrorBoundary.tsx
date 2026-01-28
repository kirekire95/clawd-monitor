import { Component, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <AlertCircle className="error-icon" />
            <h2>Something went wrong</h2>
            <p className="error-message">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button className="btn btn-primary" onClick={this.handleReset}>
              <RefreshCw className="btn-icon" />
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
