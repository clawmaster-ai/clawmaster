import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { platformResults } from '@/adapters'
import { openclawVersionLabel } from '@/lib/systemVersionLabel'
import { useAdapterCall } from '@/shared/hooks/useAdapterCall'
import { formatAdapterResultError } from '@/shared/adapters/tauriCommandError'
import type { AdapterResult } from '@/shared/adapters/types'
import LoadingState from '@/shared/components/LoadingState'
import OpenClawUninstallWizard from '@/modules/settings/OpenClawUninstallWizard'

export default function Settings() {
  const { t } = useTranslation()
  const fetcher = useCallback(async () => platformResults.detectSystem(), [])
  const { data: systemInfo, loading, error, refetch } = useAdapterCall(fetcher)
  const [uninstallWizardOpen, setUninstallWizardOpen] = useState(false)
  const [restorePath, setRestorePath] = useState('')
  const [snapshotFiles, setSnapshotFiles] = useState<string[]>([])
  const [restoreBusy, setRestoreBusy] = useState(false)

  const refreshBackups = useCallback(async () => {
    const r = await platformResults.listOpenclawBackups()
    if (r.success && r.data) setSnapshotFiles(r.data.files)
  }, [])

  useEffect(() => {
    if (!loading && systemInfo) void refreshBackups()
  }, [loading, systemInfo, refreshBackups])

  function fmtErr(r: AdapterResult<unknown>): string {
    return formatAdapterResultError(r, t)
  }

  async function handleResetConfig() {
    if (!window.confirm(t('settings.resetConfigConfirm'))) {
      return
    }
    if (!window.confirm(t('settings.resetConfigConfirmAgain'))) return
    const r = await platformResults.resetOpenclawConfig()
    if (!r.success) {
      window.alert(t('settings.alertResetFailed', { detail: fmtErr(r) }))
      return
    }
    window.alert(t('settings.alertResetOk'))
    void refetch()
  }

  async function handleRestoreBackup() {
    const p = restorePath.trim()
    if (!p) {
      window.alert(t('settings.alertRestorePathEmpty'))
      return
    }
    if (!window.confirm(t('settings.restoreConfirm'))) {
      return
    }
    setRestoreBusy(true)
    try {
      const r = await platformResults.restoreOpenclawBackup(p)
      if (!r.success) {
        window.alert(t('settings.alertRestoreFailed', { detail: fmtErr(r) }))
        return
      }
      window.alert(t('settings.alertRestoreOk'))
      await refreshBackups()
      void refetch()
    } finally {
      setRestoreBusy(false)
    }
  }

  if (loading) {
    return <LoadingState message={t('settings.loadingSystem')} />
  }

  if (error || !systemInfo) {
    return (
      <div className="py-16 text-center text-sm text-red-500">
        {t('settings.loadFailed')} {error ?? t('common.unknownError')}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('settings.appearance')}</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="w-24 text-sm text-muted-foreground shrink-0">{t('settings.themeLabel')}</span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" name="theme" defaultChecked />
                <span className="text-sm">{t('settings.themeFollowSystem')}</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="theme" />
                <span className="text-sm">{t('settings.themeLight')}</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="theme" />
                <span className="text-sm">{t('settings.themeDarkUi')}</span>
              </label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pl-24">{t('settings.appearanceLangNote')}</p>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('settings.system')}</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            <span className="text-sm">{t('settings.launchAtLogin')}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            <span className="text-sm">{t('settings.showTrayIcon')}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            <span className="text-sm">{t('settings.minimizeToTrayOnClose')}</span>
          </label>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('settings.systemInfo')}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{t('settings.labelOpenClaw')}</span>
            <span className={systemInfo.openclaw.installed ? 'text-green-600' : 'text-red-500'}>
              {systemInfo.openclaw.installed
                ? openclawVersionLabel(systemInfo.openclaw.version, t)
                : t('common.notInstalled')}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{t('settings.labelNode')}</span>
            <span className={systemInfo.nodejs.installed ? 'text-green-600' : 'text-red-500'}>
              {systemInfo.nodejs.installed
                ? systemInfo.nodejs.version.trim() || t('common.unknownVersion')
                : t('common.notInstalled')}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{t('settings.labelNpm')}</span>
            <span className={systemInfo.npm.installed ? 'text-green-600' : 'text-red-500'}>
              {systemInfo.npm.installed
                ? systemInfo.npm.version.trim() || t('common.unknownVersion')
                : t('common.notInstalled')}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{t('settings.labelConfigPath')}</span>
            <span className="font-mono text-xs break-all text-right">{systemInfo.openclaw.configPath}</span>
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('settings.updates')}</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>{t('settings.appNameShort')}</span>
            <span className="text-muted-foreground">{t('settings.appVersionLine')}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>{t('settings.labelOpenClawCli')}</span>
            <span className="text-muted-foreground">
              {systemInfo.openclaw.installed
                ? openclawVersionLabel(systemInfo.openclaw.version, t)
                : t('common.notInstalled')}
            </span>
          </div>
          <button type="button" className="px-4 py-2 border border-border rounded hover:bg-accent">
            {t('settings.checkUpdates')}
          </button>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <span className="text-muted-foreground">{t('settings.updateChannel')}</span>
            <select className="px-3 py-1.5 bg-muted rounded border border-border">
              <option>{t('settings.channelStable')}</option>
              <option>{t('settings.channelBeta')}</option>
              <option>{t('settings.channelDev')}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('settings.restoreSection')}</h3>
        <p className="text-xs text-muted-foreground mb-3">{t('settings.restoreBlurb')}</p>
        {snapshotFiles.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">{t('settings.snapshotsListLabel')}</p>
            <ul className="text-xs font-mono space-y-1 max-h-28 overflow-y-auto bg-muted/50 rounded p-2">
              {snapshotFiles.map((f) => (
                <li key={f}>
                  <button
                    type="button"
                    className="text-left hover:underline text-primary break-all"
                    onClick={() => setRestorePath(f)}
                  >
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="block text-xs text-muted-foreground mb-1">{t('settings.restorePathLabel')}</label>
        <input
          type="text"
          className="w-full px-3 py-2 bg-muted rounded border border-border font-mono text-xs mb-2"
          value={restorePath}
          onChange={(e) => setRestorePath(e.target.value)}
          placeholder={t('settings.restorePathPlaceholder')}
        />
        <button
          type="button"
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          disabled={restoreBusy}
          onClick={() => void handleRestoreBackup()}
        >
          {restoreBusy ? t('settings.restoreBusy') : t('settings.restoreButton')}
        </button>
      </section>

      <section className="bg-card border border-red-500/50 rounded-lg p-4">
        <h3 className="font-medium text-red-500 mb-3">{t('settings.danger')}</h3>
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            className="px-4 py-2 border border-border rounded hover:bg-accent"
            onClick={() => void handleResetConfig()}
          >
            {t('settings.resetConfig')}
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={() => setUninstallWizardOpen(true)}
          >
            {t('settings.uninstallWizard')}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t('settings.dangerHint')}</p>
      </section>

      <OpenClawUninstallWizard
        open={uninstallWizardOpen}
        onClose={() => setUninstallWizardOpen(false)}
        onFinished={() => {
          void refetch()
          void refreshBackups()
        }}
      />

      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-2">{t('settings.about')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('settings.appNameShort')} {t('settings.appVersionLine')}
        </p>
        <p className="text-sm text-muted-foreground">{t('settings.aboutBuiltWith')}</p>
        <p className="text-sm text-muted-foreground">{t('settings.aboutCopyright')}</p>
        <div className="mt-3 flex gap-4 flex-wrap">
          <a
            href="https://docs.openclaw.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            {t('settings.linkDocs')}
          </a>
          <a
            href="https://github.com/openclaw/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            {t('settings.linkGitHub')}
          </a>
          <a
            href="https://clawhub.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            {t('settings.linkClawHub')}
          </a>
        </div>
      </section>
    </div>
  )
}
