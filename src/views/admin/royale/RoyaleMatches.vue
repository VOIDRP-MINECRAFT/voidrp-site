<script setup>
// Every game the plugin reported: the list, and one game in full — the teams by place, the
// best players, every player's numbers (sortable), the eliminations in order, exports and
// certificates.
import { computed, onMounted, ref, watch } from 'vue'
import { authState, hasPermission } from '../../../stores/authStore'
import { toastError, toastSuccess } from '../../../services/toast'
import { confirmDialog } from '../../../composables/useConfirm'
import { royaleDelete, royaleDeleteAborted, royaleExport, royaleMatch } from '../../../services/royaleAdminApi'
import { STATUS, TEAM_COLORS, clock, hearts, plural, when } from './royaleUi'

const props = defineProps({ matches: { type: Array, default: () => [] }, loading: Boolean })
const emit = defineEmits(['reload'])

const token = () => authState.accessToken
const canManage = computed(() => hasPermission('royale.manage'))

const showAborted = ref(false)
const query = ref('')
const selectedId = ref(null)
const detail = ref(null)
const detailLoading = ref(false)
const sortKey = ref('placement')
const sortDesc = ref(false)

const aborted = computed(() => props.matches.filter((m) => m.aborted))
const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.matches.filter((m) => (showAborted.value || !m.aborted)
    && (!q || `${m.map_title || m.map} ${m.winner_title || ''} ${when(m.started_at)}`.toLowerCase().includes(q)))
})

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

const payloadPlayers = computed(() => detail.value?.payload?.players || [])
const players = computed(() => {
  const rows = [...payloadPlayers.value]
  const k = sortKey.value
  rows.sort((a, b) => {
    const x = a[k] ?? 0
    const y = b[k] ?? 0
    const c = typeof x === 'string' ? x.localeCompare(y) : x - y
    return sortDesc.value ? -c : c
  })
  return rows
})
const teams = computed(() => [...(detail.value?.payload?.teams || [])].sort((a, b) => (a.placement || 99) - (b.placement || 99)))
const kills = computed(() => (detail.value?.payload?.events || []).filter((e) => e.type === 'kill'))
const totalKills = computed(() => payloadPlayers.value.reduce((n, p) => n + (p.kills || 0), 0))

// The best of the game: one card each, the player and the number.
const best = computed(() => {
  const rows = payloadPlayers.value
  if (!rows.length) return []
  const top = (key) => rows.reduce((a, b) => ((b[key] || 0) > (a[key] || 0) ? b : a), rows[0])
  const out = []
  const k = top('kills')
  if (k.kills) out.push({ icon: '☠', label: 'Больше всех убийств', name: k.name, team: k.team, value: `${k.kills}` })
  const d = top('damage_dealt')
  if (d.damage_dealt) out.push({ icon: '⚔', label: 'Больше всех урона', name: d.name, team: d.team, value: `${hearts(d.damage_dealt)} ❤` })
  const a = top('alive_seconds')
  if (a.alive_seconds) out.push({ icon: '⏱', label: 'Дольше всех в живых', name: a.name, team: a.team, value: clock(a.alive_seconds) })
  const c = top('chests_opened')
  if (c.chests_opened) out.push({ icon: '🎁', label: 'Больше всех сундуков', name: c.name, team: c.team, value: `${c.chests_opened}` })
  const h = top('healed')
  if (h.healed) out.push({ icon: '❤', label: 'Больше всех лечился', name: h.name, team: h.team, value: `${hearts(h.healed)} ❤` })
  return out
})

function sortBy(key) {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value
  else { sortKey.value = key; sortDesc.value = key !== 'placement' && key !== 'name' }
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

function pickFirst() {
  if (selectedId.value && props.matches.some((m) => m.id === selectedId.value)) return
  selectedId.value = null
  detail.value = null
  if (visible.value.length) open(visible.value[0].id)
}
watch(() => props.matches, pickFirst)
onMounted(pickFirst)

async function exportOne() {
  try { await royaleExport(token(), selectedId.value) } catch (e) { toastError(e.message) }
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
    emit('reload')
  } catch (e) {
    toastError(e.message)
  }
}

