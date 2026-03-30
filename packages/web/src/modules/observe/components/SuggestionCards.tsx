import { useTranslation } from 'react-i18next'
import type { Suggestion } from '@/shared/adapters/clawprobe'

interface Props {
  suggestions: Suggestion[]
}

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-950', border: 'border-yellow-200 dark:border-yellow-800', dot: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400' },
  info: { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
}

export default function SuggestionCards({ suggestions }: Props) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <h3 className="font-medium">{t('observe.suggestions')}</h3>
      {suggestions.map((s, i) => {
        const style = SEVERITY_STYLES[s.severity] || SEVERITY_STYLES.info
        return (
          <div key={i} className={`${style.bg} border ${style.border} rounded-lg p-4`}>
            <div className="flex items-start gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${style.dot} mt-1 shrink-0`} />
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
