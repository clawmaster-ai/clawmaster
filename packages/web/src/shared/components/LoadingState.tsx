import { useTranslation } from 'react-i18next'

interface LoadingStateProps {
  /** 提示文案，默认"加载中..." */
  message?: string
  /** 是否全屏居中，默认 true */
  fullPage?: boolean
}

/**
 * 统一加载状态组件
 *
 * @example
 * if (loading) return <LoadingState />
 * if (loading) return <LoadingState message="正在获取费用数据..." />
 */
export function LoadingState({ message, fullPage = true }: LoadingStateProps) {
  const { t } = useTranslation()
  const displayMessage = message ?? t('common.loading')
  const wrapperClass = fullPage
    ? 'flex flex-col items-center justify-center h-full p-8'
    : 'flex flex-col items-center p-4'

  return (
    <div className={wrapperClass}>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">{displayMessage}</p>
    </div>
  )
}
