<script setup>
import { computed, onMounted, ref } from 'vue'
import ItemIcon from '../../components/ItemIcon.vue'
import { authState, hasPermission } from '../../stores/authStore'
import { toastError, toastSuccess } from '../../services/toast'
import { confirmDialog } from '../../composables/useConfirm'
import {
  adminBpListRewards,
  adminBpUpsertReward,
  adminBpDeleteReward,
  adminBpListSeasonObjs,
  adminBpCreateSeason,
  adminBpUpdateSeason,
  adminBpDeleteSeason,
} from '../../services/battlepassRewardsAdminApi'

const token = () => authState.accessToken
const canManage = computed(() => hasPermission('battlepass.rewards.manage'))

// ── seasons (rich objects: key/name/dates/max_level/is_active/reward_count) ──
const seasons = ref([])
const season = ref('')     // selected season_key
const loading = ref(true)
const curSeason = computed(() => seasons.value.find(s => s.season_key === season.value) || null)
const maxLevel = computed(() => curSeason.value?.max_level || 100)

// rewards: flat list → map[level][track]
const rewards = ref([])
const byLevel = computed(() => {
  const m = {}
  for (let l = 1; l <= maxLevel.value; l++) m[l] = { free: null, premium: null }
  for (const r of rewards.value) {
    if (!m[r.level]) m[r.level] = { free: null, premium: null }
    m[r.level][r.track] = r
  }
  return m
})

async function loadSeasons() {
  try {
    seasons.value = await adminBpListSeasonObjs(token()) || []
    if ((!season.value || !seasons.value.some(s => s.season_key === season.value)) && seasons.value.length) {
      season.value = (seasons.value.find(s => s.is_active) || seasons.value[0]).season_key
    }
  } catch { seasons.value = [] }
}

// ── filters (search by item / level / type / track) ─────────────────────────
const fltQ = ref('')
const fltType = ref('')        // '' | command | item | money | voidcoin
const fltTrack = ref('both')   // both | free | premium
const fltFrom = ref(null)
const fltTo = ref(null)
const fltEmpty = ref(false)
const hasFilters = computed(() =>
  !!fltQ.value.trim() || !!fltType.value || fltTrack.value !== 'both' ||
  fltFrom.value != null || fltTo.value != null || fltEmpty.value)

function resetFilters() {
  fltQ.value = ''; fltType.value = ''; fltTrack.value = 'both'
  fltFrom.value = null; fltTo.value = null; fltEmpty.value = false
}

const consideredTracks = computed(() =>
  fltTrack.value === 'both' ? ['free', 'premium'] : [fltTrack.value])

function rewardMatchesQ(r) {
  const q = fltQ.value.trim().toLowerCase()
  if (!q) return true
  if (!r) return false
  return [r.display_name, r.material, r.item_key, r.icon, r.command, r.reward_type]
    .some(v => (v || '').toString().toLowerCase().includes(q))
}
function cellMatches(r) {   // for visual highlight
  if (!r) return false
  if (fltType.value && r.reward_type !== fltType.value) return false
  return rewardMatchesQ(r)
}

const filteredLevels = computed(() => {
  const out = []
  const from = fltFrom.value != null ? fltFrom.value : 1
  const to = fltTo.value != null ? fltTo.value : maxLevel.value
  for (let l = 1; l <= maxLevel.value; l++) {
    if (l < from || l > to) continue
    const slots = byLevel.value[l] || { free: null, premium: null }
    if (fltEmpty.value) {
      if (consideredTracks.value.some(t => !slots[t])) out.push(l)
      continue
    }
    if (!fltQ.value.trim() && !fltType.value && fltTrack.value === 'both') { out.push(l); continue }
    const ok = consideredTracks.value.some(t => {
      const r = slots[t]
      if (!r) return false
      if (fltType.value && r.reward_type !== fltType.value) return false
      return rewardMatchesQ(r)
    })
    if (ok) out.push(l)
  }
  return out
})

async function loadRewards() {
  if (!season.value) { rewards.value = []; loading.value = false; return }
  loading.value = true
  try { rewards.value = await adminBpListRewards(token(), season.value) || [] }
  catch { rewards.value = [] }
  finally { loading.value = false }
}

async function reloadAll() { await loadSeasons(); await loadRewards() }
function onSeasonChange() { loadRewards() }

// ── item catalog (client-side search, shared with upgrader) ────────────────
const catalog = ref([])
const catalogReady = ref(false)
const names = ref({})
onMounted(async () => {
  try {
    const r = await fetch('/item_catalog.json', { cache: 'force-cache' })
    catalog.value = await r.json()
  } catch { catalog.value = [] } finally { catalogReady.value = true }
  try {
    const r = await fetch('/item_names.json', { cache: 'force-cache' })
    names.value = await r.json()
  } catch { names.value = {} }
  await reloadAll()
})

const pickerQ = ref('')
const pickerResults = computed(() => {
  const q = pickerQ.value.trim().toLowerCase()
  if (!q) return catalog.value.slice(0, 60)
  const out = []
  for (const it of catalog.value) {
    const nm = (names.value[it.id] || '').toLowerCase()
    if (it.id.toLowerCase().includes(q) || nm.includes(q)) { out.push(it); if (out.length >= 120) break }
  }
  return out
})

