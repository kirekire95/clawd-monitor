import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      gateway: {
        status(): Promise<{ connected: boolean; url: string }>
        events(): Promise<Array<{ type: string; timestamp: number; data?: unknown }>>
        connect(): Promise<{ success: boolean }>
        disconnect(): Promise<{ success: boolean }>
        clear(): Promise<{ success: boolean }>
        onStatusChange(callback: (status: { connected: boolean; url: string }) => void): () => void
        onEvent(callback: (event: { type: string; timestamp: number; data?: unknown }) => void): () => void
      }
      agent: {
        send(agent: string, message: string, local?: boolean): Promise<{ success: boolean; output?: string; error?: string }>
      }
      cron: {
        status(): Promise<{ success: boolean; jobs?: unknown[]; error?: string }>
        runs(): Promise<{ success: boolean; runs?: unknown[]; error?: string }>
      }
      skills: {
        list(): Promise<{
          success: boolean
          skills: Array<{
            name: string
            description: string
            emoji: string
            path: string
            lastRun?: string
            status?: string
          }>
          error?: string
        }>
        autonomousStatus(): Promise<{
          success: boolean
          sessions: Array<{
            id: string
            tool: string
            project: string
            task: string
            started: string
            status: 'running' | 'completed' | 'failed'
            result?: string
          }>
          error?: string
        }>
        notesSyncStatus(): Promise<{
          success: boolean
          status: {
            lastSync?: string
            noteCount?: number
            todoCount?: number
          }
          error?: string
        }>
        run(skillName: string): Promise<{ success: boolean; error?: string }>
      }
    }
  }
}
