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
const sel = ref(null)      // selected player's full detail
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
const place = (n) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : n ? `#${n}` : '—')
</script>

<template>
  <div class="rp">
    <div class="rp-bar">
      <input v-model="q" class="adm-input" placeholder="Поиск по нику…" style="max-width: 260px">
      <div class="rp-sorts">
        <button v-for="[k, l] in SORTS" :key="k" class="adm-btn adm-btn--sm" :class="{ 'adm-btn--acc': sort === k }" @click="sort = k">{{ l }}</button>
      </div>
      <span class="rp-count">{{ total }} игроков</span>
    </div>

    <div v-if="!list" class="adm-skel" style="height: 300px" />
    <div v-else class="adm-card" style="overflow:auto">
      <table class="rp-table">
        <thead><tr><th>#</th><th>Игрок</th><th>Ур.</th><th>Игр</th><th>Побед</th><th>Киллы</th><th>K/D</th><th>Очки</th></tr></thead>
        <tbody>
          <tr v-for="p in list" :key="p.name" class="rp-row" @click="open(p.name)">
            <td class="rp-dim">{{ p.rank }}</td>
            <td class="rp-name">{{ p.name }}</td>
            <td><span class="rp-lvl">{{ p.level }}</span></td>
            <td>{{ p.games }}</td>
            <td>{{ p.wins }} <span class="rp-dim">({{ pct(p) }}%)</span></td>
            <td>{{ p.kills }}</td>
            <td>{{ p.kd }}</td>
            <td><b>{{ p.points }}</b></td>
          </tr>
          <tr v-if="!list.length"><td colspan="8" class="rp-empty">{{ loading ? 'Загрузка…' : 'Никого не нашлось' }}</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Detail drawer -->
    <div v-if="sel" class="rp-overlay" @click.self="close">
      <div class="rp-drawer adm-card">
        <div class="rp-dh">
          <div><span class="rp-dname">{{ sel.name }}</span> <span v-if="sel.level" class="rp-lvl">ур.{{ sel.level }}</span></div>
          <button class="adm-btn adm-btn--sm" @click="close">✕</button>
        </div>
        <div v-if="selLoading" class="adm-skel" style="height: 200px" />
        <template v-else-if="sel.exists === false">
          <p class="rp-empty">Игрок ещё не сыграл ни одной игры.</p>
        </template>
        <template v-else>
          <div class="rp-grid">
            <div><span>Ранг</span><b>{{ place(sel.rank) }} <span class="rp-dim">/ {{ sel.total_players }}</span></b></div>
            <div><span>Игр</span><b>{{ sel.games }}</b></div>
            <div><span>Побед</span><b>{{ sel.wins }} ({{ pct(sel) }}%)</b></div>
            <div><span>Топ-3</span><b>{{ sel.top3 }}</b></div>
            <div><span>Киллы</span><b>{{ sel.kills }}</b></div>
            <div><span>K/D</span><b>{{ sel.kd }}</b></div>
            <div><span>Лучшее место</span><b>{{ sel.best_place || '—' }}</b></div>
            <div><span>Очки / XP</span><b>{{ sel.points }}</b></div>
            <div><span>Урон</span><b>{{ Math.round((sel.damage || 0) / 2) }} ❤</b></div>
            <div><span>Void Coins</span><b>{{ sel.has_account ? sel.void_coins : '— нет аккаунта' }}</b></div>
          </div>

          <div v-if="canManage" class="rp-mod">
            <div class="rp-mod-h">Модерация</div>
            <div class="rp-mod-row">
              <button class="adm-btn adm-btn--sm" @click="act('kick')">Кикнуть</button>
              <button class="adm-btn adm-btn--sm adm-btn--danger" @click="act('ban')">Забанить</button>
              <button class="adm-btn adm-btn--sm" @click="act('unban')">Разбан</button>
            </div>
            <div v-if="sel.has_account" class="rp-mod-row">
              <input v-model.number="coinAmount" type="number" class="adm-input" style="width: 6rem">
              <button class="adm-btn adm-btn--sm adm-btn--acc" @click="act('grant_coins', Math.abs(coinAmount))">+ Coins</button>
              <button class="adm-btn adm-btn--sm" @click="act('grant_coins', -Math.abs(coinAmount))">− Coins</button>
            </div>
          </div>

          <div v-if="sel.history?.length" class="rp-hist">
            <div class="rp-mod-h">История ({{ sel.history.length }})</div>
            <table class="rp-table rp-table--sm">
              <tbody>
                <tr v-for="(m, i) in sel.history" :key="i">
                  <td>{{ place(m.placement) }}</td>
                  <td class="rp-name">{{ m.map_title || m.map }}</td>
                  <td class="rp-dim">{{ m.team_title }}</td>
                  <td>{{ m.kills }}⚔</td>
                  <td class="rp-dim">{{ m.duration_seconds ? clock(m.duration_seconds) : '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rp { display: flex; flex-direction: column; gap: 12px; }
.rp-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.rp-sorts { display: flex; gap: 4px; flex-wrap: wrap; }
.rp-count { color: var(--adm-muted, #9aa); font-size: .85rem; margin-left: auto; }
.rp-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
.rp-table th { text-align: left; padding: 8px 10px; color: var(--adm-muted, #9aa); font-weight: 600; font-size: .78rem; border-bottom: 1px solid var(--adm-border, #2a2a33); }
.rp-table td { padding: 7px 10px; border-bottom: 1px solid var(--adm-border, #22222a); }
.rp-row { cursor: pointer; }
.rp-row:hover { background: rgba(124,58,237,.08); }
.rp-name { font-weight: 600; }
.rp-lvl { display: inline-block; min-width: 1.4rem; text-align: center; padding: 1px 6px; border-radius: 6px; background: rgba(167,139,250,.18); color: #a78bfa; font-weight: 800; font-size: .78rem; }
.rp-dim { color: var(--adm-muted, #9aa); }
.rp-empty { text-align: center; color: var(--adm-muted, #9aa); padding: 18px; }
.rp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; justify-content: flex-end; z-index: 60; }
.rp-drawer { width: min(460px, 94vw); height: 100%; overflow-y: auto; padding: 16px; border-radius: 0; }
.rp-dh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.rp-dname { font-size: 1.3rem; font-weight: 900; }
.rp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin-bottom: 14px; }
.rp-grid div { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--adm-border, #22222a); }
.rp-grid span { color: var(--adm-muted, #9aa); font-size: .85rem; }
.rp-mod { margin: 10px 0; padding: 12px; border-radius: 10px; background: rgba(255,255,255,.03); }
.rp-mod-h { font-weight: 700; margin-bottom: 8px; font-size: .9rem; }
.rp-mod-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
.adm-btn--danger { background: #b4232a; color: #fff; }
.rp-hist { margin-top: 12px; }
.rp-table--sm td { padding: 5px 6px; font-size: .82rem; }
</style>