// ── editor modal ───────────────────────────────────────────────────────────
const modalOpen = ref(false)
const pickerOpen = ref(false)
const saving = ref(false)
const form = ref(null)   // { id?, level, track, reward_type, command, material, item_key, count, amount, display_name, icon }

function blank(level, track) {
  return { id: null, level, track, reward_type: 'command', command: '', material: '', item_key: '', count: 1, count_max: null, amount: 1000, amount_max: null, display_name: '', icon: '', options: [] }
}
function blankOption() {
  return { type: 'command', command: '', material: '', count: 1, count_max: null, amount: 1000, amount_max: null, display_name: '', icon: '' }
}
function addOption() { form.value.options.push(blankOption()) }
function removeOption(i) { form.value.options.splice(i, 1) }

function openCell(level, track) {
  const existing = byLevel.value[level]?.[track]
  form.value = existing
    ? {
        ...existing, command: existing.command || '', material: existing.material || '', display_name: existing.display_name || '',
        icon: existing.icon || '', count: existing.count || 1, amount: existing.amount || 0,
        count_max: existing.count_max ?? null, amount_max: existing.amount_max ?? null,
        options: (existing.options || []).map(o => ({ ...blankOption(), ...o })),
      }
    : blank(level, track)
  pickerTarget.value = null
  pickerQ.value = ''
  pickerOpen.value = !existing
  modalOpen.value = true
}

function closeModal() { modalOpen.value = false; form.value = null; pickerOpen.value = false }

// picking an item: vanilla → ITEM, modded → COMMAND (mirrors rewards.yml conventions).
// pickerTarget: null = the slot itself, a number = that choice option.
const pickerTarget = ref(null)
function openPickerFor(target) {
  pickerTarget.value = target
  pickerQ.value = ''
  pickerOpen.value = true
}
function pickItem(it) {
  const id = it.id
  const isOpt = pickerTarget.value != null
  const t = isOpt ? form.value.options[pickerTarget.value] : form.value
  const typeKey = isOpt ? 'type' : 'reward_type'
  t.icon = id
  if (!isOpt) t.item_key = id
  const nm = names.value[id] || id.split(':').pop().replace(/_/g, ' ')
  if (!t.display_name) t.display_name = nm
  if (id.startsWith('minecraft:') && !t.count_max) {
    t[typeKey] = 'item'
    t.material = id.split(':')[1].toUpperCase()
    t.count = t.count || 1
  } else {
    // modded items (and any random count) go through /give with a {count} placeholder
    t[typeKey] = 'command'
    t.command = `/minecraft:give {player} ${id} ${t.count_max ? '{count}' : (t.count || 1)}`
  }
  pickerOpen.value = false
}

// Fields of one plain reward (slot or choice option) → API body; returns an error text or null.
function plainBody(kind, f, out) {
  if (kind === 'money' || kind === 'voidcoin' || kind === 'exp') {
    out.amount = Number(f.amount) || 0
    if (out.amount <= 0) return 'Укажите количество > 0'
    if (f.amount_max) {
      out.amount_max = Number(f.amount_max)
      if (out.amount_max < out.amount) return '«До» меньше «от»'
    }
  } else if (kind === 'item') {
    out.material = (f.material || '').trim().toUpperCase()
    out.count = Number(f.count) || 1
    if (f.count_max) out.count_max = Number(f.count_max)
    if (!out.material) return 'Укажите material'
  } else if (kind === 'command') {
    out.command = (f.command || '').trim()
    if (!out.command) return 'Укажите команду'
    out.count = Number(f.count) || 1
    if (f.count_max) {
      out.count_max = Number(f.count_max)
      if (!out.command.includes('{count}')) return 'Для случайного количества в команде нужен {count}'
    }
  }
  if (out.count_max && out.count_max < out.count) return '«До» меньше «от»'
  return null
}

async function save() {
  const f = form.value
  const body = {
    season: season.value, level: f.level, track: f.track, reward_type: f.reward_type,
    display_name: (f.display_name || '').trim() || null,
    icon: (f.icon || '').trim() || null,
  }
  if (f.reward_type === 'choice') {
    if ((f.options || []).length < 2) { toastError('Нужно минимум 2 варианта'); return }
    body.options = []
    for (const [i, o] of f.options.entries()) {
      const ob = { type: o.type, display_name: (o.display_name || '').trim() || null, icon: (o.icon || '').trim() || null }
      const err = plainBody(o.type, o, ob)
      if (err) { toastError(`Вариант ${i + 1}: ${err}`); return }
      body.options.push(ob)
    }
  } else {
    const err = plainBody(f.reward_type, f, body)
    if (err) { toastError(err); return }
    if (f.reward_type === 'command') body.item_key = body.icon
  }
  saving.value = true
  try {
    await adminBpUpsertReward(token(), body)
    toastSuccess(`Уровень ${f.level} · ${f.track === 'free' ? 'Free' : 'Premium'} сохранён`)
    closeModal()
    await loadRewards()
  } catch (e) {
    toastError(e.message || 'Не удалось сохранить')
  } finally { saving.value = false }
}

