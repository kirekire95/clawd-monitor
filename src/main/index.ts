import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readdir, readFile, access } from 'fs/promises'
import { constants } from 'fs'
import icon from '../../resources/icon.png?asset'
import { GatewayClient, type GatewayEvent } from './gateway'

const execAsync = promisify(exec)

const gateway = new GatewayClient()
const events: GatewayEvent[] = []
const MAX_EVENTS = 100

// Simple cache to avoid hammering CLI
const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 5000 // 5 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && entry.expires > Date.now()) {
    return entry.data as T
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  // Gateway event listeners
  gateway.on('message', (event: GatewayEvent) => {
    events.push(event)
    if (events.length > MAX_EVENTS) {
      events.shift()
    }
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('gateway:event', event)
    })
  })

  gateway.on('connected', () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('gateway:status', { connected: true })
    })
  })

  gateway.on('disconnected', () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('gateway:status', { connected: false })
    })
  })

  gateway.connect()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC handlers
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('gateway:status', () => ({
    connected: gateway.isConnected(),
    url: 'ws://127.0.0.1:18789'
  }))

  ipcMain.handle('gateway:events', () => events)

  ipcMain.handle('gateway:connect', () => {
    gateway.connect()
    return { success: true }
  })

  ipcMain.handle('gateway:disconnect', () => {
    gateway.disconnect()
    return { success: true }
  })

  ipcMain.handle('gateway:clear', () => {
    events.length = 0
    return { success: true }
  })

  // Send message to agent (async, non-blocking)
  ipcMain.handle('agent:send', async (_, { agent, message, local = false }) => {
    try {
      const cmd = local
        ? `clawdbot agent --local --agent ${agent} --message "${message.replace(/"/g, '\\"')}"`
        : `clawdbot agent --agent ${agent} --message "${message.replace(/"/g, '\\"')}"`
      const { stdout } = await execAsync(cmd, { timeout: 60000 })
      return { success: true, output: stdout }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Get cron jobs status (async with cache)
  ipcMain.handle('cron:status', async () => {
    const cached = getCached<{ success: boolean; jobs: unknown[] }>('cron:status')
    if (cached) return cached

    try {
      const { stdout } = await execAsync('clawdbot cron list --json', { timeout: 10000 })
      const parsed = JSON.parse(stdout)
      const jobs = Array.isArray(parsed) ? parsed : (parsed.jobs || [])
      const result = { success: true, jobs }
      setCache('cron:status', result)
      return result
    } catch (error: unknown) {
      console.error('cron:status error:', error)
      return { success: false, error: (error as Error).message, jobs: [] }
    }
  })

  // Get cron run history (async, parallel, with cache)
  ipcMain.handle('cron:runs', async () => {
    const cached = getCached<{ success: boolean; runs: unknown[] }>('cron:runs')
    if (cached) return cached

    try {
      const { stdout: jobsOutput } = await execAsync('clawdbot cron list --json', { timeout: 10000 })
      const jobsParsed = JSON.parse(jobsOutput)
      const jobs = Array.isArray(jobsParsed) ? jobsParsed : (jobsParsed.jobs || [])

      // Fetch runs in parallel (limit to 3 jobs)
      const runPromises = jobs.slice(0, 3).map(async (job: { id: string }) => {
        try {
          const { stdout } = await execAsync(
            `clawdbot cron runs --id "${job.id}" --limit 3`,
            { timeout: 5000 }
          )
          if (!stdout.trim()) return []
          return stdout.trim().split('\n').map((line) => {
            try {
              return { ...JSON.parse(line), jobId: job.id }
            } catch {
              return null
            }
          }).filter(Boolean)
        } catch {
          return []
        }
      })

      const runResults = await Promise.all(runPromises)
      const allRuns = runResults.flat()
      const result = { success: true, runs: allRuns }
      setCache('cron:runs', result)
      return result
    } catch (error: unknown) {
      console.error('cron:runs error:', error)
      return { success: false, error: (error as Error).message, runs: [] }
    }
  })

  // Skills handlers
  const SKILLS_DIR = join(app.getPath('home'), 'clawd', 'skills')
  const MEMORY_DIR = join(app.getPath('home'), 'clawd', 'memory')

  // List all skills (async with cache)
  ipcMain.handle('skills:list', async () => {
    const cached = getCached<{ success: boolean; skills: unknown[] }>('skills:list')
    if (cached) return cached

    try {
      const entries = await readdir(SKILLS_DIR, { withFileTypes: true })
      const skillDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)

      const skillPromises = skillDirs.map(async (dir) => {
        const skillPath = join(SKILLS_DIR, dir, 'SKILL.md')
        if (!(await fileExists(skillPath))) return null

        try {
          const content = await readFile(skillPath, 'utf-8')
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
          let name = dir
          let description = ''
          let emoji = '🔧'

          if (frontmatterMatch) {
            const frontmatter = frontmatterMatch[1]
            const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
            const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
            const metaMatch = frontmatter.match(/metadata:\s*(\{.+\})/)
            if (nameMatch) name = nameMatch[1]
            if (descMatch) description = descMatch[1]
            if (metaMatch) {
              try {
                const meta = JSON.parse(metaMatch[1])
                if (meta.clawdbot?.emoji) emoji = meta.clawdbot.emoji
              } catch {}
            }
          }

          return { name, description, emoji, path: skillPath }
        } catch {
          return null
        }
      })

      const skills = (await Promise.all(skillPromises)).filter(Boolean)
      const result = { success: true, skills }
      setCache('skills:list', result)
      return result
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message, skills: [] }
    }
  })

  // Get autonomous work status (async)
  ipcMain.handle('skills:autonomousStatus', async () => {
    try {
      const filePath = join(MEMORY_DIR, 'autonomous-work.json')
      if (!(await fileExists(filePath))) {
        return { success: true, sessions: [] }
      }
      const content = await readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      return { success: true, sessions: Array.isArray(data.sessions) ? data.sessions : [] }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message, sessions: [] }
    }
  })

  // Get notes sync status (async)
  ipcMain.handle('skills:notesSyncStatus', async () => {
    try {
      const syncDir = join(MEMORY_DIR, 'notes-sync')
      const indexPath = join(syncDir, 'index.json')
      const todosPath = join(syncDir, 'todos.json')

      const status: { lastSync?: string; noteCount?: number; todoCount?: number } = {}

      if (await fileExists(indexPath)) {
        const index = JSON.parse(await readFile(indexPath, 'utf-8'))
        status.lastSync = index.lastSync
        status.noteCount = Array.isArray(index.notes) ? index.notes.length : 0
      }

      if (await fileExists(todosPath)) {
        const todos = JSON.parse(await readFile(todosPath, 'utf-8'))
        status.todoCount = Array.isArray(todos.items)
          ? todos.items.filter((t: { checked?: boolean }) => !t.checked).length
          : 0
      }

      return { success: true, status }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message, status: {} }
    }
  })

  // Run a skill (fire and forget, non-blocking)
  ipcMain.handle('skills:run', async (_, skillName: string) => {
    try {
      // Fire and forget - don't wait for completion
      exec(`clawdbot skill run ${skillName}`, (error, stdout) => {
        if (error) {
          console.log(`Skill ${skillName} error:`, error.message)
        } else {
          console.log(`Skill ${skillName} output:`, stdout)
        }
      })
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
