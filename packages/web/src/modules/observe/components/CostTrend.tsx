import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { CostData } from '@/shared/adapters/clawprobe'

interface Props {
  data?: CostData | null
}

export default function CostTrend({ data }: Props) {
  const { t } = useTranslation()

  const chartData = data?.daily?.map((d) => ({
    date: d.date.slice(5), // "03-30"
    input: d.inputTokens,
    output: d.outputTokens,
    cost: d.usd,
  })) ?? []

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="font-medium mb-3">{t('observe.costTrend')}</h3>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v, name) => [
                Number(v).toLocaleString(),
                name === 'input' ? t('observe.inputTokens') : t('observe.outputTokens'),
              ]}
            />
            <Legend
              formatter={(value: string) =>
                value === 'input' ? t('observe.inputTokens') : t('observe.outputTokens')
              }
            />
            <Bar dataKey="input" fill="hsl(220, 90%, 56%)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="output" fill="hsl(160, 70%, 45%)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          {t('observe.noTrendData')}
        </div>
      )}
    </div>
  )
}