async function removeReward() {
  const f = form.value
  if (!f.id) { closeModal(); return }
  const ok = await confirmDialog({
    title: 'Удалить награду',
    message: `Убрать награду с уровня ${f.level} (${f.track === 'free' ? 'Free' : 'Premium'})?`,
    confirmLabel: 'Удалить', danger: true,
  })
  if (!ok) return
  saving.value = true
  try {
    await adminBpDeleteReward(token(), f.id)
    toastSuccess('Награда удалена')
    closeModal()
    await loadRewards()
  } catch (e) { toastError(e.message || 'Не удалось удалить') }
  finally { saving.value = false }
}

// ── season management (create / edit / activate / delete) ───────────────────
const seasonModalOpen = ref(false)
const seasonSaving = ref(false)
const seasonMode = ref('create')   // 'create' | 'edit'
const seasonForm = ref(null)

function openCreateSeason() {
  seasonMode.value = 'create'
  seasonForm.value = {
    season_key: '', name: '', start_date: '', end_date: '', max_level: 100,
    activate: true, copy_rewards_from: season.value || '',
  }
  seasonModalOpen.value = true
}
function openEditSeason() {
  const s = curSeason.value
  if (!s) return
  seasonMode.value = 'edit'
  seasonForm.value = {
    season_key: s.season_key, name: s.name, start_date: s.start_date, end_date: s.end_date, max_level: s.max_level, is_active: s.is_active,
    gates: (s.gates || []).map(g => ({ ...g })),
  }
  seasonModalOpen.value = true
}
function closeSeasonModal() { seasonModalOpen.value = false; seasonForm.value = null }

async function saveSeason() {
  const f = seasonForm.value
  if (!f.name.trim()) { toastError('Укажите название сезона'); return }
  if (!f.start_date || !f.end_date) { toastError('Укажите даты начала и окончания'); return }
  if (f.end_date < f.start_date) { toastError('Дата окончания раньше начала'); return }
  seasonSaving.value = true
  try {
    if (seasonMode.value === 'create') {
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(f.season_key.trim())) {
        toastError('Ключ: 3-32 символа (буквы/цифры/-/_), напр. 2026-11-30'); seasonSaving.value = false; return
      }
      const res = await adminBpCreateSeason(token(), {
        season_key: f.season_key.trim(), name: f.name.trim(),
        start_date: f.start_date, end_date: f.end_date, max_level: Number(f.max_level) || 100,
        activate: !!f.activate, copy_rewards_from: f.copy_rewards_from || null,
      })
      toastSuccess(`Сезон создан${res.reward_count ? ` (скопировано ${res.reward_count} наград)` : ''}`)
      season.value = res.season_key
    } else {
      const gates = (f.gates || []).filter(g => g.level && g.tier)
        .map(g => ({ level: Number(g.level), tier: g.tier, label: (g.label || '').trim() || null }))
      await adminBpUpdateSeason(token(), f.season_key, {
        name: f.name.trim(), start_date: f.start_date, end_date: f.end_date, max_level: Number(f.max_level) || 100, gates,
      })
      toastSuccess('Сезон обновлён')
    }
    closeSeasonModal()
    await reloadAll()
  } catch (e) { toastError(e.message || 'Не удалось сохранить сезон') }
  finally { seasonSaving.value = false }
}

async function activateSeason(key) {
  try {
    await adminBpUpdateSeason(token(), key, { is_active: true })
    toastSuccess('Сезон активирован. Применить в игре: /bpadmin reload')
    await loadSeasons()
  } catch (e) { toastError(e.message || 'Не удалось активировать') }
}

async function deleteSeason(s) {
  if (s.is_active) { toastError('Нельзя удалить активный сезон'); return }
  const ok = await confirmDialog({
    title: 'Удалить сезон',
    message: `Удалить сезон «${s.name}» (${s.season_key}) и все его ${s.reward_count} наград? Это необратимо.`,
    confirmLabel: 'Удалить', danger: true,
  })
  if (!ok) return
  try {
    await adminBpDeleteSeason(token(), s.season_key)
    toastSuccess('Сезон удалён')
    if (season.value === s.season_key) season.value = ''
    await reloadAll()
  } catch (e) { toastError(e.message || 'Не удалось удалить') }
}

// Progression tiers a zone gate can require (keys = backend PROGRESSION_TIERS).
const TIERS = [
  ['mechanisms_age', 'Эпоха механизмов'], ['steel_age', 'Эпоха стали'], ['energy_age', 'Эпоха энергии'],
  ['automation_age', 'Эпоха автоматизации'], ['industry_age', 'Индустриальная эпоха'], ['quantum_age', 'Квантовая эпоха'],
  ['singularity_age', 'Эпоха сингулярности'], ['transcendence', 'Трансцендентство'],
  ['magic_path', 'Путь магии'], ['arcane_path', 'Тайные искусства'], ['hunter_path', 'Путь охотника'],
  ['starlight_path', 'Вечный Звездосвет'], ['draconic_path', 'Дракониевая энергетика'],
]
function addGate() { seasonForm.value.gates.push({ level: 100, tier: 'steel_age', label: '' }) }
function removeGate(i) { seasonForm.value.gates.splice(i, 1) }

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—' }

