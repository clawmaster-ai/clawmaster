import { useState } from 'react'
import { Eye, EyeOff, Copy } from 'lucide-react'

interface PasswordFieldProps {
  value: string
  className?: string
}

/**
 * API Key / Token 脱敏显示组件
 * 默认显示 sk-••••1234 格式，点击眼睛图标切换完整显示
 */
export function PasswordField({ value, className = '' }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  function maskValue(v: string): string {
    if (v.length <= 8) return '••••••••'
    const prefix = v.slice(0, 3)
    const suffix = v.slice(-4)
    return `${prefix}${'•'.repeat(Math.min(v.length - 7, 8))}${suffix}`
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="font-mono text-sm flex-1 truncate">
        {visible ? value : maskValue(value)}
      </span>
      <button
        onClick={() => setVisible(!visible)}
        className="text-muted-foreground hover:text-foreground flex-shrink-0"
        title={visible ? '隐藏' : '显示'}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        className="text-muted-foreground hover:text-foreground flex-shrink-0"
        title="复制"
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  )
}
