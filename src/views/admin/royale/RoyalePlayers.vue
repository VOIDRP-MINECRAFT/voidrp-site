<script setup>
// Players tab: searchable, sortable list of everyone who played; click a player for their full
// profile, match history, Void Coin balance and moderation (kick / ban / grant coins).
import { computed, onMounted, ref, watch } from 'vue'
import { authState, hasPermission } from '../../../stores/authStore'
import { toastError, toastSuccess } from '../../../services/toast'
import { royalePlayers, royalePlayer, royalePlayerAction } from '../../../services/royaleAdminApi'
import { clock } from './royaleUi'

const token = () => authState.accessToken
const canManage = computed(() => hasPermission('royale.manage'))
const list = ref(null)
const total = ref(0)
const q = ref('')
const sort = ref('points')
const loading = ref(false)
const sel = ref(null)
const selLoading = ref(false)
const coinAmount = ref(100)

async function load() {
  loading.value = true
  try {
    const res = await royalePlayers(token(), { q: q.value, sort: sort.value, limit: 200 })
    list.value = res.players; total.value = res.total
  } catch (e) { toastError(e.message || 'Не удалось загрузить') } finally { loading.value = false }
}
onMounted(load)
let deb = null
watch(q, () => { clearTimeout(deb); deb = setTimeout(load, 300) })
watch(sort, load)

async function open(nick) {
  selLoading.value = true; sel.value = { name: nick }
  try { sel.value = await royalePlayer(token(), nick) } catch (e) { toastError(e.message || 'Нет профиля') } finally { selLoading.value = false }
}
function close() { sel.value = null }

async function act(action, amount) {
  if (!sel.value) return
  if ((action === 'ban' || action === 'kick') && !confirm(`${action === 'ban' ? 'Забанить' : 'Кикнуть'} ${sel.value.name} с Рояля?`)) return
  try {
    const res = await royalePlayerAction(token(), sel.value.name, { action, amount })
    toastSuccess(res.answer || 'Готово')
    if (action === 'grant_coins') await open(sel.value.name)
  } catch (e) { toastError(e.message || 'Не вышло') }
}
const SORTS = [['points', 'очки'], ['wins', 'победы'], ['kills', 'киллы'], ['games', 'игры'], ['name', 'ник']]
const pct = (p) => Math.round((p.win_rate || (p.games ? p.wins / p.games : 0)) * 100)
const place = (n) => (n ? `#${n}` : '—')
const head = (nick) => `/api/v1/public/player-head/${encodeURIComponent(nick)}`
const headFallback = (e, nick) => { if (!e.target.dataset.fb) { e.target.dataset.fb = 1; e.target.src = `https://mc-heads.net/avatar/${encodeURIComponent(nick)}/48` } }
</script>

