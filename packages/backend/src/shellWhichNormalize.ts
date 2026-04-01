/**
 * zsh/bash `command -v foo` can print `alias foo=/absolute/path` when foo is an alias.
 * Node `execFile` must receive a real filesystem path or a single PATH token — not that whole line.
 */
export function normalizeLoginShellWhichLine(line: string | undefined): string | null {
  const s = line?.trim().split(/\r?\n/)[0]?.trim() ?? ''
  if (!s) return null
  const m = /^alias\s+[a-zA-Z0-9_.+-]+\s*=\s*(.+)$/.exec(s)
  let v = m ? m[1].trim() : s
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  if (!v) return null
  if (/\s/.test(v) && !v.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(v)) {
    return null
  }
  return v
}
