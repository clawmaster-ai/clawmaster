import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
  children?: ReactNode
  panelClassName?: string
  headerClassName?: string
  bodyClassName?: string
  actionsClassName?: string
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  busy = false,
  onCancel,
  onConfirm,
  children,
  panelClassName,
  headerClassName,
  bodyClassName,
  actionsClassName,
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="absolute inset-0" aria-hidden="true" onClick={busy ? undefined : onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className={cn(
          'relative z-10 w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-border/80 bg-background shadow-2xl',
          panelClassName,
        )}
      >
        <div className={cn('px-5 pt-5 sm:px-6 sm:pt-6', headerClassName)}>
          <div className="flex min-w-0 items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${tone === 'danger' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border/70 bg-muted/60 text-foreground'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 id="confirm-dialog-title" className="text-[1.2rem] font-semibold tracking-tight text-foreground">
                {title}
              </h3>
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </div>
        </div>

        {children ? <div className={cn('px-5 pb-0 pt-4 sm:px-6', bodyClassName)}>{children}</div> : null}

        <div className={cn('flex flex-wrap justify-end gap-3 px-5 pb-5 pt-6 sm:px-6 sm:pb-6', actionsClassName)}>
          <button type="button" onClick={onCancel} disabled={busy} className="button-secondary">
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={tone === 'danger' ? 'button-danger' : 'button-primary'}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
