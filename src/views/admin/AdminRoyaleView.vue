<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { authState, hasPermission } from '../../stores/authStore'
import { toastError, toastSuccess } from '../../services/toast'
import { confirmDialog } from '../../composables/useConfirm'
import { royaleDelete, royaleExport, royaleMatch, royaleMatches } from '../../services/royaleAdminApi'

// Battle royale (VoidRP: Royale): every game the plugin reports, each in full, and the
// export the Academy's teaching staff takes away as a table.

const token = () => authState.accessToken
const canManage = computed(() => hasPermission('royale.manage'))

const matches = ref([])
const loading = ref(true)
const showAborted = ref(false)
const selectedId = ref(null)
const detail = ref(null)
const detailLoading = ref(false)
const sortKey = ref('placement')
const sortDesc = ref(false)

const TEAM_COLORS = {
  red: '#f87171', blue: '#60a5fa', green: '#4ade80', yellow: '#facc15',
  orange: '#fb923c', purple: '#a855f7', aqua: '#67e8f9', pink: '#f472b6',
}
const STATUS = { winner: 'Победитель', eliminated: 'Выбыл', left: 'Вышел', playing: 'В игре' }

const visible = computed(() => matches.value.filter(m => showAborted.value || !m.aborted))
const when = (iso) => iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const clock = (s) => `${Math.floor((s || 0) / 60)}:${String((s || 0) % 60).padStart(2, '0')}`
const hearts = (d) => (Math.round(((d || 0) / 2) * 10) / 10).toLocaleString('ru-RU')

const COLUMNS = [
  { key: 'placement', label: 'Место' },
  { key: 'name', label: 'Игрок' },
  { key: 'kills', label: 'Убийства' },
  { key: 'assists', label: 'Помощь' },
  { key: 'damage_dealt', label: 'Урон ❤', fmt: hearts },
  { key: 'damage_taken', label: 'Получил ❤', fmt: hearts },
  { key: 'healed', label: 'Лечение ❤', fmt: hearts },
  { key: 'chests_opened', label: 'Сундуки' },
  { key: 'items_picked', label: 'Предметы' },
  { key: 'blocks_broken', label: 'Сломал' },
  { key: 'blocks_placed', label: 'Поставил' },
  { key: 'arrows_shot', label: 'Выстрелы' },
  { key: 'arrows_hit', label: 'Попадания' },
  { key: 'distance', label: 'Прошёл' },
  { key: 'alive_seconds', label: 'Время', fmt: clock },
]

const players = computed(() => {
  const rows = [...(detail.value?.payload?.players || [])]
  const k = sortKey.value
  rows.sort((a, b) => {
    const x = a[k] ?? 0
    const y = b[k] ?? 0
    const c = typeof x === 'string' ? x.localeCompare(y) : x - y
    return sortDesc.value ? -c : c
  })
  return rows
})
const teams = computed(() => detail.value?.payload?.teams || [])
const kills = computed(() => (detail.value?.payload?.events || []).filter(e => e.type === 'kill'))

function sortBy(key) {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value
  else { sortKey.value = key; sortDesc.value = key !== 'placement' && key !== 'name' }
}

async function load() {
  try {
    const res = await royaleMatches(token(), true)
    matches.value = res.items || []
    if (!selectedId.value && visible.value.length) open(visible.value[0].id)
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить матчи')
  } finally {
    loading.value = false
  }
}

async function open(id) {
  selectedId.value = id
  detailLoading.value = true
  try {
    detail.value = await royaleMatch(token(), id)
  } catch (e) {
    toastError(e.message || 'Не удалось открыть матч')
  } finally {
    detailLoading.value = false
  }
}

async function exportOne() {
  try { await royaleExport(token(), selectedId.value) } catch (e) { toastError(e.message) }
}
async function exportAll() {
  try { await royaleExport(token()) } catch (e) { toastError(e.message) }
}

async function remove() {
  if (!detail.value) return
  const ok = await confirmDialog({
    title: 'Удалить матч?',
    message: `Матч ${when(detail.value.started_at)} (${detail.value.players_count} игроков) пропадёт из статистики и выгрузок. Для тестовых игр.`,
    confirmLabel: 'Удалить',
    danger: true,
  })
  if (!ok) return
  try {
    await royaleDelete(token(), detail.value.id)
    toastSuccess('Матч удалён')
    selectedId.value = null
    detail.value = null
    await load()
  } catch (e) {
    toastError(e.message)
  }
}