async function removeAborted() {
  const n = aborted.value.length
  const ok = await confirmDialog({
    title: `Удалить остановленные матчи (${n})?`,
    message: 'Все игры, которые ведущий остановил до конца, пропадут из админки. Обычно это тесты и прогоны. Законченные игры останутся.',
    confirmLabel: 'Удалить все',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await royaleDeleteAborted(token())
    toastSuccess(`Удалено: ${res.deleted}`)
    emit('reload')
  } catch (e) {
    toastError(e.message)
  }
}
</script>

<template>
  <div v-if="loading" class="adm-skel" style="height: 360px" />
  <div v-else-if="!matches.length" class="adm-card adm-card--pad adm-empty">
    <div class="adm-empty__title">Матчей пока нет</div>
    <div class="adm-empty__sub">После первой игры результаты появятся здесь сами.</div>
  </div>
  <div v-else class="rm-grid">
    <aside class="adm-card rm-list">
      <div class="rm-list-head">
        <input v-model="query" class="adm-input" placeholder="Поиск: карта, победитель, дата" />
        <div class="rm-list-tools">
          <label class="adm-check rm-toggle"><input v-model="showAborted" type="checkbox" /> остановленные ({{ aborted.length }})</label>
          <button v-if="canManage && aborted.length" class="adm-btn adm-btn--ghost adm-btn--sm" @click="removeAborted">Удалить их</button>
        </div>
      </div>
      <button
        v-for="m in visible" :key="m.id" class="rm-item" :class="{ 'rm-item--on': m.id === selectedId }"
        :style="{ '--tc': TEAM_COLORS[m.winner] || 'var(--adm-faint)' }" @click="open(m.id)"
      >
        <div class="rm-item-top">
          <b>{{ when(m.started_at) }}</b>
          <span v-if="m.aborted" class="adm-badge adm-badge--warn">остановлен</span>
        </div>
        <div class="rm-item-sub">{{ m.map_title || m.map }} · {{ clock(m.duration_seconds) }} · {{ m.players_count }} {{ plural(m.players_count, 'игрок', 'игрока', 'игроков') }}</div>
        <div v-if="m.winner_title" class="rm-item-win">★ {{ m.winner_title }}</div>
      </button>
      <div v-if="!visible.length" class="rm-item-sub" style="padding: 12px">Ничего не нашлось.</div>
    </aside>

    <section class="rm-main">
      <div v-if="detailLoading && !detail" class="adm-skel" style="height: 300px" />
      <template v-else-if="detail">
        <div class="adm-card adm-card--pad rm-summary">
          <div>
            <div class="rm-h">{{ detail.map_title || detail.map }} · {{ when(detail.started_at) }}</div>
            <div class="rm-item-sub">
              <template v-if="detail.aborted">Остановлен ведущим</template>
              <template v-else-if="detail.winner_title">Победили <b :style="{ color: TEAM_COLORS[detail.winner] }">{{ detail.winner_title }}</b></template>
            </div>
          </div>
          <div class="rm-actions">
            <button class="adm-btn adm-btn--sm" @click="exportOne">⬇ Excel</button>
            <a class="adm-btn adm-btn--sm" :href="`/print/royale/${detail.id}`" target="_blank" rel="noopener">🏅 Грамоты</a>
            <button v-if="canManage" class="adm-btn adm-btn--danger adm-btn--sm" @click="remove">Удалить</button>
          </div>
        </div>

        <div class="rm-kpis">
          <div class="adm-kpi"><div><div class="adm-kpi__val">{{ clock(detail.duration_seconds) }}</div><div class="adm-kpi__label">длилась игра</div></div></div>
          <div class="adm-kpi"><div><div class="adm-kpi__val">{{ detail.players_count }}</div><div class="adm-kpi__label">игроков</div></div></div>
          <div class="adm-kpi"><div><div class="adm-kpi__val">{{ detail.teams_count }}</div><div class="adm-kpi__label">команд</div></div></div>
          <div class="adm-kpi"><div><div class="adm-kpi__val">{{ totalKills }}</div><div class="adm-kpi__label">убийств всего</div></div></div>
        </div>

        <div class="rm-teams">
          <div
            v-for="t in teams" :key="t.color" class="adm-card rm-team" :class="{ 'rm-team--win': t.placement === 1 }"
            :style="{ '--tc': TEAM_COLORS[t.color] }"
          >
            <div class="rm-team-place">{{ t.placement === 1 ? '🏆' : t.placement || '—' }}</div>
            <div class="rm-team-body">
              <div class="rm-team-name">{{ t.title }}</div>
              <div class="rm-item-sub">☠ {{ t.kills }} · урон {{ hearts(t.damage_dealt) }} ❤</div>
              <div class="rm-team-members">{{ (t.members || []).join(', ') }}</div>
            </div>
          </div>
        </div>

        <div v-if="best.length" class="rm-best">
          <div v-for="b in best" :key="b.label" class="adm-card rm-best-card">
            <div class="rm-best-icon">{{ b.icon }}</div>
            <div>
              <div class="rm-best-label">{{ b.label }}</div>
              <div class="rm-best-name" :style="{ color: TEAM_COLORS[b.team] }">{{ b.name }}</div>
              <div class="rm-best-val adm-num">{{ b.value }}</div>
            </div>
          </div>
        </div>

        <div class="adm-card adm-table-wrap">
          <div class="adm-table-scroll">
            <table class="adm-table rm-table">
              <thead>
                <tr>
                  <th v-for="c in COLUMNS" :key="c.key" class="rm-th" :class="{ 'rm-th--on': sortKey === c.key }" @click="sortBy(c.key)">
                    {{ c.label }}<span v-if="sortKey === c.key">{{ sortDesc ? ' ▾' : ' ▴' }}</span>
                  </th>
                  <th>Команда</th><th>Итог</th><th>Кем выбит</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in players" :key="p.uuid || p.name">
                  <td v-for="c in COLUMNS" :key="c.key" :class="{ 'rm-name': c.key === 'name' }">
                    {{ c.fmt ? c.fmt(p[c.key]) : (p[c.key] ?? '—') }}
                  </td>
                  <td><span :style="{ color: TEAM_COLORS[p.team] }">{{ p.team_title }}</span></td>
                  <td><span class="adm-badge" :class="p.status === 'winner' ? 'adm-badge--ok' : ''">{{ STATUS[p.status] || p.status }}</span></td>
                  <td class="rm-muted">{{ p.killed_by ? `${p.killed_by}${p.killed_with ? ' · ' + p.killed_with : ''}` : (p.killed_with || '—') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="kills.length" class="adm-card adm-card--pad">
          <div class="adm-card__head"><h3 class="adm-card__title">Выбывания по порядку · {{ kills.length }}</h3></div>
          <div class="rm-timeline">
            <div v-for="(e, i) in kills" :key="i" class="rm-ev">
              <span class="rm-ev-t adm-num">{{ clock(e.t) }}</span>
              <span class="rm-ev-dot" :style="{ background: TEAM_COLORS[e.victim_team] }" />
              <span>
                <template v-if="e.killer">
                  <b :style="{ color: TEAM_COLORS[e.killer_team] }">{{ e.killer }}</b> → <b :style="{ color: TEAM_COLORS[e.victim_team] }">{{ e.victim }}</b>
                </template>
                <template v-else><b :style="{ color: TEAM_COLORS[e.victim_team] }">{{ e.victim }}</b> выбыл</template>
                <span v-if="e.with" class="rm-muted"> · {{ e.with }}</span>
              </span>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.rm-grid { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 14px; align-items: start; }
@media (max-width: 900px) { .rm-grid { grid-template-columns: 1fr; } }
.rm-list { display: flex; flex-direction: column; padding: 8px; gap: 4px; max-height: 78vh; overflow: auto; position: sticky; top: 12px; }
@media (max-width: 900px) { .rm-list { position: static; max-height: 40vh; } }
.rm-list-head { display: flex; flex-direction: column; gap: 6px; padding: 4px 4px 8px; border-bottom: 1px solid var(--adm-line); margin-bottom: 4px; }
.rm-list-tools { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.rm-toggle { font-size: 12px; color: var(--adm-mut); display: flex; gap: 6px; align-items: center; }
.rm-item { text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid transparent; border-left: 3px solid var(--tc); background: transparent; color: inherit; cursor: pointer; }
.rm-item:hover { background: rgba(255, 255, 255, .04); }
.rm-item--on { background: var(--adm-acc-soft); border-color: var(--adm-acc-line); border-left-color: var(--tc); }
.rm-item-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: var(--adm-text); }
.rm-item-sub { font-size: 12px; color: var(--adm-mut); margin-top: 2px; }
.rm-item-win { font-size: 12px; font-weight: 800; margin-top: 4px; color: var(--tc); }
.rm-main { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.rm-summary { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.rm-h { font-weight: 800; font-size: 1.05rem; color: var(--adm-text); }
.rm-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.rm-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 640px) { .rm-kpis { grid-template-columns: repeat(2, 1fr); } }
.rm-teams { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.rm-team { display: flex; gap: 12px; padding: 12px 14px; border-left: 4px solid var(--tc); background: linear-gradient(100deg, color-mix(in srgb, var(--tc) 8%, transparent), transparent 60%); }
.rm-team--win { border-color: rgba(250, 204, 21, .45); border-left-color: var(--tc); box-shadow: 0 0 0 1px rgba(250, 204, 21, .12), 0 8px 24px -12px rgba(250, 204, 21, .35); }
.rm-team-place { font-size: 1.6rem; font-weight: 800; min-width: 32px; text-align: center; color: var(--adm-text); }
.rm-team-name { font-weight: 800; color: var(--tc); }
.rm-team-members { font-size: 12px; color: var(--adm-mut); margin-top: 4px; }
.rm-best { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
.rm-best-card { display: flex; gap: 10px; padding: 12px 14px; align-items: center; }
.rm-best-icon { font-size: 1.3rem; width: 2.2rem; height: 2.2rem; display: grid; place-items: center; border-radius: 10px; background: rgba(148, 163, 184, .08); }
.rm-best-label { font-size: .68rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--adm-dim); }
.rm-best-name { font-weight: 800; }
.rm-best-val { font-size: .8rem; color: var(--adm-mut); }
.rm-table th, .rm-table td { white-space: nowrap; text-align: right; }
.rm-table th:nth-child(2), .rm-table td.rm-name { text-align: left; font-weight: 700; }
.rm-th { cursor: pointer; user-select: none; }
.rm-th--on { color: var(--adm-acc-text); }
.rm-muted { color: var(--adm-dim); }
.rm-timeline { display: flex; flex-direction: column; }
.rm-ev { display: grid; grid-template-columns: 3.2em 14px 1fr; gap: 6px; align-items: center; font-size: 13px; padding: 4px 0; color: var(--adm-text); }
.rm-ev-t { color: var(--adm-dim); font-size: 12px; }
.rm-ev-dot { width: 8px; height: 8px; border-radius: 50%; }
</style>