// ── cell rendering helpers ──────────────────────────────────────────────────
function summary(r) {
  if (!r) return ''
  const amt = (x) => x.amount_max ? `${fmtNum(x.amount)}–${fmtNum(x.amount_max)}` : fmtNum(x.amount)
  const cnt = (x) => x.count_max ? `${x.count}–${x.count_max}` : (x.count || 1)
  if (r.reward_type === 'choice') return `🎲 ${r.display_name || 'На выбор'} (${(r.options || []).length})`
  if (r.reward_type === 'money') return `${amt(r)} 🪙`
  if (r.reward_type === 'voidcoin') return `${amt(r)} VC`
  if (r.reward_type === 'exp') return `${amt(r)} XP`
  if (r.reward_type === 'item') return `${r.display_name || r.material} ×${cnt(r)}`
  const nm = r.display_name || (r.command || '').split(' ').find(t => t.includes(':')) || 'Команда'
  return r.count_max ? `${nm.replace(/\s*×\s*[\d–-]+$/, '')} ×${cnt(r)}` : nm
}
function fmtNum(n) { return Number(n || 0).toLocaleString('ru') }
const typeLabel = { command: 'Команда', item: 'Предмет', money: 'Деньги', voidcoin: 'Void Coins', exp: 'Опыт', choice: 'На выбор' }
const plainTypeLabel = { command: 'Команда', item: 'Предмет', money: 'Деньги', voidcoin: 'Void Coins', exp: 'Опыт' }
</script>

