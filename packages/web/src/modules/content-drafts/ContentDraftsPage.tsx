import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileImage, FileText, FolderOpen, Link as LinkIcon, RefreshCw, Sparkles } from 'lucide-react'
import type { ContentDraftImageFile, ContentDraftVariantSummary } from '@/lib/types'
import {
  getContentDraftVariantsResult,
  readContentDraftImageResult,
  readContentDraftTextResult,
} from '@/shared/adapters/contentDrafts'
import { ActionBanner } from '@/shared/components/ActionBanner'
import { LoadingState } from '@/shared/components/LoadingState'
import { useAdapterCall } from '@/shared/hooks/useAdapterCall'

interface DraftImagePreview {
  name: string
  src: string
  mimeType: string
}

function formatSavedAt(value: string | null, fallback: string): string {
  if (!value) return fallback
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function platformLabel(platform: string, t: (key: string) => string): string {
  if (platform === 'xhs') return t('contentDrafts.platform.xhs')
  if (platform === 'wechat') return t('contentDrafts.platform.wechat')
  return platform
}

function joinFilePath(dir: string, fileName: string): string {
  if (!dir) return fileName
  if (dir.endsWith('/') || dir.endsWith('\\')) return `${dir}${fileName}`
  return `${dir}${dir.includes('\\') ? '\\' : '/'}${fileName}`
}

function imageFileToObjectUrl(file: ContentDraftImageFile): string {
  const bytes = Uint8Array.from(file.bytes)
  const blob = new Blob([bytes], { type: file.mimeType })
  return URL.createObjectURL(blob)
}

export default function ContentDraftsPage() {
  const { t } = useTranslation()
  const variantsState = useAdapterCall(getContentDraftVariantsResult, { pollInterval: 30_000 })
  const [query, setQuery] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [images, setImages] = useState<DraftImagePreview[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const imageUrlsRef = useRef<string[]>([])

  const variants = variantsState.data ?? []
  const platforms = useMemo(
    () => [...new Set(variants.map((item) => item.platform))].sort(),
    [variants],
  )
  const filteredVariants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return variants.filter((variant) => {
      if (selectedPlatform !== 'all' && variant.platform !== selectedPlatform) {
        return false
      }
      if (!normalizedQuery) return true
      return [
        variant.title ?? '',
        variant.runId,
        variant.platform,
        variant.sourceUrl ?? '',
        variant.slug ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [query, selectedPlatform, variants])

  const selectedVariant = filteredVariants.find((variant) => variant.id === selectedId) ?? filteredVariants[0] ?? null

  useEffect(() => {
    if (!selectedVariant) {
      setSelectedId(null)
      setDraftContent('')
      setImages([])
      setDetailError(null)
      return
    }
    if (selectedId !== selectedVariant.id) {
      setSelectedId(selectedVariant.id)
    }
  }, [selectedId, selectedVariant])

  useEffect(() => {
    return () => {
      for (const url of imageUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedVariant) return
    let cancelled = false

    async function loadVariant(variant: ContentDraftVariantSummary) {
      setDetailLoading(true)
      setDetailError(null)
      const textResult = await readContentDraftTextResult(variant.draftPath)
      if (!textResult.success || !textResult.data) {
        if (!cancelled) {
          setDraftContent('')
          setImages([])
          setDetailError(textResult.error ?? t('common.requestFailed'))
          setDetailLoading(false)
        }
        return
      }

      const imageResults = await Promise.all(
        variant.imageFiles.map(async (fileName) => ({
          fileName,
          result: await readContentDraftImageResult(joinFilePath(variant.imagesDir, fileName)),
        })),
      )

      if (cancelled) return

      for (const url of imageUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
      imageUrlsRef.current = []

      const nextImages = imageResults
        .filter((entry) => entry.result.success && entry.result.data)
        .map((entry) => {
          const src = imageFileToObjectUrl(entry.result.data!)
          imageUrlsRef.current.push(src)
          return {
            name: entry.fileName,
            src,
            mimeType: entry.result.data!.mimeType,
          }
        })

      setDraftContent(textResult.data.content)
      setImages(nextImages)
      setDetailLoading(false)
    }

    void loadVariant(selectedVariant)

    return () => {
      cancelled = true
    }
  }, [selectedVariant, t])

  const latestSavedAt = variants[0]?.savedAt ?? null

  return (
    <div className="page-shell page-shell-bleed">
      {detailError ? (
        <ActionBanner tone="error" message={detailError} onDismiss={() => setDetailError(null)} />
      ) : null}

      <div className="page-header">
        <div className="page-header-copy">
          <div className="page-header-meta">
            <span>{t('contentDrafts.kicker')}</span>
            <span>{t('contentDrafts.metrics.variants', { count: variants.length })}</span>
            <span>{t('contentDrafts.metrics.platforms', { count: platforms.length })}</span>
          </div>
          <h1 className="page-title">{t('contentDrafts.title')}</h1>
          <p className="page-subtitle">{t('contentDrafts.subtitle')}</p>
        </div>
        <button type="button" onClick={() => void variantsState.refetch()} className="button-secondary">
          <RefreshCw className={`h-4 w-4 ${variantsState.loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard label={t('contentDrafts.metrics.variantsLabel')} value={String(variants.length)} icon={FileText} />
        <MetricCard label={t('contentDrafts.metrics.platformsLabel')} value={String(platforms.length)} icon={Sparkles} />
        <MetricCard
          label={t('contentDrafts.metrics.latestLabel')}
          value={formatSavedAt(latestSavedAt, t('contentDrafts.metrics.none'))}
          icon={FolderOpen}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
        <div className="surface-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('contentDrafts.libraryTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('contentDrafts.libraryBody')}</p>
            </div>
            <Link to="/skills" className="button-secondary">
              {t('contentDrafts.openSkills')}
            </Link>
          </div>

          <div className="space-y-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('contentDrafts.searchPlaceholder')}
              className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedPlatform('all')}
                className={`pill-button ${selectedPlatform === 'all' ? 'pill-button-active' : 'pill-button-inactive'}`}
              >
                {t('contentDrafts.platform.all')}
              </button>
              {platforms.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setSelectedPlatform(platform)}
                  className={`pill-button ${selectedPlatform === platform ? 'pill-button-active' : 'pill-button-inactive'}`}
                >
                  {platformLabel(platform, t)}
                </button>
              ))}
            </div>
          </div>

          {variantsState.loading && !variants.length ? (
            <LoadingState message={t('common.loading')} fullPage={false} />
          ) : filteredVariants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">{t('contentDrafts.emptyTitle')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t('contentDrafts.emptyBody')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVariants.map((variant) => {
                const active = selectedVariant?.id === variant.id
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedId(variant.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      active
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/70 bg-background hover:border-primary/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {variant.title ?? variant.runId}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{variant.runId}</p>
                      </div>
                      <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                        {platformLabel(variant.platform, t)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{formatSavedAt(variant.savedAt, t('contentDrafts.metrics.none'))}</span>
                      <span>{t('contentDrafts.imageCount', { count: variant.imageFiles.length })}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="surface-card space-y-5" aria-live="polite">
          {!selectedVariant ? (
            <div className="rounded-2xl border border-dashed border-border/70 px-5 py-12 text-center">
              <p className="text-sm font-medium text-foreground">{t('contentDrafts.previewEmptyTitle')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t('contentDrafts.previewEmptyBody')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {selectedVariant.title ?? selectedVariant.runId}
                    </h2>
                    <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                      {platformLabel(selectedVariant.platform, t)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedVariant.runId}</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{t('contentDrafts.savedAt')}</p>
                  <p className="font-medium text-foreground">
                    {formatSavedAt(selectedVariant.savedAt, t('contentDrafts.metrics.none'))}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MetaItem label={t('contentDrafts.metaDraftPath')} value={selectedVariant.draftPath} />
                <MetaItem label={t('contentDrafts.metaImages')} value={String(selectedVariant.imageFiles.length)} />
                <MetaItem label={t('contentDrafts.metaSource')} value={selectedVariant.sourceUrl ?? t('common.notSet')} />
              </div>

              {selectedVariant.sourceUrl ? (
                <a
                  href={selectedVariant.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-sky-600 hover:text-sky-500 dark:text-sky-300"
                >
                  <LinkIcon className="h-4 w-4" />
                  {selectedVariant.sourceUrl}
                </a>
              ) : null}

              {detailLoading ? (
                <LoadingState message={t('contentDrafts.loadingPreview')} fullPage={false} />
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">{t('contentDrafts.markdownTitle')}</p>
                    </div>
                    <textarea
                      value={draftContent}
                      readOnly
                      className="min-h-80 w-full rounded-2xl border border-border/70 bg-muted/20 p-4 font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">{t('contentDrafts.imagesTitle')}</p>
                    </div>
                    {images.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/70 px-5 py-8 text-center text-sm text-muted-foreground">
                        {t('contentDrafts.imagesEmpty')}
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {images.map((image) => (
                          <figure key={image.name} className="overflow-hidden rounded-[24px] border border-border/70 bg-background">
                            <img src={image.src} alt={image.name} className="aspect-[4/3] w-full object-cover" />
                            <figcaption className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
                              <span className="truncate">{image.name}</span>
                              <span>{image.mimeType}</span>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof FileText
}) {
  return (
    <div className="surface-card-muted flex items-start justify-between gap-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </div>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/70">
        <Icon className="h-5 w-5 text-foreground" />
      </span>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-all text-sm text-foreground">{value}</p>
    </div>
  )
}
