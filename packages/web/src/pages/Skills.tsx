import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { platform } from '@/adapters'
import { Camera, Receipt, BookOpen, type LucideIcon } from 'lucide-react'
import type { SkillInfo } from '@/lib/types'

export default function Skills() {
  const { t } = useTranslation()

  // ─── 场景推荐数据 ───
  const RECOMMENDED_SCENES: Array<{ id: string; title: string; desc: string; skills: string[]; icon: LucideIcon }> = [
    {
      id: 'photo-qa',
      title: t('skills.photoQa'),
      desc: t('skills.photoQaDesc'),
      skills: ['paddleocr-doc-parsing', 'paddleocr-text-recognition'],
      icon: Camera,
    },
    {
      id: 'invoice',
      title: t('skills.invoice'),
      desc: t('skills.invoiceDesc'),
      skills: ['paddleocr-doc-parsing'],
      icon: Receipt,
    },
    {
      id: 'mistakes',
      title: t('skills.mistakes'),
      desc: t('skills.mistakesDesc'),
      skills: ['paddleocr-text-recognition'],
      icon: BookOpen,
    },
  ]
  const [installedSkills, setInstalledSkills] = useState<SkillInfo[]>([])
  const [searchResults, setSearchResults] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [operating, setOperating] = useState<string | null>(null)
  const [view, setView] = useState<'installed' | 'market'>('installed')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadSkills()
  }, [])

  async function loadSkills() {
    try {
      setLoading(true)
      const skills = await platform.getSkills()
      setInstalledSkills(skills)
    } catch (err) {
      console.error('Failed to load skills:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    try {
      setSearching(true)
      const results = await platform.searchSkills(searchQuery)
      setSearchResults(results)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  async function handleInstall(slug: string) {
    try {
      setOperating(slug)
      await platform.installSkill(slug)
      await loadSkills()
    } catch (err: any) {
      alert(t('skills.installFailed', { message: err.message }))
    } finally {
      setOperating(null)
    }
  }

  async function handleUninstall(slug: string) {
    if (!confirm(t('skills.confirmUninstall', { slug }))) return
    try {
      setOperating(slug)
      await platform.uninstallSkill(slug)
      await loadSkills()
    } catch (err: any) {
      alert(t('skills.uninstallFailed', { message: err.message }))
    } finally {
      setOperating(null)
    }
  }

  const filteredSkills = installedSkills.filter(
    (skill) =>
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64">{t('common.loading')}</div>
  }

  async function handleSceneInstall(skills: string[]) {
    setOperating('scene')
    try {
      for (const slug of skills) {
        await platform.installSkill(slug)
      }
      await loadSkills()
    } catch (err: any) {
      alert(t('skills.installFailed', { message: err.message }))
    } finally {
      setOperating(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('skills.title')}</h1>

      {/* 场景推荐 */}
      <div>
        <h3 className="font-medium mb-3">{t('skills.recommendedScenes')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {RECOMMENDED_SCENES.map((scene) => (
            <div key={scene.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <scene.icon className="w-6 h-6 text-primary" />
                <span className="font-medium">{scene.title}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{scene.desc}</p>
              <button
                onClick={() => handleSceneInstall(scene.skills)}
                disabled={operating === 'scene'}
                className="w-full py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {operating === 'scene' ? t('skills.installing') : t('skills.oneClickInstall')}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setView('installed')}
          className={`px-4 py-2 rounded-lg text-sm ${view === 'installed' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-accent'}`}
        >
          {t('skills.installed', { count: installedSkills.length })}
        </button>
        <button
          onClick={() => setView('market')}
          className={`px-4 py-2 rounded-lg text-sm ${view === 'market' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-accent'}`}
        >
          {t('skills.searchMarket')}
        </button>
      </div>

      {view === 'installed' ? (
        <>
          <input
            type="text"
            placeholder={t('skills.filterPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-card rounded-lg border border-border text-sm"
          />

          {filteredSkills.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {installedSkills.length === 0 ? t('skills.noInstalled') : t('skills.noMatch')}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredSkills.map((skill) => (
                <div
                  key={skill.slug}
                  className="bg-card border border-border rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{skill.name}</span>
                      <span className="text-sm text-muted-foreground">{skill.version}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{skill.description}</p>
                  </div>
                  <button
                    onClick={() => handleUninstall(skill.slug)}
                    disabled={operating === skill.slug}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent text-red-500 disabled:opacity-50"
                  >
                    {operating === skill.slug ? t('skills.processing') : t('skills.uninstall')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t('skills.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-2 bg-card rounded-lg border border-border text-sm"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {searching ? t('common.searching') : t('common.search')}
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((skill) => (
                <div
                  key={skill.slug}
                  className="bg-card border border-border rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{skill.name}</span>
                      <span className="text-sm text-muted-foreground">{skill.version}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{skill.description}</p>
                  </div>
                  <button
                    onClick={() => handleInstall(skill.slug)}
                    disabled={operating === skill.slug}
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {operating === skill.slug ? t('skills.installing') : t('skills.install')}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              {t('skills.searchHint')}
            </p>
          )}

          <a
            href="https://clawhub.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm"
          >
            {t('skills.visitClawHub')}
          </a>
        </>
      )}
    </div>
  )
}
