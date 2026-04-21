import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Globe,
  Download,
  Loader2,
  Server,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { useInstallTask } from '@/shared/hooks/useInstallTask'
import { InstallTask } from '@/shared/components/InstallTask'
import { BrandMark } from '@/shared/components/BrandMark'
import {
  getOllamaStatus,
  installOllama,
  startOllama,
  pullModel,
  type OllamaStatus,
  formatModelSize,
} from '@/shared/adapters/ollama'
import { changeLanguage } from '@/i18n'
import { getProviderModelCatalogResult } from '@/shared/adapters/openclaw'
import { supportsProviderCatalog } from '@/shared/providerCatalog'
import { getSetupAdapter } from './adapters'
import { CircleReveal } from './CircleReveal'
import {
  PROVIDERS,
  PRIMARY_PROVIDERS,
  PROVIDER_BADGES,
  providerSupportsSetup,
  getProviderCredentialLabel,
  getProviderLabel,
  DEFAULT_ONBOARDING_STATE,
} from './types'
import type {
  CapabilityStatus,
  OnboardingState,
} from './types'

// ─── Simplified phases ───

type WizardPhase =
  | 'detecting'     // checking if OpenClaw is installed
  | 'not_installed' // needs install
  | 'installing'    // npm install -g openclaw in progress
  | 'install_error' // install failed
  | 'onboard_init'  // initializing config
  | 'provider'      // pick provider + API key + model (all in one)
  | 'completing'    // circle reveal animation
  | 'done'          // handed off to main app

interface SetupWizardProps {
  onComplete: () => void
}

// ─── Install state persistence (survives page refresh in both web and Tauri) ───

const INSTALL_STATE_KEY = 'clawmaster-wizard-install'
const INSTALL_STALE_MS = 10 * 60 * 1000

type PersistedInstallState = {
  phase: 'installing' | 'installed'
  startedAt: number
}