let timer = null
onMounted(() => {
  load()
  timer = setInterval(load, 30000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1 class="adm-title">Королевская битва</h1>
        <p class="adm-sub">Матчи VoidRP: Royale — команды, места и вся статистика каждого игрока, выгрузка таблицей для учебной части.</p>
      </div>
      <div class="adm-head-actions">
        <button class="adm-btn adm-btn--acc" :disabled="!visible.length" @click="exportAll">Выгрузить все матчи (Excel)</button>
      </div>
    </div>

    <div v-if="loading" class="adm-skel" style="height: 320px" />

    <div v-else-if="!matches.length" class="adm-card adm-card--pad adm-empty">
      Матчей пока нет. После первой игры на сервере royale результаты появятся здесь сами.
    </div>

    <div v-else class="ry-grid">
      <aside class="adm-card ry-list">
        <label class="ry-toggle"><input v-model="showAborted" type="checkbox" /> показывать остановленные</label>
        <button
          v-for="m in visible"
          :key="m.id"
          class="ry-item"
          :class="{ 'ry-item--on': m.id === selectedId }"
          @click="open(m.id)"
        >
          <div class="ry-item-top">
            <b>{{ when(m.started_at) }}</b>
            <span v-if="m.aborted" class="adm-badge adm-badge--warn">остановлен</span>
          </div>
          <div class="ry-item-sub">
            {{ m.map_title || m.map }} · {{ clock(m.duration_seconds) }} · {{ m.players_count }} игр.
          </div>
          <div v-if="m.winner_title" class="ry-item-win" :style="{ color: TEAM_COLORS[m.winner] }">★ {{ m.winner_title }}</div>
        </button>
        <div v-if="!visible.length" class="ry-item-sub" style="padding: 12px">Только остановленные матчи.</div>
      </aside>

      <section class="ry-main">
        <div v-if="detailLoading && !detail" class="adm-skel" style="height: 300px" />
        <template v-else-if="detail">
          <div class="adm-card adm-card--pad ry-summary">
            <div>
              <div class="ry-h">{{ detail.map_title || detail.map }} · {{ when(detail.started_at) }}</div>
              <div class="ry-item-sub">
                Длительность {{ clock(detail.duration_seconds) }} · команд {{ detail.teams_count }} · игроков {{ detail.players_count }}
                <span v-if="detail.aborted"> · остановлен ведущим</span>
              </div>
            </div>
            <div class="ry-actions">
              <button class="adm-btn" @click="exportOne">Выгрузить этот матч (Excel)</button>
              <button v-if="canManage" class="adm-btn adm-btn--danger adm-btn--sm" @click="remove">Удалить</button>
            </div>
          </div>

          <div class="ry-teams">
            <div v-for="t in teams" :key="t.color" class="adm-card ry-team" :style="{ borderColor: TEAM_COLORS[t.color] }">
              <div class="ry-team-place">{{ t.placement || '—' }}</div>
              <div>
                <div class="ry-team-name" :style="{ color: TEAM_COLORS[t.color] }">{{ t.title }}</div>
                <div class="ry-item-sub">убийств {{ t.kills }} · урон {{ hearts(t.damage_dealt) }} ❤</div>
                <div class="ry-team-members">{{ (t.members || []).join(', ') }}</div>
              </div>
            </div>
          </div>

          <div class="adm-card adm-table-wrap">
            <div class="adm-table-scroll">
              <table class="adm-table ry-table">
                <thead>
                  <tr>
                    <th v-for="c in COLUMNS" :key="c.key" class="ry-th" @click="sortBy(c.key)">
                      {{ c.label }}<span v-if="sortKey === c.key">{{ sortDesc ? ' ▾' : ' ▴' }}</span>
                    </th>
                    <th>Команда</th>
                    <th>Итог</th>
                    <th>Кем выбит</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in players" :key="p.uuid">
                    <td v-for="c in COLUMNS" :key="c.key" :class="{ 'ry-name': c.key === 'name' }">
                      {{ c.fmt ? c.fmt(p[c.key]) : (p[c.key] ?? '—') }}
                    </td>
                    <td><span :style="{ color: TEAM_COLORS[p.team] }">{{ p.team_title }}</span></td>
                    <td>{{ STATUS[p.status] || p.status }}</td>
                    <td class="ry-muted">{{ p.killed_by ? `${p.killed_by}${p.killed_with ? ' · ' + p.killed_with : ''}` : (p.killed_with || '—') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="kills.length" class="adm-card adm-card--pad">
            <div class="ry-h" style="margin-bottom: 8px">Лента выбываний</div>
            <div v-for="(e, i) in kills" :key="i" class="ry-feed">
              <span class="ry-muted">{{ clock(e.t) }}</span>
              <template v-if="e.killer">
                <b :style="{ color: TEAM_COLORS[e.killer_team] }">{{ e.killer }}</b> → <b :style="{ color: TEAM_COLORS[e.victim_team] }">{{ e.victim }}</b>
              </template>
              <template v-else><b :style="{ color: TEAM_COLORS[e.victim_team] }">{{ e.victim }}</b> выбыл</template>
              <span v-if="e.with" class="ry-muted"> · {{ e.with }}</span>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ry-grid { display: grid; grid-template-columns: 280px 1fr; gap: 16px; align-items: start; }
@media (max-width: 900px) { .ry-grid { grid-template-columns: 1fr; } }
.ry-list { display: flex; flex-direction: column; padding: 8px; gap: 4px; max-height: 75vh; overflow: auto; }
.ry-toggle { font-size: 12px; opacity: .75; padding: 6px 8px; display: flex; gap: 6px; align-items: center; }
.ry-item { text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid transparent; background: transparent; color: inherit; cursor: pointer; }
.ry-item:hover { background: rgba(255, 255, 255, .04); }
.ry-item--on { background: rgba(255, 107, 61, .10); border-color: rgba(255, 107, 61, .35); }
.ry-item-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ry-item-sub { font-size: 12px; opacity: .7; margin-top: 2px; }
.ry-item-win { font-size: 12px; font-weight: 700; margin-top: 4px; }
.ry-main { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.ry-summary { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.ry-actions { display: flex; gap: 8px; }
.ry-h { font-weight: 700; font-size: 16px; }
.ry-teams { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.ry-team { display: flex; gap: 12px; padding: 12px 14px; border-left: 4px solid; }
.ry-team-place { font-size: 26px; font-weight: 800; min-width: 28px; text-align: center; }
.ry-team-name { font-weight: 800; }
.ry-team-members { font-size: 12px; opacity: .8; margin-top: 4px; }
.ry-table th, .ry-table td { white-space: nowrap; text-align: right; }
.ry-table th:nth-child(2), .ry-table td.ry-name { text-align: left; font-weight: 600; }
.ry-th { cursor: pointer; user-select: none; }
.ry-muted { opacity: .65; }
.ry-feed { font-size: 13px; padding: 3px 0; display: flex; gap: 6px; flex-wrap: wrap; }
</style>
