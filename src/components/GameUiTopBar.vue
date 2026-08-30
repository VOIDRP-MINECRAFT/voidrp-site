<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTopBar } from '../services/gameUiApi.js'
import { closeGui } from '../composables/useWebGui.js'
import GuiIcon from './GuiIcon.vue'

const { t } = useI18n()

defineProps({
  title: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
})

const bar = ref(null)

onMounted(async () => {
  try { bar.value = await getTopBar() } catch { /* silent */ }
})

function money(v) { return Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) }
</script>

<template>
  <header class="topbar" :style="{ '--accent': bar?.accent_color || '#8b7bff' }">
    <div class="tb-left">
      <div class="brand">VOID<span>RP</span></div>
      <div v-if="title" class="tb-crumb">
        <span class="tb-sep">/</span>
        <span class="tb-title">{{ title }}</span>
      </div>
    </div>

    <div class="tb-right">
      <div v-if="bar" class="vcoins" :title="t('gameUiTopbar.voidCoin')">
        <GuiIcon name="voidcoin" :size="15" class="vcoin-ic" />
        <span class="vcoin-val gp-num">{{ money(bar.void_coins) }}</span>
      </div>

      <div v-if="bar" class="coins">
        <GuiIcon name="coins" :size="16" class="coin-ic" />
        <span class="coin-val gp-num">{{ money(bar.balance) }}</span>
      </div>

      <div v-if="bar" class="user">
        <div class="head" :style="{ backgroundImage: `url(${bar.skin_url}), url(${bar.skin_url})` }" :title="bar.nickname"></div>
        <div class="who">
          <div class="nick" :style="{ color: bar.accent_color || '#eaf0ff' }">
            <span v-if="bar.nation_tag" class="utag">{{ bar.nation_tag }}</span>{{ bar.nickname }}
          </div>
          <div class="lvl">LVL {{ bar.level }}</div>
        </div>
      </div>

      <button class="tb-close" @click="closeGui"><GuiIcon name="x" :size="17" /></button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: fixed; top: 0; left: 68px; right: 0; z-index: 60;
  height: 58px; display: flex; align-items: center; gap: 16px;
  padding: 0 20px;
  background: linear-gradient(180deg, rgba(9,11,22,0.94), rgba(9,11,22,0.78));
  border-bottom: 1px solid rgba(150,168,220,0.12);
  backdrop-filter: blur(16px);
  font-family: 'Inter', system-ui, sans-serif;
}
.tb-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.brand { font-size: 1.02rem; font-weight: 900; letter-spacing: 0.05em; color: #f4f7ff; }
.brand span { color: #a78bfa; }
.tb-crumb { display: flex; align-items: center; gap: 10px; min-width: 0; }
.tb-sep { color: #40496b; }
.tb-title { font-size: 0.86rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #aeb9d6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.tb-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }

.coins {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 13px; border-radius: 11px;
  background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.26);
}
.coin-ic { color: #fbbf24; }
.coin-val { font-weight: 800; font-size: 0.9rem; color: #fcd77a; }

/* Void Coin — premium currency, project violet */
.vcoins {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 13px; border-radius: 11px;
  background: linear-gradient(135deg, rgba(139,123,255,0.16), rgba(180,92,240,0.12));
  border: 1px solid rgba(167,139,250,0.4);
  box-shadow: inset 0 0 12px rgba(139,123,255,0.14);
}
.vcoin-ic { color: #c4b5fd; filter: drop-shadow(0 0 4px rgba(167,139,250,0.6)); }
.vcoin-val { font-weight: 800; font-size: 0.9rem; color: #d8ccff; }

.user { display: flex; align-items: center; gap: 10px; padding-left: 4px; }
.head {
  /* Front head face: base at (8,8), hat overlay at (40,8). Scale by WIDTH only
     (304px = 64px × 4.75) with `auto` height so it works for BOTH 64×64 and
     legacy 64×32 skins (the face stays at y=8 either way). Hat layer first (on top). */
  width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
  background-repeat: no-repeat, no-repeat;
  background-size: 304px auto, 304px auto;
  background-position: -190px -38px, -38px -38px;
  image-rendering: pixelated;
  border: 1px solid var(--accent); box-shadow: 0 0 0 1px rgba(0,0,0,0.4);
}
.who { display: flex; flex-direction: column; line-height: 1.15; }
.nick { font-size: 0.9rem; font-weight: 800; display: flex; align-items: center; gap: 6px; }
.utag { font-size: 0.56rem; font-weight: 900; padding: 1px 5px; border-radius: 5px; color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); }
.lvl { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; color: #6b779a; }

.tb-close {
  display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px;
  border: 1px solid rgba(150,168,220,0.16); background: rgba(255,255,255,0.04);
  color: #aeb9d6; cursor: pointer; transition: all 0.15s;
}
.tb-close:hover { background: rgba(251,113,133,0.14); color: #fda4af; border-color: rgba(251,113,133,0.4); }
</style>
