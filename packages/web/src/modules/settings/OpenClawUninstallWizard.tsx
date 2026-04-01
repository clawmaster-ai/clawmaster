import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { platformResults } from '@/adapters'
import { formatAdapterResultError } from '@/shared/adapters/tauriCommandError'
import type { AdapterResult } from '@/shared/adapters/types'
import type { BackupDefaults, CreateBackupResponse } from '@/shared/adapters/dangerSettings'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const kb = n / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}

type BackupChoice = 'desktop' | 'snapshots' | 'custom' | 'skip' | null

type Step =
  | 'intro'
  | 'backup'
  | 'skip-confirm'
  | 'npm'
  | 'remove-data'
  | 'done'

export default function OpenClawUninstallWizard(props: {
  open: boolean
  onClose: () => void
  onFinished: () => void
}) {
  const { t } = useTranslation()
  const { open, onClose, onFinished } = props
  const [step, setStep] = useState<Step>('intro')
  const [defaults, setDefaults] = useState<BackupDefaults | null>(null)
  const [defaultsErr, setDefaultsErr] = useState<string | null>(null)
  const [choice, setChoice] = useState<BackupChoice>(null)
  const [customDir, setCustomDir] = useState('')
  const [skipInput, setSkipInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [backupResult, setBackupResult] = useState<CreateBackupResponse | null>(null)
  const [removeConfirm, setRemoveConfirm] = useState('')

  const fmt = useCallback((r: AdapterResult<unknown>) => formatAdapterResultError(r, t), [t])

  const loadDefaults = useCallback(async () => {
    setDefaultsErr(null)
    const r = await platformResults.getBackupDefaults()
    if (!r.success || !r.data) {
      setDefaultsErr(!r.success ? fmt(r) : t('settings.uninstall.errDefaults'))
      return
    }
    setDefaults(r.data)
    setCustomDir(r.data.desktopDir)
    setChoice('snapshots')
  }, [fmt, t])

  useEffect(() => {
    if (!open) return
    void loadDefaults()
    setStep('intro')
    setChoice(null)
    setSkipInput('')
    setErr(null)
    setBackupResult(null)
    setRemoveConfirm('')
    setBusy(false)
  }, [open, loadDefaults])

  if (!open) return null

  async function runBackup() {
    setBusy(true)
    setErr(null)
    try {
      if (choice === 'skip') {
        setBackupResult(null)
        setStep('npm')
        return
      }
      const mode = choice === 'custom' ? 'custom' : choice === 'snapshots' ? 'snapshots' : 'desktop'
      const exportDir = choice === 'custom' ? customDir.trim() : undefined
      const r = await platformResults.createOpenclawBackup({
        mode,
        exportDir: mode === 'custom' ? exportDir : undefined,
      })
      if (!r.success || !r.data) {
        setErr(fmt(r as AdapterResult<unknown>))
        return
      }
      setBackupResult(r.data)
      setStep('npm')
    } finally {
      setBusy(false)
    }
  }

  async function runNpm() {
    setBusy(true)
    setErr(null)
    try {
      const r = await platformResults.uninstallOpenclawCli()
      if (!r.success || r.data == null) {
        setErr(fmt(r as AdapterResult<unknown>))
        return
      }
      const { ok, code, stdout, stderr } = r.data
      const log = [stdout, stderr].filter(Boolean).join('\n')
      if (!ok) {
        setErr(t('settings.uninstall.errNpmExit', { code: String(code), log: log.slice(0, 800) }))
        return
      }
      setStep('remove-data')
    } finally {
      setBusy(false)
    }
  }

  async function runRemoveData() {
    setBusy(true)
    setErr(null)
    try {
      const r = await platformResults.removeOpenclawData()
      if (!r.success) {
        setErr(fmt(r))
        return
      }
      setStep('done')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-semibold">{t('settings.uninstall.wizardTitle')}</h2>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xl leading-none px-2"
            onClick={onClose}
            aria-label={t('settings.uninstall.close')}
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          {err && (
            <div className="rounded border border-red-500/50 bg-red-500/10 text-red-600 px-3 py-2 whitespace-pre-wrap">
              {err}
            </div>
          )}

          {step === 'intro' && (
            <>
              <p>{t('settings.uninstall.introP1')}</p>
              <p className="text-muted-foreground">{t('settings.uninstall.introP2')}</p>
              <button
                type="button"
                className="w-full py-2 bg-primary text-primary-foreground rounded"
                onClick={() => setStep('backup')}
              >
                {t('settings.uninstall.nextBackup')}
              </button>
            </>
          )}

          {step === 'backup' && (
            <>
              <p className="font-medium">{t('settings.uninstall.step1Title')}</p>
              {defaultsErr && <p className="text-red-500">{defaultsErr}</p>}
              {defaults && (
                <>
                  <div className="rounded border border-primary/30 bg-primary/5 px-3 py-2 text-sm space-y-1">
                    <p className="font-medium text-foreground">{t('settings.uninstall.defaultPathTitle')}</p>
                    <code className="block break-all text-xs bg-background/80 px-2 py-1.5 rounded border border-border">
                      {defaults.defaultBackupPath ?? defaults.snapshotsDir}
                    </code>
                    <p className="text-xs text-muted-foreground">{t('settings.uninstall.defaultPathHint')}</p>
                  </div>
                  <ul className="text-muted-foreground text-xs space-y-1">
                    <li>
                      {t('settings.uninstall.dataDir')}{' '}
                      <code className="bg-muted px-1 rounded break-all">{defaults.dataDir}</code>
                    </li>
                    <li>
                      {t('settings.uninstall.desktopExport')}{' '}
                      <code className="bg-muted px-1 rounded break-all">{defaults.desktopDir}</code>
                    </li>
                  </ul>
                </>
              )}
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bk"
                    checked={choice === 'desktop'}
                    onChange={() => setChoice('desktop')}
                  />
                  <span>{t('settings.uninstall.optDesktop')}</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bk"
                    checked={choice === 'snapshots'}
                    onChange={() => setChoice('snapshots')}
                  />
                  <span>{t('settings.uninstall.optSnapshots')}</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bk"
                    checked={choice === 'custom'}
                    onChange={() => setChoice('custom')}
                  />
                  <span>{t('settings.uninstall.optCustom')}</span>
                </label>
                {choice === 'custom' && (
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-muted rounded border border-border font-mono text-xs"
                    value={customDir}
                    onChange={(e) => setCustomDir(e.target.value)}
                    placeholder={t('settings.uninstall.customPlaceholder')}
                  />
                )}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bk"
                    checked={choice === 'skip'}
                    onChange={() => setChoice('skip')}
                  />
                  <span className="text-red-600 font-medium">{t('settings.uninstall.optSkip')}</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button type="button" className="flex-1 py-2 border rounded" onClick={() => setStep('intro')}>
                  {t('settings.uninstall.back')}
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
                  disabled={!choice || busy}
                  onClick={() => {
                    if (choice === 'skip') {
                      setStep('skip-confirm')
                      return
                    }
                    void runBackup()
                  }}
                >
                  {choice === 'skip'
                    ? t('settings.uninstall.next')
                    : busy
                      ? t('settings.uninstall.packing')
                      : t('settings.uninstall.createBackupContinue')}
                </button>
              </div>
            </>
          )}

          {step === 'skip-confirm' && (
            <>
              <p className="text-red-600">{t('settings.uninstall.skipConfirmP1')}</p>
              <p>{t('settings.uninstall.skipConfirmP2')}</p>
              <input
                type="text"
                className="w-full px-3 py-2 bg-muted rounded border border-border"
                value={skipInput}
                onChange={(e) => setSkipInput(e.target.value)}
                placeholder={t('settings.uninstall.skipPlaceholder')}
              />
              <div className="flex gap-2">
                <button type="button" className="flex-1 py-2 border rounded" onClick={() => setStep('backup')}>
                  {t('settings.uninstall.back')}
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 bg-primary text-primary-foreground rounded"
                  disabled={skipInput !== 'SKIP' || busy}
                  onClick={() => void runBackup()}
                >
                  {t('settings.uninstall.confirmSkip')}
                </button>
              </div>
            </>
          )}

          {step === 'npm' && (
            <>
              <p className="font-medium">{t('settings.uninstall.step2Title')}</p>
              {backupResult && (
                <div className="rounded bg-muted/50 p-3 text-xs space-y-1">
                  <p className="font-medium text-green-600">{t('settings.uninstall.backupSaved')}</p>
                  <p className="break-all font-mono">{backupResult.path}</p>
                  <p>
                    {t('settings.uninstall.sizeChecksum', {
                      size: formatBytes(backupResult.size),
                      checksum: backupResult.checksum,
                    })}
                  </p>
                  <p className="text-muted-foreground mt-2">{t('settings.uninstall.restoreHint')}</p>
                </div>
              )}
              {!backupResult && choice === 'skip' && (
                <p className="text-yellow-600 text-xs">{t('settings.uninstall.skippedBackupWarn')}</p>
              )}
              <p>{t('settings.uninstall.willRun')}</p>
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                npm uninstall -g openclaw{'\n'}npm uninstall -g clawhub
              </pre>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2 border rounded"
                  onClick={() => setStep(backupResult ? 'backup' : 'skip-confirm')}
                >
                  {t('settings.uninstall.back')}
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 bg-red-500 text-white rounded disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void runNpm()}
                >
                  {busy ? t('settings.uninstall.running') : t('settings.uninstall.runUninstall')}
                </button>
              </div>
            </>
          )}

          {step === 'remove-data' && (
            <>
              <p className="font-medium text-green-600">{t('settings.uninstall.npmDoneTitle')}</p>
              <p>{t('settings.uninstall.removeDataAsk')}</p>
              <p className="text-muted-foreground text-xs break-all">{defaults?.dataDir}</p>
              <p className="text-xs text-muted-foreground">{t('settings.uninstall.keepConfigHint')}</p>
              <input
                type="text"
                className="w-full px-3 py-2 bg-muted rounded border border-border"
                value={removeConfirm}
                onChange={(e) => setRemoveConfirm(e.target.value)}
                placeholder={t('settings.uninstall.deletePlaceholder')}
              />
              <div className="flex gap-2">
                <button type="button" className="flex-1 py-2 border rounded" onClick={() => setStep('done')}>
                  {t('settings.uninstall.skipKeepData')}
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 bg-red-600 text-white rounded disabled:opacity-50"
                  disabled={removeConfirm !== 'DELETE' || busy}
                  onClick={() => void runRemoveData()}
                >
                  {busy ? t('settings.uninstall.deleting') : t('settings.uninstall.deleteDataDir')}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <>
              <p className="font-medium">{t('settings.uninstall.doneTitle')}</p>
              <p className="text-muted-foreground">{t('settings.uninstall.doneBlurb')}</p>
              <button
                type="button"
                className="w-full py-2 bg-primary text-primary-foreground rounded"
                onClick={() => {
                  onFinished()
                  onClose()
                }}
              >
                {t('settings.uninstall.closeDone')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
