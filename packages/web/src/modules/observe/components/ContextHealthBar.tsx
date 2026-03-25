import type { ContextHealth } from '@/shared/adapters/clawprobe'

interface Props {
  data?: ContextHealth | null
}

export default function ContextHealthBar({ data }: Props) {
  const utilization = data?.utilization ?? 0
  const color =
    utilization > 90 ? 'bg-red-500' : utilization > 70 ? 'bg-yellow-500' : 'bg-green-500'
  const textColor =
    utilization > 90 ? 'text-red-600' : utilization > 70 ? 'text-yellow-600' : 'text-green-600'

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="font-medium mb-3">上下文健康度</h3>

      {data ? (
        <div className="space-y-4">
          {/* 进度条 */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">窗口占用</span>
              <span className={`font-medium ${textColor}`}>{utilization.toFixed(1)}%</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
          </div>

          {/* 详细信息 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">已用 Token</p>
              <p className="font-medium">{data.usedTokens?.toLocaleString() ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">最大 Token</p>
              <p className="font-medium">{data.maxTokens?.toLocaleString() ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">压缩次数</p>
              <p className="font-medium">{data.compactionCount ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">截断文件</p>
              <p className="font-medium">{data.truncated?.length ?? 0}</p>
            </div>
          </div>

          {/* 截断告警 */}
          {data.truncated && data.truncated.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-3">
              <p className="text-sm text-red-600 font-medium">以下文件被截断：</p>
              <ul className="text-xs text-red-500 mt-1 space-y-0.5">
                {data.truncated.map((f) => (
                  <li key={f} className="font-mono">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">
          暂无上下文数据
        </div>
      )}
    </div>
  )
}
