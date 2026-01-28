import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface GatewayStatus {
  connected: boolean
  url: string
}

export interface GatewayEvent {
  type: string
  timestamp: number
  data?: unknown
}

// Custom APIs for renderer
const api = {
  gateway: {
    status: () => ipcRenderer.invoke('gateway:status'),
    events: () => ipcRenderer.invoke('gateway:events'),
    connect: () => ipcRenderer.invoke('gateway:connect'),
    disconnect: () => ipcRenderer.invoke('gateway:disconnect'),
    clear: () => ipcRenderer.invoke('gateway:clear'),
    onStatusChange: (callback: (status: GatewayStatus) => void) => {
      const listener = (_: unknown, status: GatewayStatus) => callback(status)
      ipcRenderer.on('gateway:status', listener)
      return () => ipcRenderer.removeListener('gateway:status', listener)
    },
    onEvent: (callback: (event: GatewayEvent) => void) => {
      const listener = (_: unknown, event: GatewayEvent) => callback(event)
      ipcRenderer.on('gateway:event', listener)
      return () => ipcRenderer.removeListener('gateway:event', listener)
    }
  },
  agent: {
    send: (agent: string, message: string, local?: boolean) =>
      ipcRenderer.invoke('agent:send', { agent, message, local })
  },
  cron: {
    status: () => ipcRenderer.invoke('cron:status'),
    runs: () => ipcRenderer.invoke('cron:runs')
  },
  skills: {
    list: () => ipcRenderer.invoke('skills:list'),
    autonomousStatus: () => ipcRenderer.invoke('skills:autonomousStatus'),
    notesSyncStatus: () => ipcRenderer.invoke('skills:notesSyncStatus'),
    run: (skillName: string) => ipcRenderer.invoke('skills:run', skillName)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