<template>
  <div class="bpr">
    <!-- season bar -->
    <div class="bpr-bar">
      <div class="bpr-bar__left">
        <label class="adm-label" style="margin:0">Сезон</label>
        <select v-model="season" class="adm-select bpr-season" @change="onSeasonChange">
          <option v-for="s in seasons" :key="s.season_key" :value="s.season_key">
            {{ s.is_active ? '● ' : '' }}{{ s.name }} — {{ s.season_key }} ({{ s.reward_count }})
          </option>
          <option v-if="!seasons.length" :value="''">— нет сезонов —</option>
        </select>
        <span v-if="curSeason" class="adm-badge" :class="curSeason.is_active ? 'adm-badge--ok' : 'adm-badge--err'">
          {{ curSeason.is_active ? 'Активный' : 'Неактивный' }}
        </span>
      </div>
      <div class="bpr-bar__right">
        <button v-if="canManage" class="adm-btn adm-btn--acc adm-btn--sm" @click="openCreateSeason">+ Новый сезон</button>
        <button class="adm-btn adm-btn--sm" @click="reloadAll">Обновить</button>
      </div>
    </div>

    <!-- selected season meta + quick actions -->
    <div v-if="curSeason" class="bpr-seasonmeta">
      <div class="bpr-seasonmeta__info">
        <span>📅 {{ fmtDate(curSeason.start_date) }} → {{ fmtDate(curSeason.end_date) }}</span>
        <span>🎚 Уровней: <b>{{ curSeason.max_level }}</b></span>
        <span>🎁 Наград: <b>{{ curSeason.reward_count }}</b></span>
        <span v-if="curSeason.gates?.length">🔒 Зоны: <b>{{ curSeason.gates.map(g => g.level).join(' / ') }}</b></span>
      </div>
      <div v-if="canManage" class="bpr-seasonmeta__actions">
        <button class="adm-btn adm-btn--ghost adm-btn--sm" @click="openEditSeason">✏ Даты / уровни / название</button>
        <button v-if="!curSeason.is_active" class="adm-btn adm-btn--ghost adm-btn--sm" @click="activateSeason(curSeason.season_key)">Сделать активным</button>
        <button class="adm-btn adm-btn--danger adm-btn--sm" :disabled="curSeason.is_active" @click="deleteSeason(curSeason)">Удалить сезон</button>
      </div>
      <span v-else class="adm-badge">Только просмотр</span>
    </div>
    <p class="bpr-hint">Награды и параметры сезона берутся плагином из этой панели. После правок примените в игре: <code>/bpadmin reload</code>. Чтобы добавить уровни — увеличьте «Уровней» в редакторе сезона.</p>

    <!-- filters -->
    <div class="bpr-filters">
      <div class="bpr-flt-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input v-model="fltQ" placeholder="Поиск: название, предмет, команда…" />
        <button v-if="fltQ" class="bpr-flt-clear" title="Очистить" @click="fltQ = ''">✕</button>
      </div>
      <select class="adm-select bpr-flt-sel" v-model="fltType">
        <option value="">Все типы</option>
        <option value="command">Команда</option>
        <option value="item">Предмет</option>
        <option value="money">Деньги</option>
        <option value="voidcoin">Void Coins</option>
        <option value="exp">Опыт</option>
        <option value="choice">На выбор</option>
      </select>
      <select class="adm-select bpr-flt-sel" v-model="fltTrack">
        <option value="both">Оба трека</option>
        <option value="free">Только Free</option>
        <option value="premium">Только Premium</option>
      </select>
      <div class="bpr-flt-range">
        <span class="bpr-flt-range__lbl">Уровни</span>
        <input class="bpr-flt-num" type="number" min="1" :max="maxLevel" v-model.number="fltFrom" placeholder="1" />
        <span class="bpr-flt-range__dash">–</span>
        <input class="bpr-flt-num" type="number" min="1" :max="maxLevel" v-model.number="fltTo" :placeholder="String(maxLevel)" />
      </div>
      <label class="adm-check bpr-flt-check"><input type="checkbox" v-model="fltEmpty" /><span>Пустые</span></label>
      <span class="bpr-flt-count">{{ filteredLevels.length }}<span class="bpr-flt-count__tot">/{{ maxLevel }}</span></span>
      <button v-if="hasFilters" class="adm-btn adm-btn--ghost adm-btn--sm bpr-flt-reset" @click="resetFilters">Сбросить</button>
    </div>

    <div v-if="loading" class="adm-skel" style="height: 420px" />
    <div v-else-if="!filteredLevels.length" class="adm-empty">
      <div class="adm-empty__title">Ничего не найдено</div>
      <div class="adm-empty__sub">Измените условия фильтра</div>
    </div>
    <div v-else class="adm-table-wrap">
      <div class="adm-table-scroll" style="max-height: 70vh">
        <table class="adm-table bpr-table">
          <thead>
            <tr>
              <th style="width:64px">Ур.</th>
              <th>Free</th>
              <th>Premium</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in filteredLevels" :key="l">
              <td class="bpr-lvl">{{ l }}</td>
              <td :class="{ 'bpr-td-dim': fltTrack === 'premium' }">
                <button class="bpr-cell" :class="{ 'bpr-cell--empty': !byLevel[l].free, 'bpr-cell--hit': cellMatches(byLevel[l].free) }" @click="openCell(l, 'free')">
                  <ItemIcon v-if="byLevel[l].free" :itemKey="byLevel[l].free.icon || byLevel[l].free.material || ''" :size="26" />
                  <span v-else class="bpr-plus">＋</span>
                  <span class="bpr-cell__txt">{{ byLevel[l].free ? summary(byLevel[l].free) : 'пусто' }}</span>
                </button>
              </td>
              <td :class="{ 'bpr-td-dim': fltTrack === 'free' }">
                <button class="bpr-cell bpr-cell--prem" :class="{ 'bpr-cell--empty': !byLevel[l].premium, 'bpr-cell--hit': cellMatches(byLevel[l].premium) }" @click="openCell(l, 'premium')">
                  <ItemIcon v-if="byLevel[l].premium" :itemKey="byLevel[l].premium.icon || byLevel[l].premium.material || ''" :size="26" />
                  <span v-else class="bpr-plus">＋</span>
                  <span class="bpr-cell__txt">{{ byLevel[l].premium ? summary(byLevel[l].premium) : 'пусто' }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- editor modal -->
    <div v-if="modalOpen && form" class="bpr-modal" @click.self="closeModal">
      <div class="bpr-modal__box adm-card">
        <div class="bpr-modal__head">
          <div>
            <div class="adm-title" style="font-size:1.05rem">Уровень {{ form.level }} · {{ form.track === 'free' ? 'Free' : 'Premium' }}</div>
            <div class="adm-sub">Сезон {{ season }}</div>
          </div>
          <button class="adm-btn adm-btn--ghost adm-btn--sm" @click="closeModal">✕</button>
        </div>

        <!-- type -->
        <div class="adm-label">Тип награды</div>
        <div class="bpr-types">
          <button v-for="(lab, t) in typeLabel" :key="t" class="bpr-type" :class="{ sel: form.reward_type === t }" @click="form.reward_type = t">{{ lab }}</button>
        </div>

        <!-- selected item + picker -->
        <div v-if="form.reward_type === 'item' || form.reward_type === 'command'" class="bpr-sel">
          <div class="up-ic up-ic--lg"><ItemIcon v-if="form.icon" :itemKey="form.icon" :size="40" /></div>
          <div class="bpr-sel__meta">
            <div class="adm-mono" style="font-size:.72rem;color:var(--adm-dim)">{{ form.icon || 'нет иконки' }}</div>
          </div>
          <button class="adm-btn adm-btn--ghost adm-btn--sm" @click="pickerOpen && pickerTarget == null ? (pickerOpen = false) : openPickerFor(null)">{{ pickerOpen && pickerTarget == null ? 'Скрыть' : 'Выбрать предмет' }}</button>
        </div>
        <div v-if="pickerOpen && (pickerTarget != null || form.reward_type === 'item' || form.reward_type === 'command')" class="up-picker">
          <div v-if="pickerTarget != null" class="adm-sub" style="margin-bottom:4px">Предмет для варианта {{ pickerTarget + 1 }}</div>
          <input class="adm-input" v-model="pickerQ" :placeholder="catalogReady ? 'Поиск: алмаз, netherite, ...' : 'Загрузка каталога…'" />
          <div class="up-picker-grid">
            <button v-for="it in pickerResults" :key="it.id" class="up-pick" :class="{ sel: form.icon === it.id }" @click="pickItem(it)" :title="(names[it.id] || '') + ' ' + it.id">
              <ItemIcon :itemKey="it.id" :size="26" />
            </button>
          </div>
        </div>

        <!-- type-specific fields -->
        <div class="bpr-fields">
          <template v-if="form.reward_type === 'money' || form.reward_type === 'voidcoin' || form.reward_type === 'exp'">
            <div class="bpr-grid2">
              <div>
                <label class="adm-label">{{ form.reward_type === 'voidcoin' ? 'Void Coins' : form.reward_type === 'exp' ? 'Опыт (очки)' : 'Монеты' }} — от</label>
                <input class="adm-input" type="number" min="1" v-model.number="form.amount" />
              </div>
              <div>
                <label class="adm-label">до <span style="color:var(--adm-faint)">(пусто = ровно)</span></label>
                <input class="adm-input" type="number" min="1" v-model.number="form.amount_max" />
              </div>
            </div>
          </template>
          <template v-else-if="form.reward_type === 'choice'">
            <p class="bpr-hint" style="margin:0 0 6px">Игрок выбирает один вариант. У каждого варианта свой тип и количество.</p>
            <div v-for="(o, i) in form.options" :key="i" class="bpr-opt">
              <div class="bpr-opt__head">
                <div class="up-ic"><ItemIcon v-if="o.icon" :itemKey="o.icon" :size="26" /></div>
                <b>Вариант {{ i + 1 }}</b>
                <select class="adm-select bpr-flt-sel" v-model="o.type">
                  <option v-for="(lab, tk) in plainTypeLabel" :key="tk" :value="tk">{{ lab }}</option>
                </select>
                <div style="flex:1"></div>
                <button v-if="o.type === 'item' || o.type === 'command'" class="adm-btn adm-btn--ghost adm-btn--sm" @click="openPickerFor(i)">Предмет</button>
                <button class="adm-btn adm-btn--danger adm-btn--sm" @click="removeOption(i)">✕</button>
              </div>
              <div class="bpr-grid2">
                <template v-if="o.type === 'money' || o.type === 'voidcoin' || o.type === 'exp'">
                  <div><label class="adm-label">от</label><input class="adm-input" type="number" min="1" v-model.number="o.amount" /></div>
                  <div><label class="adm-label">до</label><input class="adm-input" type="number" min="1" v-model.number="o.amount_max" /></div>
                </template>
                <template v-else>
                  <div><label class="adm-label">Кол-во от</label><input class="adm-input" type="number" min="1" v-model.number="o.count" /></div>
                  <div><label class="adm-label">до</label><input class="adm-input" type="number" min="1" v-model.number="o.count_max" /></div>
                </template>
              </div>
              <input v-if="o.type === 'command'" class="adm-input adm-mono" style="margin-top:6px" v-model="o.command" placeholder="/minecraft:give {player} create:brass_ingot {count}" />
              <input v-if="o.type === 'item'" class="adm-input adm-mono" style="margin-top:6px" v-model="o.material" placeholder="IRON_INGOT" />
              <input class="adm-input" style="margin-top:6px" v-model="o.display_name" placeholder="Название варианта" />
            </div>
            <button class="adm-btn adm-btn--ghost adm-btn--sm" :disabled="form.options.length >= 9" @click="addOption">+ Вариант</button>
          </template>
          <template v-else-if="form.reward_type === 'item'">
            <div class="bpr-grid2">
              <div>
                <label class="adm-label">Material (Bukkit)</label>
                <input class="adm-input adm-mono" v-model="form.material" placeholder="DIAMOND" />
              </div>
              <div>
                <label class="adm-label">Кол-во от / до</label>
                <div style="display:flex;gap:6px">
                  <input class="adm-input" type="number" min="1" max="6400" v-model.number="form.count" />
                  <input class="adm-input" type="number" min="1" max="6400" v-model.number="form.count_max" placeholder="—" />
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="form.reward_type === 'command'">
            <label class="adm-label">Команда <span style="color:var(--adm-faint)">({player} = ник, {count} = выпавшее количество)</span></label>
            <input class="adm-input adm-mono" v-model="form.command" placeholder="/minecraft:give {player} ae2:drive 1" />
            <div class="bpr-grid2" style="margin-top:8px">
              <div><label class="adm-label">Кол-во от</label><input class="adm-input" type="number" min="1" v-model.number="form.count" /></div>
              <div><label class="adm-label">до <span style="color:var(--adm-faint)">(нужен {count})</span></label><input class="adm-input" type="number" min="1" v-model.number="form.count_max" /></div>
            </div>
            <label class="adm-label" style="margin-top:8px">Иконка (item id для WebGUI)</label>
            <input class="adm-input adm-mono" v-model="form.icon" placeholder="ae2:drive" />
          </template>

          <label class="adm-label" style="margin-top:8px">Название (для GUI)</label>
          <input class="adm-input" v-model="form.display_name" placeholder="Напр. Алмазный рюкзак" />
        </div>

        <div class="bpr-modal__foot">
          <button v-if="form.id && canManage" class="adm-btn adm-btn--danger adm-btn--sm" :disabled="saving" @click="removeReward">Удалить</button>
          <div style="flex:1"></div>
          <button class="adm-btn adm-btn--ghost adm-btn--sm" :disabled="saving" @click="closeModal">{{ canManage ? 'Отмена' : 'Закрыть' }}</button>
          <button v-if="canManage" class="adm-btn adm-btn--acc adm-btn--sm" :disabled="saving" @click="save">{{ saving ? 'Сохранение…' : 'Сохранить' }}</button>
        </div>
      </div>
    </div>

    <!-- season create / edit modal -->
    <div v-if="seasonModalOpen && seasonForm" class="bpr-modal" @click.self="closeSeasonModal">
      <div class="bpr-modal__box adm-card" style="max-width:460px">
        <div class="bpr-modal__head">
          <div class="adm-title" style="font-size:1.05rem">{{ seasonMode === 'create' ? 'Новый сезон' : 'Редактировать сезон' }}</div>
          <button class="adm-btn adm-btn--ghost adm-btn--sm" @click="closeSeasonModal">✕</button>
        </div>

        <template v-if="seasonMode === 'create'">
          <label class="adm-label">Ключ сезона (стабильный, = season-start в config.yml)</label>
          <input class="adm-input adm-mono" v-model="seasonForm.season_key" placeholder="2026-11-30" />
          <p class="bpr-hint" style="margin-top:4px">Хранилище прогресса привязано к ключу — не меняется после создания.</p>
        </template>
        <template v-else>
          <label class="adm-label">Ключ сезона</label>
          <input class="adm-input adm-mono" :value="seasonForm.season_key" disabled />
        </template>

        <label class="adm-label" style="margin-top:8px">Название</label>
        <input class="adm-input" v-model="seasonForm.name" placeholder="Зимний сезон 2026" />

        <div class="bpr-grid2" style="grid-template-columns:1fr 1fr; margin-top:8px">
          <div>
            <label class="adm-label">Начало</label>
            <input class="adm-input" type="date" v-model="seasonForm.start_date" />
          </div>
          <div>
            <label class="adm-label">Окончание</label>
            <input class="adm-input" type="date" v-model="seasonForm.end_date" />
          </div>
        </div>

        <label class="adm-label" style="margin-top:8px">Количество уровней (кап)</label>
        <input class="adm-input" type="number" min="1" max="500" v-model.number="seasonForm.max_level" />

        <template v-if="seasonMode === 'edit'">
          <label class="adm-label" style="margin-top:10px">Границы зон</label>
          <p class="bpr-hint" style="margin:0 0 6px">После уровня N опыт не копится и награды не выдаются, пока игрок не откроет эпоху.</p>
          <div v-for="(g, i) in seasonForm.gates" :key="i" class="bpr-gate">
            <span>после ур.</span>
            <input class="adm-input" type="number" min="1" :max="seasonForm.max_level" v-model.number="g.level" style="width:80px" />
            <select class="adm-select" v-model="g.tier">
              <option v-for="[k, lab] in TIERS" :key="k" :value="k">{{ lab }}</option>
            </select>
            <button class="adm-btn adm-btn--danger adm-btn--sm" @click="removeGate(i)">✕</button>
          </div>
          <button class="adm-btn adm-btn--ghost adm-btn--sm" @click="addGate">+ Граница</button>
        </template>

        <template v-if="seasonMode === 'create'">
          <label class="adm-label" style="margin-top:8px">Скопировать награды из сезона</label>
          <select class="adm-select" v-model="seasonForm.copy_rewards_from">
            <option :value="''">— не копировать —</option>
            <option v-for="s in seasons" :key="s.season_key" :value="s.season_key">{{ s.name }} ({{ s.season_key }})</option>
          </select>
          <label class="adm-check" style="margin-top:8px">
            <input type="checkbox" v-model="seasonForm.activate" />
            <span>Сделать активным сразу</span>
          </label>
        </template>

        <div class="bpr-modal__foot">
          <div style="flex:1"></div>
          <button class="adm-btn adm-btn--ghost adm-btn--sm" :disabled="seasonSaving" @click="closeSeasonModal">Отмена</button>
          <button class="adm-btn adm-btn--acc adm-btn--sm" :disabled="seasonSaving" @click="saveSeason">{{ seasonSaving ? 'Сохранение…' : 'Сохранить' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bpr-opt { padding: 8px 10px; margin-bottom: 8px; border-radius: 10px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); }
.bpr-opt__head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.bpr-gate { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: .8rem; }
.bpr-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; justify-content: space-between; margin-bottom: 6px; }
.bpr-bar__left { display: flex; gap: 8px; align-items: center; }
.bpr-seasonmeta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; padding: 8px 12px; margin: 4px 0 2px; border-radius: 10px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); }
.bpr-seasonmeta__info { display: flex; flex-wrap: wrap; gap: 16px; font-size: .8rem; color: var(--adm-dim); }
.bpr-seasonmeta__info b { color: var(--adm-mut); }
.bpr-seasonmeta__actions { display: flex; flex-wrap: wrap; gap: 6px; }