function saveInstallState(state: PersistedInstallState) {
  try { localStorage.setItem(INSTALL_STATE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

function loadInstallState(): PersistedInstallState | null {
  try {
    const raw = localStorage.getItem(INSTALL_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedInstallState
    if (Date.now() - parsed.startedAt > INSTALL_STALE_MS) {
      localStorage.removeItem(INSTALL_STATE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function clearInstallState() {
  try { localStorage.removeItem(INSTALL_STATE_KEY) } catch { /* ignore */ }
}

// ─── Install progress simulation ───
// Since the exec endpoint doesn't stream, we simulate phased progress
// and snap to 100% when the real command completes.

const INSTALL_PHASES = [
  { label: 'setup.installPhase.resolve', target: 12, durationMs: 2000 },
  { label: 'setup.installPhase.download', target: 45, durationMs: 8000 },
  { label: 'setup.installPhase.install', target: 82, durationMs: 12000 },
  { label: 'setup.installPhase.link', target: 95, durationMs: 3000 },
] as const

function useSimulatedProgress() {
  const [progress, setProgress] = useState(0)
  const [phaseLabel, setPhaseLabel] = useState('')
  const animRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  const start = useCallback(() => {
    doneRef.current = false
    setProgress(0)
    let phaseIdx = 0
    let phaseStart = Date.now()
    setPhaseLabel(INSTALL_PHASES[0].label)

    function tick() {
      if (doneRef.current) return
      const phase = INSTALL_PHASES[phaseIdx]
      if (!phase) return

      const elapsed = Date.now() - phaseStart
      const prevTarget = phaseIdx > 0 ? INSTALL_PHASES[phaseIdx - 1].target : 0
      const range = phase.target - prevTarget
      const fraction = Math.min(elapsed / phase.durationMs, 1)
      // ease-out curve for natural feel
      const eased = 1 - Math.pow(1 - fraction, 3)
      const current = prevTarget + range * eased

      setProgress(Math.round(current))

      if (fraction >= 1 && phaseIdx < INSTALL_PHASES.length - 1) {
        phaseIdx++
        phaseStart = Date.now()
        setPhaseLabel(INSTALL_PHASES[phaseIdx].label)
      }

      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }, [])

  const finish = useCallback(() => {
    doneRef.current = true
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setProgress(100)
    setPhaseLabel('setup.installPhase.done')
  }, [])

  const reset = useCallback(() => {
    doneRef.current = true
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setProgress(0)
    setPhaseLabel('')
  }, [])

  return { progress, phaseLabel, start, finish, reset }
}

// ─── Main Wizard ───

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t, i18n } = useTranslation()
  const [phase, setPhase] = useState<WizardPhase>('detecting')
  const [engineStatus, setEngineStatus] = useState<CapabilityStatus | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [showReveal, setShowReveal] = useState(false)
  const [useMirror, setUseMirror] = useState(false)
  const [apiKeyVerified, setApiKeyVerified] = useState(false)
  const [catalogModels, setCatalogModels] = useState<Array<{ id: string; name: string }> | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)

  // Provider / model state
  const [onboard, setOnboard] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE)
  const updateOnboard = useCallback(
    (patch: Partial<OnboardingState>) => setOnboard((prev) => ({ ...prev, ...patch })),
    [],
  )

  const adapter = getSetupAdapter()
  const simProgress = useSimulatedProgress()

  // ─── Beforeunload guard during install ───

  useEffect(() => {
    if (phase !== 'installing') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase])

  // ─── Step 1: Detect OpenClaw (with recovery from interrupted install) ───

  const detectEngine = useCallback(async () => {
    const saved = loadInstallState()
    if (saved?.phase === 'installed') {
      clearInstallState()
      setPhase('onboard_init')
      return
    }

    setPhase('detecting')
    setEngineStatus(null)

    try {
      const results = await adapter.detectCapabilities((status) => {
        if (status.id === 'engine') {
          setEngineStatus(status)
        }
      })

      const engine = results.find((r) => r.id === 'engine')
      if (engine?.status === 'installed') {
        clearInstallState()
        setEngineStatus(engine)
        setPhase('onboard_init')
      } else {
        setEngineStatus(engine ?? { id: 'engine', name: 'capability.engine', status: 'not_installed' })
        setPhase('not_installed')
      }
    } catch {
      setEngineStatus({ id: 'engine', name: 'capability.engine', status: 'not_installed' })
      setPhase('not_installed')
    }
  }, [adapter])

  useEffect(() => {
    detectEngine()
  }, [detectEngine])

  // ─── Step 1b: Install OpenClaw ───

  const startInstall = useCallback(async () => {
    setPhase('installing')
    setInstallError(null)
    simProgress.start()
    saveInstallState({ phase: 'installing', startedAt: Date.now() })

    const installOptions = useMirror
      ? { registryUrl: 'https://registry.npmmirror.com' }
      : undefined

    try {
      await adapter.installCapabilities(['engine'], () => {}, installOptions)

      simProgress.finish()
      saveInstallState({ phase: 'installed', startedAt: Date.now() })
      await new Promise((r) => setTimeout(r, 600))
      clearInstallState()
      setPhase('onboard_init')
    } catch (err) {
      simProgress.reset()
      clearInstallState()
      setInstallError(err instanceof Error ? err.message : String(err))
      setPhase('install_error')
    }
  }, [adapter, simProgress, useMirror])

  // ─── Step 1c: Init config ───

  useEffect(() => {
    if (phase !== 'onboard_init') return
    let cancelled = false

    async function init() {
      try {
        await adapter.onboarding.initConfig()
        if (!cancelled) setPhase('provider')
      } catch {
        // Non-fatal: proceed to provider setup anyway
        if (!cancelled) setPhase('provider')
      }
    }
    init()
    return () => { cancelled = true }
  }, [phase, adapter])

  // ─── Step 2: Set API Key ───

  const runSetApiKey = useCallback(async () => {
    const effectiveKey = onboard.provider === 'ollama' ? (onboard.apiKey.trim() || 'ollama') : onboard.apiKey.trim()
    if (!effectiveKey) return
    const providerCfg = PROVIDERS[onboard.provider]
    if (providerCfg?.needsBaseUrl && !onboard.customBaseUrl.trim()) {
      updateOnboard({ error: t('setup.enterBaseUrl') })
      return
    }
    updateOnboard({ busy: true, error: null })
    try {
      const valid = await adapter.onboarding.testApiKey(
        onboard.provider,
        effectiveKey,
        onboard.customBaseUrl.trim() || undefined,
      )
      if (!valid) {
        updateOnboard({
          busy: false,
          error: onboard.provider === 'ollama' ? t('ollama.notRunning') : t('setup.apiKeyInvalid'),
        })
        return
      }
      await adapter.onboarding.setApiKey(
        onboard.provider,
        effectiveKey,
        onboard.customBaseUrl.trim() || undefined,
      )
      setApiKeyVerified(true)
      updateOnboard({ busy: false, model: providerCfg?.defaultModel ?? '', customModelId: '' })

      // Fetch live model catalog in background (non-blocking)
      const runtimeId = providerCfg?.configKeyOverride ?? onboard.provider
      if (supportsProviderCatalog(runtimeId)) {
        setCatalogLoading(true)
        getProviderModelCatalogResult({
          providerId: runtimeId,
          apiKey: effectiveKey,
          baseUrl: onboard.customBaseUrl.trim() || providerCfg?.baseUrl || undefined,
        }).then((result) => {
          if (result.success && result.data?.length) {
            setCatalogModels(result.data.map((m) => ({ id: m.id, name: m.name })))
          }
        }).finally(() => setCatalogLoading(false))
      }
    } catch (err) {
      updateOnboard({ busy: false, error: err instanceof Error ? err.message : String(err) })
    }
  }, [adapter, onboard.provider, onboard.apiKey, onboard.customBaseUrl, updateOnboard, t])

  // ─── Step 2b: Set model and finish ───

  const runSetModelAndFinish = useCallback(async () => {
    const modelId = onboard.model || onboard.customModelId.trim()
    if (!modelId) return
    const providerCfg = PROVIDERS[onboard.provider]
    const configKey = providerCfg?.configKeyOverride ?? onboard.provider
    const fullModelId = `${configKey}/${modelId}`
    updateOnboard({ busy: true, error: null })
    try {
      await adapter.onboarding.setDefaultModel(fullModelId)
      updateOnboard({ busy: false })
      // Trigger reveal animation
      setShowReveal(true)
    } catch (err) {
      updateOnboard({ busy: false, error: err instanceof Error ? err.message : String(err) })
    }
  }, [adapter, onboard.provider, onboard.model, onboard.customModelId, updateOnboard])

  const handleRevealComplete = useCallback(() => {
    clearInstallState()
    onComplete()
  }, [onComplete])

  // ─── API key already validated? Show model picker inline ───
  const apiKeyValidated = apiKeyVerified || (onboard.provider === 'ollama' && Boolean(onboard.apiKey))

  const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'install'

  return (
    <>
      {showReveal && <CircleReveal onComplete={handleRevealComplete} />}
      <div className="fullscreen-shell px-6">
        {/* Language switcher */}
        <div className="setup-language-switcher">
          <LangSwitcher currentLang={i18n.language} onSwitch={changeLanguage} />
        </div>

        {/* ─── Step 1: OpenClaw Detection / Install ─── */}
        {(phase === 'detecting' || phase === 'not_installed' || phase === 'installing' || phase === 'install_error' || phase === 'onboard_init') && (
          <EngineStep
            phase={phase}
            engineStatus={engineStatus}
            installError={installError}
            simProgress={simProgress}
            isDemo={isDemo}
            useMirror={useMirror}
            onMirrorChange={setUseMirror}
            onInstall={startInstall}
            onRetry={detectEngine}
          />
        )}

        {/* ─── Step 2: Provider + Model ─── */}
        {phase === 'provider' && (
          <ProviderModelStep
            onboard={onboard}
            updateOnboard={updateOnboard}
            apiKeyValidated={apiKeyValidated}
            catalogModels={catalogModels}
            catalogLoading={catalogLoading}
            onProviderSwitch={() => { setApiKeyVerified(false); setCatalogModels(null) }}
            onSubmitApiKey={runSetApiKey}
            onSubmitModel={runSetModelAndFinish}
            onSkip={() => setShowReveal(true)}
          />
        )}
      </div>
    </>
  )
}

// ─── Step 1 Component: Engine Detection / Install ───

function EngineStep({
  phase,
  engineStatus,
  installError,
  simProgress,
  isDemo,
  useMirror,
  onMirrorChange,
  onInstall,
  onRetry,
}: {
  phase: string
  engineStatus: CapabilityStatus | null
  installError: string | null
  simProgress: ReturnType<typeof useSimulatedProgress>
  isDemo: boolean
  useMirror: boolean
  onMirrorChange: (value: boolean) => void
  onInstall: () => void
  onRetry: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="wizard-engine-step">
      {/* Hero brand area */}
      <div className="wizard-hero">
        <div className="wizard-brand-ring" data-state={phase}>
          <div className="wizard-brand-ring-track" />
          {(phase === 'detecting' || phase === 'onboard_init') && (
            <div className="wizard-brand-ring-spin" />
          )}
          {(phase === 'installing') && (
            <div
              className="wizard-brand-ring-progress"
              style={{
                background: `conic-gradient(hsl(var(--primary)) ${simProgress.progress * 3.6}deg, transparent 0)`,
              }}
            />
          )}
          <BrandMark animated className="wizard-brand-icon" imageClassName="wizard-brand-icon-img" />
        </div>

        <h1 className="wizard-title">{t('setup.appName')}</h1>
        <p className="wizard-slogan">{t('setup.appSlogan')}</p>

        {isDemo && (
          <span className="wizard-demo-badge">{t('setup.demoMode')}</span>
        )}
      </div>

      {/* Status card */}
      <div className="wizard-status-card">
        <div className="wizard-status-row">
          <div className="wizard-status-icon-wrap" data-status={engineStatus?.status ?? 'checking'}>
            {(!engineStatus || engineStatus.status === 'checking') && (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
            {engineStatus?.status === 'installed' && (
              <CheckCircle2 className="h-5 w-5" />
            )}
            {(engineStatus?.status === 'not_installed' || engineStatus?.status === 'error') && (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="wizard-status-label">OpenClaw Engine</p>
            <p className="wizard-status-detail">
              {phase === 'detecting' && t('setup.detecting')}
              {phase === 'onboard_init' && t('setup.initConfig')}
              {phase === 'not_installed' && t('setup.coreNotInstalled')}
              {phase === 'installing' && t(simProgress.phaseLabel)}
              {phase === 'install_error' && (installError ?? t('setup.unknownError'))}
              {engineStatus?.status === 'installed' && engineStatus.version && `v${engineStatus.version}`}
            </p>
          </div>
          {engineStatus?.status === 'installed' && (
            <span className="wizard-status-tag-ok">{t('common.installed')}</span>
          )}
        </div>

        {/* Install progress bar */}
        {phase === 'installing' && (
          <div className="wizard-progress-track">
            <div
              className="wizard-progress-bar"
              style={{ width: `${simProgress.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Mirror toggle */}
      {(phase === 'not_installed' || phase === 'install_error') && (
        <label className="wizard-mirror-toggle">
          <input
            type="checkbox"
            checked={useMirror}
            onChange={(e) => onMirrorChange(e.target.checked)}
            className="accent-primary"
          />
          <span>{t('setup.useChinaMirror')}</span>
        </label>
      )}

      {/* Action buttons */}
      <div className="wizard-actions">
        {phase === 'not_installed' && (
          <button onClick={onInstall} className="wizard-btn-primary">
            <Download className="h-4 w-4" />
            {t('setup.installCore')}
          </button>
        )}
        {phase === 'install_error' && (
          <>
            <button onClick={onInstall} className="wizard-btn-primary">
              <Download className="h-4 w-4" />
              {t('common.retry')}
            </button>
            <button onClick={onRetry} className="wizard-btn-secondary">
              {t('setup.checking')}
            </button>
          </>
        )}
        {(phase === 'detecting' || phase === 'onboard_init') && (
          <div className="wizard-status-hint">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{phase === 'detecting' ? t('setup.detecting') : t('setup.initConfig')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 2 Component: Provider + API Key + Model ───

const allProviderIds = Object.keys(PROVIDERS).filter(providerSupportsSetup)
const primaryIds = PRIMARY_PROVIDERS as readonly string[]
const secondaryIds = allProviderIds.filter((id) => !primaryIds.includes(id))

function isGoldenSponsor(providerId: string) {
  return PROVIDER_BADGES[providerId as keyof typeof PROVIDER_BADGES] === 'golden-sponsor'
}

function sortProviderIds(providerIds: string[]) {
  return [...providerIds].sort((left, right) => {
    const leftScore = isGoldenSponsor(left) ? 0 : 1
    const rightScore = isGoldenSponsor(right) ? 0 : 1
    if (leftScore !== rightScore) return leftScore - rightScore
    return left.localeCompare(right)
  })
}

function ProviderModelStep({
  onboard,
  updateOnboard,
  apiKeyValidated,
  catalogModels,
  catalogLoading,
  onProviderSwitch,
  onSubmitApiKey,
  onSubmitModel,
  onSkip,
}: {
  onboard: OnboardingState
  updateOnboard: (patch: Partial<OnboardingState>) => void
  apiKeyValidated: boolean
  catalogModels: Array<{ id: string; name: string }> | null
  catalogLoading: boolean
  onProviderSwitch: () => void
  onSubmitApiKey: () => void
  onSubmitModel: () => void
  onSkip: () => void
}) {
  const { t, i18n } = useTranslation()
  const [showMore, setShowMore] = useState(false)
  const visibleIds = sortProviderIds(showMore ? allProviderIds : [...primaryIds])
  const sponsorIds = visibleIds.filter((pid) => isGoldenSponsor(pid))
  const otherIds = visibleIds.filter((pid) => !isGoldenSponsor(pid))
  const providerCfg = PROVIDERS[onboard.provider]
  const credentialLabel = getProviderCredentialLabel(onboard.provider, i18n.language)
  const providerLabel = getProviderLabel(onboard.provider, i18n.language)
  const staticModels = providerCfg?.models ?? []
  const models = catalogModels ?? staticModels

  return (
    <div className="wizard-provider-step">
      {/* Header */}
      <BrandMark animated className="wizard-provider-brand" imageClassName="wizard-brand-icon-img" />
      <h2 className="wizard-provider-title">{t('setup.configureLLM')}</h2>
      <p className="wizard-provider-subtitle">{t('setup.configureLLMDesc')}</p>

      {/* Step indicator */}
      <div className="wizard-step-pills">
        <span className="wizard-pill wizard-pill-done">
          <CheckCircle2 className="h-3.5 w-3.5" />
          OpenClaw
        </span>
        <span className="wizard-pill-divider" />
        <span className="wizard-pill wizard-pill-active">
          <Sparkles className="h-3.5 w-3.5" />
          {t('setup.step.model')}
        </span>
      </div>

      {/* Provider picker */}
      <div className="wizard-card">
        {sponsorIds.length > 0 && (
          <div className="mb-3">
            <p className="wizard-card-kicker">{t('providers.badgeGoldenSponsor')}</p>
            <div className="flex gap-2 flex-wrap mt-2">
              {sponsorIds.map((p) => (
                <ProviderChip
                  key={p}
                  providerId={p}
                  selected={onboard.provider === p}
                  onSelect={() => {
                    onProviderSwitch()
                    updateOnboard({
                      provider: p, apiKey: '', model: '', customModelId: '',
                      customBaseUrl: PROVIDERS[p]?.baseUrl ?? '', error: null,
                    })
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div className="mb-2">
          <p className="wizard-card-kicker">{t('models.recommendedProviders')}</p>
          <div className="flex gap-2 flex-wrap mt-2">
            {otherIds.map((p) => (
              <ProviderChip
                key={p}
                providerId={p}
                selected={onboard.provider === p}
                onSelect={() => {
                  onProviderSwitch()
                  updateOnboard({
                    provider: p, apiKey: '', model: '', customModelId: '',
                    customBaseUrl: PROVIDERS[p]?.baseUrl ?? '', error: null,
                  })
                }}
              />
            ))}
          </div>
        </div>
        {secondaryIds.length > 0 && (
          <button
            onClick={() => setShowMore(!showMore)}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition mt-1"
          >
            {showMore ? t('setup.collapse') : t('setup.moreProviders', { count: secondaryIds.length })}
          </button>
        )}
      </div>

      {/* API Key input (or Ollama panel) */}
      {onboard.provider === 'ollama' ? (
        <OllamaSetupPanel
          onboard={onboard}
          updateOnboard={updateOnboard}
          onSubmit={() => {
            updateOnboard({ apiKey: 'ollama' })
            onSubmitApiKey()
          }}
        />
      ) : (
        <div className="wizard-card">
          {providerCfg?.keyUrl && (
            <a
              href={providerCfg.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block mb-3 text-xs text-primary hover:underline"
            >
              {t('setup.getApiKey', { provider: providerLabel, credential: credentialLabel })}
            </a>
          )}
          {providerCfg?.noteKey && (
            <p className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              {t(providerCfg.noteKey)}
            </p>
          )}
          {providerCfg?.needsBaseUrl && (
            <input
              type="url"
              placeholder={t('setup.baseUrlPlaceholder')}
              value={onboard.customBaseUrl}
              onChange={(e) => updateOnboard({ customBaseUrl: e.target.value })}
              className="control-input mb-2"
            />
          )}
          <input
            type="password"
            placeholder={t('setup.apiKeyPlaceholder', { provider: providerLabel, credential: credentialLabel })}
            value={onboard.apiKey}
            onChange={(e) => updateOnboard({ apiKey: e.target.value })}
            className="control-input"
          />
          {!apiKeyValidated && (
            <button
              onClick={onSubmitApiKey}
              disabled={!onboard.apiKey.trim() || onboard.busy}
              className="wizard-btn-primary mt-3"
            >
              {onboard.busy ? t('setup.verifying') : t('setup.validateAndContinue')}
            </button>
          )}
        </div>
      )}

      {/* Model picker (appears after API key validated) */}
      {apiKeyValidated && onboard.provider !== 'ollama' && (
        <div className="wizard-card wizard-card-appear">
          <div className="flex items-center gap-2 mb-2">
            <p className="wizard-card-kicker">{t('setup.selectModel')}</p>
            {catalogLoading && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('setup.loadingModels')}
              </span>
            )}
            {catalogModels && !catalogLoading && (
              <span className="rounded-full border border-emerald-300/60 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                {t('setup.liveCatalog')}
              </span>
            )}
          </div>
          {models.length > 0 && (
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden max-h-[40vh] overflow-y-auto">
              {models.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/50 transition text-sm"
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={onboard.model === m.id}
                    onChange={() => updateOnboard({ model: m.id, customModelId: '' })}
                    className="accent-primary"
                  />
                  <span>{m.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto font-mono">{m.id}</span>
                </label>
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder={t('setup.modelIdPlaceholder')}
            value={onboard.customModelId}
            onChange={(e) => updateOnboard({ customModelId: e.target.value, model: '' })}
            className="control-input mt-2"
          />
          <button
            onClick={onSubmitModel}
            disabled={(!onboard.model && !onboard.customModelId.trim()) || onboard.busy}
            className="wizard-btn-primary mt-3"
          >
            {onboard.busy ? t('setup.settingModel') : t('setup.enterMaster')}
          </button>
        </div>
      )}

      {/* Error display */}
      {onboard.error && (
        <p className="text-red-500 text-xs mt-2 text-center">{onboard.error}</p>
      )}

      {/* Skip */}
      <button
        onClick={onSkip}
        className="mt-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition"
      >
        {t('setup.skipRemaining')}
      </button>
    </div>
  )
}

// ─── Language switcher (custom styled, no native dropdown) ───

const LANG_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'EN' },
  { value: 'ja', label: '日本語' },
] as const

function LangSwitcher({
  currentLang,
  onSwitch,
}: {
  currentLang: string
  onSwitch: (lang: string) => void
}) {
  return (
    <div className="wizard-lang-switcher" role="radiogroup" aria-label="Language">
      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
      {LANG_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={currentLang.startsWith(opt.value)}
          onClick={() => onSwitch(opt.value)}
          className={`wizard-lang-btn ${currentLang.startsWith(opt.value) ? 'wizard-lang-btn-active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Provider chip button ───

function ProviderChip({
  providerId,
  selected,
  onSelect,
}: {
  providerId: string
  selected: boolean
  onSelect: () => void
}) {
  const { i18n } = useTranslation()
  const isSponsor = isGoldenSponsor(providerId)

  return (
    <button
      onClick={onSelect}
      className={`wizard-provider-chip ${selected ? 'wizard-provider-chip-active' : ''}`}
    >
      <span>{getProviderLabel(providerId, i18n.language)}</span>
      {isSponsor && (
        <span className="wizard-sponsor-tag">
          <Sparkles className="h-3 w-3" />
        </span>
      )}
    </button>
  )
}

// ─── Ollama Setup Panel (reused from old wizard) ───

function OllamaSetupPanel({
  onboard,
  updateOnboard,
  onSubmit,
}: {
  onboard: OnboardingState
  updateOnboard: (patch: Partial<OnboardingState>) => void
  onSubmit: () => void
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<OllamaStatus | null>(null)
  const [checking, setChecking] = useState(true)
  const installTask = useInstallTask()
  const startTask = useInstallTask()
  const pullTask = useInstallTask()

  const checkStatus = useCallback(async () => {
    setChecking(true)
    const result = await getOllamaStatus(
      onboard.customBaseUrl.trim().replace(/\/v1\/?$/, '') || 'http://localhost:11434',
    )
    if (result.success && result.data) {
      setStatus(result.data)
      if (result.data.running && result.data.models.length > 0) {
        updateOnboard({ apiKey: 'ollama' })
      }
    }
    setChecking(false)
  }, [onboard.customBaseUrl, updateOnboard])

  useEffect(() => { checkStatus() }, [checkStatus])

  async function handleInstall() {
    await installTask.run(async () => {
      updateOnboard({ error: null })
      const result = await installOllama()
      if (!result.success) throw new Error(result.error ?? t('ollama.installFailed'))
    })
    await checkStatus()
  }

  async function handleStart() {
    await startTask.run(async () => {
      updateOnboard({ error: null })
      await startOllama()
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const result = await getOllamaStatus(
          onboard.customBaseUrl.trim().replace(/\/v1\/?$/, '') || 'http://localhost:11434',
        )
        if (result.success && result.data?.running) {
          setStatus(result.data)
          updateOnboard({ apiKey: 'ollama' })
          return
        }
      }
      throw new Error(t('ollama.startFailed'))
    })
    await checkStatus()
  }

  async function handlePullModel(modelId: string) {
    await pullTask.run(async () => {
      const result = await pullModel(modelId)
      if (!result.success) {
        throw new Error(result.error ?? t('ollama.installFailed'))
      }
    })
    await checkStatus()
  }

  function handleProceed() {
    updateOnboard({ apiKey: 'ollama' })
    onSubmit()
  }

  if (checking) {
    return (
      <div className="wizard-card flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('ollama.detecting')}
      </div>
    )
  }

  return (
    <div className="wizard-card space-y-4">
      <input
        type="url"
        placeholder="http://localhost:11434/v1"
        value={onboard.customBaseUrl}
        onChange={(e) => updateOnboard({ customBaseUrl: e.target.value })}
        className="control-input"
      />

      {!status?.installed && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">{t('ollama.installTitle')}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{t('ollama.installDesc')}</p>
            {installTask.status === 'idle' && (
              <button onClick={handleInstall} className="wizard-btn-primary">
                {t('ollama.installButton')}
              </button>
            )}
          </div>
          {installTask.status !== 'idle' && (
            <InstallTask label="Ollama" status={installTask.status} error={installTask.error} onRetry={installTask.reset} />
          )}
        </div>
      )}

      {status?.installed && !status?.running && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">{t('ollama.startTitle')}</span>
              <span className="text-xs text-muted-foreground">v{status.version}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{t('ollama.notRunning')}</p>
            {startTask.status === 'idle' && (
              <button onClick={handleStart} className="wizard-btn-primary">
                {t('ollama.startButton')}
              </button>
            )}
          </div>
          {startTask.status !== 'idle' && (
            <InstallTask label="Ollama" description={t('ollama.starting')} status={startTask.status} error={startTask.error} onRetry={startTask.reset} />
          )}
        </div>
      )}

      {status?.installed && status?.running && (
        <>
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-sm">{t('ollama.running')}</span>
              <span className="text-xs text-muted-foreground">v{status.version}</span>
            </div>

            {status.models.length > 0 ? (
              <div className="space-y-2 mb-3">
                <p className="text-xs text-muted-foreground">{t('ollama.availableModels')}</p>
                {status.models.map((m) => (
                  <div key={m.name} className="flex items-center justify-between text-sm px-2 py-1.5 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-mono">{m.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatModelSize(m.size)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">{t('ollama.noModels')}</p>
            )}

            {pullTask.status !== 'idle' && (
              <InstallTask label={pullTask.log ?? ''} status={pullTask.status} error={pullTask.error} onRetry={pullTask.reset} />
            )}
            {pullTask.status === 'idle' && (
              <div className="flex flex-wrap gap-2 mb-3">
                {['llama3.2', 'qwen2.5', 'deepseek-r1', 'gemma3', 'phi4'].map((m) => {
                  const alreadyPulled = status.models.some((sm) => sm.name.startsWith(m))
                  if (alreadyPulled) return null
                  return (
                    <button
                      key={m}
                      onClick={() => { void handlePullModel(m) }}
                      className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-accent flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      {m}
                    </button>
                  )
                })}
              </div>
            )}

            <a
              href="https://ollama.com/library"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              {t('ollama.browseLibrary')}
            </a>
          </div>

          {onboard.error && <p className="text-red-500 text-xs">{onboard.error}</p>}

          <button
            onClick={handleProceed}
            disabled={onboard.busy || status.models.length === 0}
            className="wizard-btn-primary"
          >
            {onboard.busy ? t('setup.verifying') : t('setup.enterMaster')}
          </button>
        </>
      )}
    </div>
  )
}
