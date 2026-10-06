<script setup>
// Быстрый поиск по админке (Ctrl+K / Cmd+K): разделы, серверы, игроки по нику, действия.
// Стрелки — выбор, Enter — открыть, Esc — закрыть.
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authState, hasPermission } from '../../stores/authStore'
import { setActiveServer } from '../../stores/serverStore'
import { adminListPlayers } from '../../services/adminApi'

const props = defineProps({
  sections: { type: Array, required: true }, // [{ label, group, to, icon }]
  servers: { type: Array, default: () => [] },
  platform: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])
const router = useRouter()

const q = ref('')
const input = ref(null)
const active = ref(0)
const players = ref([])
const searching = ref(false)

onMounted(() => nextTick(() => input.value?.focus()))

// Небольшой нечёткий поиск: все слова запроса должны встретиться в тексте (без учёта регистра и ё).
const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е')
function matches(text, query) {
  const t = norm(text)
  return norm(query).split(/\s+/).filter(Boolean).every((w) => t.includes(w))
}

const ACTIONS = computed(() => [
  ...(props.platform ? [{ label: 'Новый сервер', hint: 'мастер в три шага', to: '/admin/server?new=1' }] : []),
  ...(hasPermission('news.updates.manage') || hasPermission('news.media.manage') ? [{ label: 'Написать новость', to: '/admin/news' }] : []),
  ...(hasPermission('punishments.manage') ? [{ label: 'Выдать наказание', to: '/admin/punishments' }] : []),
  ...(hasPermission('backups.manage') ? [{ label: 'Сделать бэкап', hint: 'выбранного сервера', to: '/admin/backups' }] : []),
])

const results = computed(() => {
  const query = q.value.trim()
  const out = []
  // By the section's own name: the group («VoidRP: Origins») would match every section of the server.
  const sections = props.sections.filter((s) => !query || matches(s.label, query))
  if (sections.length) out.push({ title: 'Разделы', items: sections.slice(0, query ? 8 : 6).map((s) => ({ kind: 'section', label: s.label, hint: s.group, to: s.to, icon: s.icon })) })
  const servers = props.servers.filter((s) => query && matches(`${s.name} ${s.slug}`, query))
  if (servers.length) {
    out.push({
      title: 'Серверы',
      items: servers.flatMap((s) => [
        { kind: 'switch', label: `Перейти на «${s.name}»`, hint: 'сделать активным', slug: s.slug },
        ...(props.platform || hasPermission('servers.manage') ? [{ kind: 'nav', label: `Настройки «${s.name}»`, hint: 'Серверы', to: `/admin/server?edit=${s.slug}` }] : []),
      ]),
    })
  }
  if (players.value.length) {
    out.push({ title: 'Игроки', items: players.value.map((p) => ({ kind: 'nav', label: p.minecraft_nickname || p.site_login, hint: p.site_login !== p.minecraft_nickname ? p.site_login : 'игрок', to: `/admin/players/${encodeURIComponent(p.minecraft_nickname || p.site_login)}` })) })
  }
  const actions = ACTIONS.value.filter((a) => !query || matches(a.label, query))
  if (actions.length) out.push({ title: 'Действия', items: actions.map((a) => ({ kind: 'nav', ...a })) })
  return out
})
const flat = computed(() => results.value.flatMap((g) => g.items))
watch(q, () => { active.value = 0 })

let timer = null
watch(q, (val) => {
  clearTimeout(timer)
  players.value = []
  const query = val.trim()
  if (query.length < 2 || !hasPermission('players.view')) return
  timer = setTimeout(async () => {
    searching.value = true
    try {
      const data = await adminListPlayers(authState.accessToken, { q: query, limit: 5, offset: 0 })
      if (q.value.trim() === query) players.value = data?.items || []
    } catch { players.value = [] } finally { searching.value = false }
  }, 250)
})

function run(item) {
  if (!item) return
  if (item.kind === 'switch') setActiveServer(item.slug)
  else router.push(item.to)
  emit('close')
}
function onKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = Math.min(flat.value.length - 1, active.value + 1); scrollActive() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(0, active.value - 1); scrollActive() }
  else if (e.key === 'Enter') { e.preventDefault(); run(flat.value[active.value]) }
  else if (e.key === 'Escape') { e.preventDefault(); emit('close') }
}
const list = ref(null)
function scrollActive() {
  nextTick(() => list.value?.querySelector('.cp-item--on')?.scrollIntoView({ block: 'nearest' }))
}
const indexOf = (item) => flat.value.indexOf(item)
</script>

