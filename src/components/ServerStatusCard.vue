<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { siteConfig } from '../config.site'

const externalStatsUrl = computed(() => siteConfig.monitoringChartUrl)
const copySuccess = ref(false)

function copyIp() {
  navigator.clipboard.writeText('void-rp.ru').then(() => {
    copySuccess.value = true
    setTimeout(() => { copySuccess.value = false }, 2000)
  })
}
</script>

<template>
  <section class="py-2 md:py-3">
    <div class="container-shell">
      <div class="sc-card">
        <div class="sc-left">
          <div class="sc-ip-block">
            <p class="sc-label">Адрес сервера</p>
            <p class="sc-ip">void-rp.ru</p>
            <button class="sc-copy-btn" @click="copyIp">
              <svg v-if="!copySuccess" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
              <svg v-else viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              {{ copySuccess ? 'Скопировано' : 'Скопировать' }}
            </button>
          </div>

          <div class="sc-meta">
            <div class="sc-online-chip">
              <span class="sc-online-dot"></span>
              1.21.1
            </div>
            <p class="sc-peak">Пик активности: вечером 18–23 МСК</p>
          </div>
        </div>

        <div class="sc-right">
          <p class="sc-section-label">Активность сервера</p>
          <p class="sc-section-desc">Узнай, когда на сервере больше всего игроков.</p>
          <div class="sc-btns">
            <RouterLink to="/download-launcher" class="btn btn-primary btn-sm">Скачать лаунчер</RouterLink>
            <a :href="siteConfig.bluemapUrl" target="_blank" rel="noreferrer" class="btn btn-outline btn-sm">Карта</a>
            <a :href="externalStatsUrl" target="_blank" rel="noreferrer" class="btn btn-outline btn-sm">График</a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sc-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  border: 1px solid rgba(148,163,184,.1);
  border-radius: 16px;
  background: rgba(255,255,255,.025);
  padding: 1rem 1.25rem;
}

.sc-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  flex: 1;
}

.sc-ip-block {
  display: flex;
  flex-direction: column;
  gap: .4rem;
}

.sc-label {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0;
}

.sc-ip {
  font-size: 1.2rem;
  font-weight: 900;
  color: #f8fbff;
  font-family: monospace;
  letter-spacing: -.01em;
  margin: 0;
}

.sc-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  border: 1px solid rgba(148,163,184,.14);
  border-radius: 8px;
  background: rgba(255,255,255,.04);
  color: rgb(148 163 184);
  font: inherit;
  font-size: .78rem;
  font-weight: 700;
  padding: .3rem .65rem;
  cursor: pointer;
  transition: border-color .15s, color .15s;
}

.sc-copy-btn:hover { border-color: rgba(139,92,246,.3); color: #fff; }
.sc-copy-btn svg { width: .85rem; height: .85rem; }

.sc-meta {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.sc-online-chip {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 999px;
  background: rgba(255,255,255,.04);
  padding: .28rem .65rem;
  font-size: .78rem;
  font-weight: 700;
  color: rgb(203 213 225);
}

.sc-online-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgb(74 222 128);
  box-shadow: 0 0 6px rgba(74,222,128,.7);
  flex-shrink: 0;
}

.sc-peak {
  font-size: .8rem;
  color: rgb(100 116 139);
  margin: 0;
}

.sc-right {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

@media (max-width: 640px) {
  .sc-right {
    width: 100%;
  }
}

.sc-section-label {
  font-size: .75rem;
  font-weight: 800;
  color: rgb(148 163 184);
  margin: 0;
}

.sc-section-desc {
  font-size: .78rem;
  color: rgb(100 116 139);
  margin: 0;
}

.sc-btns {
  display: flex;
  gap: .4rem;
  flex-wrap: wrap;
}
</style>
