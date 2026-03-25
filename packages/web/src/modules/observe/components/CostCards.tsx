import type { CostData } from '@/shared/adapters/clawprobe'

interface Props {
  day?: CostData | null
  week?: CostData | null
  month?: CostData | null
}

export default function CostCards({ day, week, month }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <CostCard label="今日花费" data={day} color="text-blue-600" />
      <CostCard label="本周花费" data={week} color="text-purple-600" />
      <CostCard label="本月花费" data={month} color="text-orange-600" />
    </div>
  )
}

function CostCard({ label, data, color }: { label: string; data?: CostData | null; color: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>
        {data ? `$${data.total.toFixed(2)}` : '—'}
      </p>
      {data?.by_model && (
        <p className="text-xs text-muted-foreground mt-2">
          {Object.keys(data.by_model).length} 个模型
        </p>
      )}
    </div>
  )
}
