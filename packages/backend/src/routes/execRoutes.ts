import type { Express } from 'express'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { tmpdir, platform } from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)
const IS_WINDOWS = platform() === 'win32'

function resolveShell(): string {
  if (!IS_WINDOWS) return 'bash'
  const candidates = [
    path.join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
    path.join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'Git', 'bin', 'bash.exe'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return 'bash'
}

const RESOLVED_SHELL = resolveShell()

export function registerExecRoutes(app: Express): void {
  app.get('/api/shell-info', (_req, res) => {
    res.json({
      shell: RESOLVED_SHELL,
      tempDir: tmpdir(),
      isWindows: IS_WINDOWS,
      gitBashAvailable: IS_WINDOWS ? existsSync(RESOLVED_SHELL) : true,
    })
  })

  app.post('/api/exec', async (req, res) => {
    const { cmd, args } = req.body
    if (!cmd || typeof cmd !== 'string') {
      res.status(400).json({ error: 'Missing cmd parameter' })
      return
    }
    try {
      const resolvedCmd = (cmd === 'bash' && IS_WINDOWS) ? RESOLVED_SHELL : cmd
      const { stdout, stderr } = await execFileAsync(resolvedCmd, args ?? [], { shell: false })
      res.json({ stdout: stdout.trim(), stderr: stderr.trim() })
    } catch (err: any) {
      res.status(500).json({ error: err.message, stdout: '', stderr: err.stderr || '' })
    }
  })
}