<template>
  <div class="rp">
    <div class="rp-bar">
      <div class="rp-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
        <input v-model="q" placeholder="Поиск по нику…">
      </div>
      <div class="rp-sorts">
        <button v-for="[k, l] in SORTS" :key="k" class="rp-pill" :class="{ 'rp-pill--on': sort === k }" @click="sort = k">{{ l }}</button>
      </div>
      <span class="rp-count">{{ total }} игроков</span>
    </div>

    <div v-if="!list" class="adm-skel" style="height: 320px" />
    <div v-else class="rp-card">
      <div class="rp-thead"><span class="rp-c-rank">#</span><span class="rp-c-name">Игрок</span><span>Ур.</span><span>Игр</span><span>Побед</span><span>Киллы</span><span>K/D</span><span class="rp-c-pts">Очки</span></div>
      <div class="rp-rows">
        <div v-for="p in list" :key="p.name" class="rp-row" @click="open(p.name)">
          <span class="rp-c-rank rp-rank">{{ p.rank }}</span>
          <span class="rp-c-name"><img class="rp-ava" :src="head(p.name)" alt="" @error="headFallback($event, p.name)"> <b>{{ p.name }}</b></span>
          <span><span class="rp-lvl">{{ p.level }}</span></span>
          <span>{{ p.games }}</span>
          <span>{{ p.wins }} <small>({{ pct(p) }}%)</small></span>
          <span>{{ p.kills }}</span>
          <span>{{ p.kd }}</span>
          <span class="rp-c-pts rp-pts">{{ p.points }}</span>
        </div>
        <div v-if="!list.length" class="rp-empty">{{ loading ? 'Загрузка…' : 'Никого не нашлось' }}</div>
      </div>
    </div>

    <!-- Detail drawer -->
    <transition name="rp-slide">
      <div v-if="sel" class="rp-overlay" @click.self="close">
        <div class="rp-drawer">
          <div class="rp-dh">
            <div class="rp-dh-id">
              <img class="rp-dhead" :src="head(sel.name)" alt="" @error="headFallback($event, sel.name)">
              <div><div class="rp-dname">{{ sel.name }}</div><div v-if="sel.level" class="rp-dsub">уровень {{ sel.level }} · ранг {{ place(sel.rank) }}</div></div>
            </div>
            <button class="rp-x" @click="close">✕</button>
          </div>
          <div v-if="selLoading" class="adm-skel" style="height: 220px" />
          <template v-else-if="sel.exists === false">
            <p class="rp-empty">Игрок ещё не сыграл ни одной игры.</p>
          </template>
          <template v-else>
            <div class="rp-stats">
              <div class="rp-stat"><div class="rp-stat-n">{{ sel.wins }}</div><div class="rp-stat-l">побед ({{ pct(sel) }}%)</div></div>
              <div class="rp-stat"><div class="rp-stat-n">{{ sel.kills }}</div><div class="rp-stat-l">убийств</div></div>
              <div class="rp-stat"><div class="rp-stat-n">{{ sel.kd }}</div><div class="rp-stat-l">K/D</div></div>
              <div class="rp-stat"><div class="rp-stat-n">{{ sel.games }}</div><div class="rp-stat-l">игр</div></div>
              <div class="rp-stat"><div class="rp-stat-n">{{ sel.best_place || '—' }}</div><div class="rp-stat-l">лучшее место</div></div>
              <div class="rp-stat"><div class="rp-stat-n rp-stat-coin">{{ sel.has_account ? sel.void_coins : '—' }}</div><div class="rp-stat-l">Void Coins</div></div>
            </div>

            <div v-if="canManage" class="rp-mod">
              <div class="rp-mod-row">
                <button class="rp-mbtn" @click="act('kick')">Кикнуть</button>
                <button class="rp-mbtn rp-mbtn--danger" @click="act('ban')">Забанить</button>
                <button class="rp-mbtn" @click="act('unban')">Разбан</button>
              </div>
              <div v-if="sel.has_account" class="rp-mod-row">
                <input v-model.number="coinAmount" type="number" class="rp-coin-in">
                <button class="rp-mbtn rp-mbtn--go" @click="act('grant_coins', Math.abs(coinAmount))">+ Coins</button>
                <button class="rp-mbtn" @click="act('grant_coins', -Math.abs(coinAmount))">− Coins</button>
              </div>
            </div>

            <div v-if="sel.history?.length" class="rp-hist">
              <div class="rp-hist-h">История матчей</div>
              <div v-for="(m, i) in sel.history" :key="i" class="rp-hrow">
                <span class="rp-hplace" :class="{ 'rp-hplace--win': m.placement === 1 }">{{ place(m.placement) }}</span>
                <span class="rp-hmap">{{ m.map_title || m.map }}</span>
                <span class="rp-hteam">{{ m.team_title }}</span>
                <span class="rp-hk">{{ m.kills }} уб.</span>
                <span class="rp-hdur">{{ m.duration_seconds ? clock(m.duration_seconds) : '' }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.rp { display: flex; flex-direction: column; gap: 14px; }
.rp-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.rp-search { display: flex; align-items: center; gap: 8px; padding: 0 14px; height: 40px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); min-width: 240px; }
.rp-search svg { width: 16px; height: 16px; color: #74747e; }
.rp-search input { background: none; border: none; outline: none; color: #eee; font-size: .9rem; width: 100%; }
.rp-sorts { display: flex; gap: 6px; flex-wrap: wrap; }
.rp-pill { padding: 7px 14px; border-radius: 999px; font-size: .85rem; font-weight: 600; cursor: pointer;
  border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.03); color: #b8b8c2; transition: all .12s; }
.rp-pill:hover { background: rgba(255,255,255,.08); }
.rp-pill--on { border-color: transparent; color: #1a0f08; background: linear-gradient(135deg, #ff8a3d, #ff5a9e); }
.rp-count { color: #8a8a96; font-size: .85rem; margin-left: auto; }

.rp-card { border-radius: 20px; border: 1px solid rgba(255,255,255,.07); background: #0e0e13; overflow: hidden; }
.rp-thead, .rp-row { display: grid; grid-template-columns: 48px 2.2fr .7fr .7fr 1.1fr .8fr .8fr 1fr; align-items: center; gap: 8px; padding: 0 18px; }
.rp-thead { height: 44px; color: #74747e; font-size: .76rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid rgba(255,255,255,.06); }
.rp-rows { max-height: 62vh; overflow-y: auto; }
.rp-row { height: 54px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,.04); transition: background .1s; font-size: .9rem; }
.rp-row:hover { background: rgba(255,138,61,.06); }
.rp-row:last-child { border-bottom: 0; }
.rp-c-pts { text-align: right; }
.rp-rank { color: #74747e; font-weight: 700; }
.rp-c-name { display: flex; align-items: center; gap: 10px; min-width: 0; }
.rp-c-name b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rp-ava { width: 30px; height: 30px; border-radius: 8px; image-rendering: pixelated; background: rgba(255,255,255,.05); box-shadow: 0 0 0 1px rgba(255,255,255,.08); flex: none; }
.rp-lvl { display: inline-grid; place-items: center; min-width: 26px; height: 22px; padding: 0 6px; border-radius: 7px; background: rgba(168,139,250,.16); color: #b9a3ff; font-weight: 800; font-size: .8rem; }
.rp-row small { color: #74747e; }
.rp-pts { font-weight: 900; background: linear-gradient(135deg, #ff8a3d, #ff5a9e); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.rp-empty { text-align: center; color: #74747e; padding: 26px; }

/* Drawer */
.rp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(3px); display: flex; justify-content: flex-end; z-index: 60; }
.rp-drawer { width: min(480px, 95vw); height: 100%; overflow-y: auto; padding: 22px; background: #0c0c11; border-left: 1px solid rgba(255,255,255,.08); }
.rp-slide-enter-active, .rp-slide-leave-active { transition: opacity .2s; }
.rp-slide-enter-active .rp-drawer, .rp-slide-leave-active .rp-drawer { transition: transform .22s cubic-bezier(.2,.8,.2,1); }
.rp-slide-enter-from, .rp-slide-leave-to { opacity: 0; }
.rp-slide-enter-from .rp-drawer, .rp-slide-leave-to .rp-drawer { transform: translateX(100%); }
.rp-dh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
.rp-dh-id { display: flex; align-items: center; gap: 14px; }
.rp-dhead { width: 56px; height: 56px; border-radius: 14px; image-rendering: pixelated; background: rgba(255,255,255,.05); box-shadow: 0 0 0 1px rgba(255,255,255,.1); }
.rp-dname { font-size: 1.45rem; font-weight: 900; letter-spacing: -.01em; }
.rp-dsub { font-size: .85rem; color: #8a8a96; margin-top: 2px; }
.rp-x { width: 34px; height: 34px; border-radius: 10px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); color: #ccc; cursor: pointer; font-size: .9rem; }
.rp-x:hover { background: rgba(255,255,255,.1); }
.rp-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
.rp-stat { padding: 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,.06); background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.008)); text-align: center; }
.rp-stat-n { font-size: 1.5rem; font-weight: 900; line-height: 1; }
.rp-stat-coin { background: linear-gradient(135deg, #ffd36b, #ff8a3d); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.rp-stat-l { font-size: .74rem; color: #8a8a96; margin-top: 6px; }
.rp-mod { padding: 14px; border-radius: 14px; background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.06); margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
.rp-mod-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.rp-mbtn { padding: 8px 14px; border-radius: 10px; font-size: .85rem; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: #eee; }
.rp-mbtn:hover { background: rgba(255,255,255,.1); }
.rp-mbtn--danger { border-color: transparent; background: #c43b42; color: #fff; }
.rp-mbtn--go { border-color: transparent; background: linear-gradient(135deg, #ff8a3d, #ff5a9e); color: #1a0f08; }
.rp-coin-in { width: 5.5rem; height: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,.1); background: rgba(0,0,0,.25); color: #fff; text-align: center; font-weight: 700; }
.rp-hist-h { font-weight: 800; margin-bottom: 10px; }
.rp-hrow { display: grid; grid-template-columns: 42px 1.4fr 1fr auto auto; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 10px; font-size: .84rem; }
.rp-hrow:hover { background: rgba(255,255,255,.03); }
.rp-hplace { font-weight: 800; color: #8a8a96; }
.rp-hplace--win { color: #ffd36b; }
.rp-hmap { font-weight: 600; }
.rp-hteam { color: #8a8a96; }
.rp-hk { color: #ff9a5c; font-weight: 600; white-space: nowrap; }
.rp-hdur { color: #74747e; text-align: right; }
</style>