.bpr-filters {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  margin: 10px 0 14px; padding: 8px 10px; border-radius: 12px;
  background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06);
}
.bpr-filters > * { height: 34px; }
/* search box with inline icon + clear */
.bpr-flt-search {
  flex: 1 1 220px; min-width: 180px; display: flex; align-items: center; gap: 7px;
  padding: 0 10px; border-radius: 9px; background: #080c16;
  border: 1px solid var(--adm-line-strong);
}
.bpr-flt-search:focus-within { border-color: var(--adm-acc-line); box-shadow: 0 0 0 3px var(--adm-acc-soft); }
.bpr-flt-search svg { width: 15px; height: 15px; color: var(--adm-faint); flex: 0 0 auto; }
.bpr-flt-search input { flex: 1; min-width: 0; height: 100%; border: 0; background: transparent; color: var(--adm-text); font-size: .82rem; outline: none; }
.bpr-flt-search input::placeholder { color: var(--adm-faint); }
.bpr-flt-clear { flex: 0 0 auto; border: 0; background: transparent; color: var(--adm-faint); cursor: pointer; font-size: .8rem; padding: 2px 4px; border-radius: 6px; }
.bpr-flt-clear:hover { color: var(--adm-mut); background: rgba(255,255,255,.06); }
/* selects */
.bpr-flt-sel { flex: 0 0 auto; min-width: 132px; height: 34px; }
/* level range as one pill */
.bpr-flt-range {
  display: flex; align-items: center; gap: 6px; padding: 0 10px; border-radius: 9px;
  background: #080c16; border: 1px solid var(--adm-line-strong);
}
.bpr-flt-range__lbl { font-size: .74rem; font-weight: 600; color: var(--adm-faint); }
.bpr-flt-range__dash { color: var(--adm-faint); }
.bpr-flt-num { width: 46px; height: 22px; text-align: center; border: 0; background: transparent; color: var(--adm-text); font-size: .82rem; font-variant-numeric: tabular-nums; outline: none; }
.bpr-flt-num::placeholder { color: var(--adm-faint); }
.bpr-flt-num::-webkit-outer-spin-button, .bpr-flt-num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.bpr-flt-check { flex: 0 0 auto; white-space: nowrap; padding: 0 4px; }
.bpr-flt-count { flex: 0 0 auto; margin-left: auto; display: inline-flex; align-items: center; font-size: .82rem; font-weight: 700; color: var(--adm-acc-text); font-variant-numeric: tabular-nums; }
.bpr-flt-count__tot { color: var(--adm-faint); font-weight: 600; }
.bpr-flt-reset { flex: 0 0 auto; }

