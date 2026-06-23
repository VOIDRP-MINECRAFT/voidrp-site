<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '../config.site'
import { setLocale, getLocale } from '../i18n'

const { t } = useI18n()
const currentLang = ref(getLocale())

function switchLang(lang) {
  setLocale(lang)
  currentLang.value = lang
}
</script>

<template>
  <footer class="relative z-10 mt-8 pb-6 pt-2 md:mt-10">
    <div class="container-shell space-y-3">
      <div class="surface-card p-4 md:p-5">
        <div class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div class="max-w-3xl">
            <p class="text-base font-black tracking-tight text-slate-50 md:text-lg">
              {{ siteConfig.serverName }}
            </p>
            <p class="mt-2 text-sm leading-6 text-slate-400">
              {{ t('footer.desc') }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2 lg:justify-end">
            <a :href="siteConfig.siteUrl" target="_blank" rel="noreferrer" class="footer-chip">{{ t('footer.site') }}</a>
            <a :href="siteConfig.bluemapUrl" target="_blank" rel="noreferrer" class="footer-chip">{{ t('footer.map') }}</a>
            <a :href="siteConfig.discordUrl" target="_blank" rel="noreferrer" class="footer-chip">Discord</a>
            <a :href="siteConfig.telegramUrl" target="_blank" rel="noreferrer" class="footer-chip">Telegram</a>
            <RouterLink to="/download-launcher" class="footer-chip">{{ t('footer.launcher') }}</RouterLink>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <span class="footer-copy">© 2026 VoidRP</span>
        <span class="footer-sep">·</span>
        <RouterLink to="/privacy" class="footer-policy-link">{{ t('footer.privacy') }}</RouterLink>
        <span class="footer-sep">·</span>
        <RouterLink to="/offer" class="footer-policy-link">{{ t('footer.offer') }}</RouterLink>
        <span class="footer-sep footer-sep--grow" />
        <div class="lang-switcher">
          <button
            class="lang-btn"
            :class="{ 'lang-btn--active': currentLang === 'ru' }"
            @click="switchLang('ru')"
          >
            <span class="lang-flag">🇷🇺</span> RU
          </button>
          <button
            class="lang-btn"
            :class="{ 'lang-btn--active': currentLang === 'en' }"
            @click="switchLang('en')"
          >
            <span class="lang-flag">🇬🇧</span> EN
          </button>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer-bottom {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  padding: 0 0.25rem;
  font-size: 0.75rem;
  color: #64748b;
}

.footer-copy { color: #475569; }

.footer-sep { color: #1e293b; }

.footer-sep--grow { flex: 1; }

.footer-policy-link {
  color: #475569;
  text-decoration: none;
  transition: color 0.15s;
}
.footer-policy-link:hover { color: #94a3b8; }

.lang-switcher {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  padding: 0.15rem;
}

.lang-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.22rem 0.55rem;
  border-radius: 6px;
  border: none;
  background: none;
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.13s;
  line-height: 1;
}

.lang-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.05); }

.lang-btn--active {
  background: rgba(124,58,237,0.2);
  color: #c4b5fd;
}

.lang-flag { font-size: 0.85rem; line-height: 1; }
</style>
