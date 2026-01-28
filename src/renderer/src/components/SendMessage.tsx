import { useState, useCallback } from 'react'
import { Send } from 'lucide-react'
import './SendMessage.css'

export default function SendMessage(): React.JSX.Element {
  const [agent, setAgent] = useState('main')
  const [message, setMessage] = useState('')
  const [local, setLocal] = useState(true)
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  // Memoize handler with proper error handling
  const handleSend = useCallback(async () => {
    if (!message.trim()) return

    setLoading(true)
    setError('')
    setOutput('')

    try {
      const result = await window.api.agent.send(agent, message, local)

      if (result.success) {
        setOutput(result.output || 'No output')
      } else {
        setError(result.error || 'Failed to send message')
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('An error occurred while sending the message')
    } finally {
      setLoading(false)
    }
  }, [message, agent, local])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend()
    }
  }, [handleSend])

  const handleClear = useCallback(() => {
    setMessage('')
    setOutput('')
    setError('')
  }, [])

  return (
    <div className="send-message">
      <div className="send-form">
        <div className="form-row">
          <label className="form-label">Agent</label>
          <select
            className="form-select"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          >
            <option value="main">main (GLM)</option>
            <option value="local">local (Ollama)</option>
          </select>
        </div>

        <div className="form-row">
          <label className="form-label">Mode</label>
          <div className="form-checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={local}
                onChange={(e) => setLocal(e.target.checked)}
              />
              <span>Local (bypass Gateway)</span>
            </label>
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Message</label>
          <textarea
            className="form-textarea"
            placeholder="Type your message... (Cmd/Ctrl+Enter to send)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            rows={4}
          />
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={loading || !message.trim()}
          >
            {loading ? (
              'Sending...'
            ) : (
              <>
                <Send className="btn-icon" />
                Send Message
              </>
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="output-section">
          <div className="output-header">
            <h3>Error</h3>
          </div>
          <div className="output-error">{error}</div>
        </div>
      )}

      {output && (
        <div className="output-section">
          <div className="output-header">
            <h3>Response</h3>
          </div>
          <pre className="output-content">{output}</pre>
        </div>
      )}
    </div>
  )
}
