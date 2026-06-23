import { createI18n } from 'vue-i18n'
import ru from './locales/ru'
import en from './locales/en'

const CIS_LANGS = new Set(['ru', 'uk', 'be', 'kk', 'ky', 'tg', 'tk', 'uz', 'az', 'hy'])

function detectLocale() {
  const saved = localStorage.getItem('voidrp_lang')
  if (saved === 'ru' || saved === 'en') return saved
  const lang = (navigator.language || '').toLowerCase().split('-')[0]
  return CIS_LANGS.has(lang) ? 'ru' : 'en'
}

export function setLocale(locale) {
  i18n.global.locale.value = locale
  localStorage.setItem('voidrp_lang', locale)
  document.documentElement.lang = locale
}

export function getLocale() {
  return i18n.global.locale.value
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'ru',
  messages: { ru, en },
})

document.documentElement.lang = i18n.global.locale.value

export default i18n
