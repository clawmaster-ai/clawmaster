import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from './zh.json'
import en from './en.json'
import ja from './ja.json'

const storedLang = localStorage.getItem('clawmaster-language') || 'zh'

i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh }, en: { translation: en }, ja: { translation: ja } },
  lng: storedLang,
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
})

export default i18n

export function changeLanguage(lang: string) {
  i18n.changeLanguage(lang)
  localStorage.setItem('clawmaster-language', lang)
}