.bpr-td-dim { opacity: .3; }
/* violet match highlight (matches admin accent) */
.bpr-cell--hit { border-color: var(--adm-acc-line) !important; background: var(--adm-acc-soft) !important; box-shadow: 0 0 0 1px var(--adm-acc-line); }
.bpr-cell--hit .bpr-cell__txt { color: var(--adm-acc-text); }
.bpr-bar__right { display: flex; gap: 8px; }
.bpr-season { min-width: 200px; }
.bpr-hint { font-size: .74rem; color: var(--adm-faint); margin: 4px 0 12px; }
.bpr-hint code { background: rgba(0,0,0,.25); padding: 1px 5px; border-radius: 4px; font-size: .72rem; }

.bpr-table td { vertical-align: middle; }
.bpr-lvl { font-weight: 800; color: var(--adm-mut); text-align: center; font-variant-numeric: tabular-nums; }
.bpr-cell {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  padding: 5px 9px; border-radius: 8px; background: rgba(255,255,255,.03);
  border: 1px solid rgba(255,255,255,.06); cursor: pointer; color: inherit; transition: background .12s, border-color .12s;
}
.bpr-cell:hover { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.14); }
.bpr-cell--prem { background: rgba(168,85,247,.07); border-color: rgba(168,85,247,.16); }
.bpr-cell--prem:hover { background: rgba(168,85,247,.14); }
.bpr-cell--empty { opacity: .5; }
.bpr-cell__txt { font-size: .8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bpr-plus { width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; color: var(--adm-faint); }

.bpr-modal { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
.bpr-modal__box { width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; padding: 18px; }
.bpr-modal__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.bpr-modal__foot { display: flex; gap: 8px; align-items: center; margin-top: 16px; }

.bpr-types { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.bpr-type { padding: 5px 12px; border-radius: 8px; font-size: .8rem; font-weight: 600; cursor: pointer; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); color: var(--adm-dim); }
.bpr-type.sel { background: var(--adm-acc, rgba(99,102,241,.25)); color: #fff; border-color: transparent; }

.bpr-sel { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.bpr-sel__meta { flex: 1; min-width: 0; }
.bpr-fields { margin-top: 4px; }
.bpr-grid2 { display: grid; grid-template-columns: 1fr 100px; gap: 8px; }

.up-ic { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: rgba(0,0,0,.2); }
.up-ic--lg { flex: 0 0 40px; }
.up-picker { margin-bottom: 12px; }
.up-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)); gap: 6px; max-height: 240px; overflow-y: auto; margin-top: 8px; padding: 4px; border-radius: 10px; background: rgba(0,0,0,.18); }
.up-pick { display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 8px; background: rgba(255,255,255,.03); border: 1px solid transparent; cursor: pointer; }
.up-pick:hover { background: rgba(255,255,255,.08); }
.up-pick.sel { border-color: var(--adm-acc, #6366f1); background: rgba(99,102,241,.18); }
</style>
