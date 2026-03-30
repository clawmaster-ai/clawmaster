import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { SessionSummary } from '@/shared/adapters/clawprobe'

interface Props {
  sessions?: SessionSummary[] | null
}

export default function TokenChart({ sessions }: Props) {
  const { t } = useTranslation()
  const chartData = sessions
    ?.slice(0, 10)
    .map((s) => ({
      name: s.key.length > 8 ? s.key.slice(0, 8) + '...' : s.key,
      input: s.tokens.input,
      output: s.tokens.output,
    })) ?? []

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="font-medium mb-3">{t('observe.tokenChart')}</h3>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="input" name="Input" fill="hsl(220, 90%, 56%)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="output" name="Output" fill="hsl(160, 70%, 45%)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          {t('observe.noTokenData')}
        </div>
      )}
    </div>
  )
}