<template>
  <div class="cp-backdrop" @mousedown.self="emit('close')">
    <div class="cp" role="dialog" aria-modal="true" aria-label="Быстрый поиск">
      <div class="cp-search">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input ref="input" v-model="q" type="text" placeholder="Раздел, сервер, ник игрока…" aria-label="Что найти" autocomplete="off" @keydown="onKey" />
        <kbd>Esc</kbd>
      </div>
      <div ref="list" class="cp-list">
        <div v-for="g in results" :key="g.title" class="cp-group">
          <div class="cp-group__title">{{ g.title }}</div>
          <button v-for="item in g.items" :key="`${g.title}-${item.label}`" type="button" class="cp-item" :class="{ 'cp-item--on': indexOf(item) === active }"
                  @mouseenter="active = indexOf(item)" @click="run(item)">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span v-if="item.icon" class="cp-item__icon" v-html="item.icon" />
            <span v-else class="cp-item__icon cp-item__icon--dot" />
            <span class="cp-item__label">{{ item.label }}</span>
            <span v-if="item.hint" class="cp-item__hint">{{ item.hint }}</span>
          </button>
        </div>
        <div v-if="!flat.length" class="cp-empty">{{ searching ? 'Ищу игроков…' : 'Ничего не нашлось' }}</div>
      </div>
      <div class="cp-foot"><span><kbd>↑</kbd><kbd>↓</kbd> выбрать</span><span><kbd>Enter</kbd> открыть</span><span><kbd>Ctrl</kbd>+<kbd>K</kbd> в любой момент</span></div>
    </div>
  </div>
</template>

<style scoped>
.cp-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(2, 4, 9, 0.6); backdrop-filter: blur(3px); display: flex; justify-content: center; align-items: flex-start; padding: 12vh 16px 16px; }
.cp { width: min(620px, 100%); max-height: 70vh; display: flex; flex-direction: column; border-radius: 16px; background: var(--adm-card-2); border: 1px solid var(--adm-line-strong); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6); overflow: hidden; }
.cp-search { display: flex; align-items: center; gap: 0.6rem; padding: 0.85rem 1rem; border-bottom: 1px solid var(--adm-line); color: var(--adm-dim); }
.cp-search input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--adm-text); font: inherit; font-size: 0.98rem; font-weight: 600; }
.cp-search input::placeholder { color: var(--adm-faint); }
kbd { font-family: var(--adm-mono); font-size: 0.62rem; padding: 0.1rem 0.35rem; border-radius: 5px; border: 1px solid var(--adm-line-strong); color: var(--adm-mut); background: rgba(148, 163, 184, 0.06); }
.cp-list { overflow-y: auto; padding: 0.4rem; }
.cp-group + .cp-group { margin-top: 0.3rem; }
.cp-group__title { padding: 0.4rem 0.6rem 0.25rem; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--adm-dim); }
.cp-item { width: 100%; display: flex; align-items: center; gap: 0.65rem; padding: 0.55rem 0.65rem; border-radius: 9px; border: 0; background: transparent; color: var(--adm-text); font: inherit; font-size: 0.86rem; font-weight: 600; cursor: pointer; text-align: left; }
.cp-item--on { background: var(--adm-acc-soft); }
.cp-item__icon { display: flex; color: var(--adm-mut); flex: none; }
.cp-item__icon :deep(svg) { width: 15px; height: 15px; }
.cp-item__icon--dot { width: 15px; height: 15px; align-items: center; justify-content: center; }
.cp-item__icon--dot::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--adm-dim); }
.cp-item--on .cp-item__icon { color: var(--adm-acc-text); }
.cp-item__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-item__hint { font-size: 0.72rem; color: var(--adm-dim); white-space: nowrap; }
.cp-empty { padding: 1.4rem; text-align: center; color: var(--adm-dim); font-size: 0.84rem; }
.cp-foot { display: flex; gap: 1rem; flex-wrap: wrap; padding: 0.55rem 1rem; border-top: 1px solid var(--adm-line); font-size: 0.7rem; color: var(--adm-dim); }
.cp-foot span { display: inline-flex; gap: 0.25rem; align-items: center; }
@media (max-width: 560px) { .cp-backdrop { padding-top: 8vh; } .cp-foot { display: none; } }
</style>
