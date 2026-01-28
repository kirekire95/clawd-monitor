import { EventEmitter } from 'events'
import WebSocket from 'ws'

export interface GatewayEvent {
  type: string
  event?: string
  payload?: unknown
  seq?: number
  stateVersion?: number
  timestamp?: number
}

export interface GatewayMessage {
  type: 'req' | 'res' | 'event'
  id?: string
  method?: string
  params?: unknown
  ok?: boolean
  payload?: unknown
  error?: unknown
  event?: string
  seq?: number
  stateVersion?: number
}

let requestId = 0

export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null
  private url: string
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectDelay = 2000
  private connected = false
  private token?: string

  constructor(url: string = 'ws://127.0.0.1:18789', token?: string) {
    super()
    this.url = url
    this.token = token
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return

    this.ws = new WebSocket(this.url)

    this.ws.on('open', () => {
      console.log('Gateway WebSocket connected, waiting for challenge...')
      // Don't send connect yet - wait for connect.challenge event
    })

    this.ws.on('message', (data: Buffer) => {
      try {
        const message: GatewayMessage = JSON.parse(data.toString())
        console.log('Gateway message:', message.type, message.event || message.method)

        if (message.type === 'event') {
          // Handle connect.challenge - must respond with connect request
          if (message.event === 'connect.challenge') {
            const challenge = message.payload as { nonce?: string; timestamp?: number }
            console.log('Received challenge, sending connect with nonce...')
            this.sendRequest('connect', {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: 'clawd-monitor',
                displayName: 'Clawd Monitor',
                version: '1.0.0',
                platform: process.platform,
                mode: 'operator'
              },
              role: 'operator',
              scopes: ['operator.read', 'operator.write'],
              caps: [],
              commands: [],
              auth: this.token ? { token: this.token } : undefined,
              device: {
                nonce: challenge?.nonce || ''
              },
              locale: 'en-US',
              userAgent: 'clawd-monitor/1.0.0'
            })
            return
          }

          // It's a regular event from the Gateway
          const event: GatewayEvent = {
            type: message.event || 'unknown',
            payload: message.payload,
            seq: message.seq,
            stateVersion: message.stateVersion,
            timestamp: Date.now()
          }
          this.emit('message', event)
          this.emit(message.event || 'unknown', event)
        } else if (message.type === 'res') {
          if (message.method === 'connect') {
            if (message.ok) {
              console.log('Gateway handshake successful')
              this.connected = true
              this.emit('connected')
            } else {
              console.error('Gateway handshake failed:', message.error)
              this.ws?.close()
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse Gateway message:', err)
      }
    })

    this.ws.on('error', (err) => {
      console.error('Gateway error:', err)
      this.emit('error', err)
    })

    this.ws.on('close', () => {
      console.log('Gateway disconnected')
      this.connected = false
      this.emit('disconnected')
      this.scheduleReconnect()
    })
  }

  private sendRequest(method: string, params: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const id = `req-${requestId++}`
      const message: GatewayMessage = {
        type: 'req',
        id,
        method,
        params
      }
      this.ws.send(JSON.stringify(message))
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect to Gateway...')
      this.connect()
    }, this.reconnectDelay)
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN
  }

  call(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('Not connected to Gateway'))
        return
      }

      const id = `call-${requestId++}`
      const message: GatewayMessage = {
        type: 'req',
        id,
        method,
        params
      }

      const handler = (data: Buffer) => {
        try {
          const response: GatewayMessage = JSON.parse(data.toString())
          if (response.type === 'res' && response.id === id) {
            this.ws?.off('message', handler)
            if (response.ok) {
              resolve(response.payload)
            } else {
              reject(new Error(JSON.stringify(response.error)))
            }
          }
        } catch (err) {
          this.ws?.off('message', handler)
          reject(err)
        }
      }

      this.ws!.on('message', handler)
      this.ws!.send(JSON.stringify(message))

      // Timeout after 30 seconds
      setTimeout(() => {
        this.ws?.off('message', handler)
        reject(new Error('Gateway call timeout'))
      }, 30000)
    })
  }
}
