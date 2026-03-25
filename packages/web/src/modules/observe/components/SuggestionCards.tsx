import type { Suggestion } from '@/shared/adapters/clawprobe'

interface Props {
  suggestions: Suggestion[]
}

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200 dark:border-red-800', icon: '🔴', text: 'text-red-700 dark:text-red-400' },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-950', border: 'border-yellow-200 dark:border-yellow-800', icon: '🟡', text: 'text-yellow-700 dark:text-yellow-400' },
  info: { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200 dark:border-blue-800', icon: '🔵', text: 'text-blue-700 dark:text-blue-400' },
}

export default function SuggestionCards({ suggestions }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="font-medium">优化建议</h3>
      {suggestions.map((s, i) => {
        const style = SEVERITY_STYLES[s.severity] || SEVERITY_STYLES.info
        return (
          <div key={i} className={`${style.bg} border ${style.border} rounded-lg p-4`}>
            <div className="flex items-start gap-2">
              <span>{style.icon}</span>
              <div>
                <p className={`text-sm font-medium ${style.text}`}>{s.message}</p>
                {s.detail && <p className="text-xs text-muted-foreground mt-1">{s.detail}</p>}
                <p className="text-xs text-muted-foreground mt-1 font-mono">{s.rule}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
