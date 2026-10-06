<script setup>
import AdminSaveBar from '../../components/admin/AdminSaveBar.vue'
import { useUnsavedGuard } from '../../composables/useUnsavedGuard'
// «Права в игре»: группы LuckPerms выбранного сервера. Изменения уходят на сервер через
// плагин VoidRpPerms (очередь, ~10 с); в игре /lp для игроков закрыт — только здесь.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { authState } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'
import NickSuggest from '../../components/admin/NickSuggest.vue'
import {
  addGroupMember, changeGroupMeta, changeGroupNode, changeGroupParent, createGameGroup, deleteGameGroup,
  getGameOps, getGamePerms, removeGroupMember, setGroupOwnerOnly,
} from '../../services/gamePermsApi'

const token = () => authState.accessToken
const data = ref(null)
const loading = ref(true)
const selectedName = ref(null)
const tab = ref('perms')
const nodeQuery = ref('')
const memberName = ref('')
const newGroup = ref(null)
const ops = ref([])
const meta = ref(null)
let timer = null

const groups = computed(() => data.value?.groups || [])
const selected = computed(() => groups.value.find((g) => g.name === selectedName.value) || null)
const permsByNode = computed(() => Object.fromEntries((data.value?.permissions || []).map((p) => [p.node, p])))

async function load(silent = false) {
  if (!silent) loading.value = !data.value
  try {
    data.value = await getGamePerms(token())
    if (data.value.available && (!selectedName.value || !groups.value.some((g) => g.name === selectedName.value))) {
      selectedName.value = groups.value[0]?.name || null
    }
    ops.value = (await getGameOps(token())).items || []
  } catch (e) {
    if (!silent) toastError(e?.message || 'Не удалось загрузить')
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  load()
  // Пока на сервере ждут изменения — следим за результатом.
  timer = setInterval(() => { if (data.value?.pending) load(true) }, 4000)
})
onBeforeUnmount(() => clearInterval(timer))

watch(selected, (g) => {
  meta.value = g ? { weight: g.weight ?? '', prefix: g.prefix || '', suffix: g.suffix || '', display: g.display || '' } : null
}, { immediate: true })

// ── Minecraft-цвета в префиксах (&c, &l …) ──
const MC = { 0: '#000', 1: '#00a', 2: '#0a0', 3: '#0aa', 4: '#a00', 5: '#a0a', 6: '#fa0', 7: '#aaa', 8: '#555', 9: '#55f', a: '#5f5', b: '#5ff', c: '#f55', d: '#f5f', e: '#ff5', f: '#fff' }
function mcParts(text) {
  const out = []
  let color = '#e8ecf4'
  let bold = false
  for (const part of String(text || '').split(/(&[0-9a-fk-or])/i)) {
    const m = /^&([0-9a-fk-or])$/i.exec(part)
    if (m) {
      const c = m[1].toLowerCase()
      if (MC[c]) { color = MC[c]; bold = false } else if (c === 'l') bold = true; else if (c === 'r') { color = '#e8ecf4'; bold = false }
    } else if (part) out.push({ text: part, color, bold })
  }
  return out
}

// ── Права группы ──
const shownNodes = computed(() => {
  const q = nodeQuery.value.trim().toLowerCase()
  return (selected.value?.nodes || []).filter((n) => !q || n.key.toLowerCase().includes(q))
})
const suggestions = computed(() => {
  const q = nodeQuery.value.trim().toLowerCase()
  if (q.length < 2 || !selected.value) return []
  const have = new Set(selected.value.nodes.map((n) => n.key))
  return (data.value?.permissions || [])
    .filter((p) => !have.has(p.node) && (p.node.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)))
    .slice(0, 12)
})
async function queued(fn, msg) {
  try {
    await fn()
    toastSuccess(msg || 'Отправлено на сервер — применится за несколько секунд')
    await load(true)
  } catch (e) {
    if (!e?.securityCode) toastError(e?.message || 'Не удалось')
  }
}
const addNode = (key, value = true) => queued(() => changeGroupNode(token(), selected.value.name, { key, value }), `«${key}» добавлено`)
function addTyped() {
  const key = nodeQuery.value.trim()
  if (!key) return
  addNode(key.replace(/^-/, ''), !key.startsWith('-'))
  nodeQuery.value = ''
}
const removeNode = (n) => queued(() => changeGroupNode(token(), selected.value.name, { key: n.key, value: n.value, contexts: n.contexts || null, expiry: n.expiry || null, remove: true }), `«${n.key}» снято`)

// ── Оформление и наследование ──
// Changes go through the server's queue: after sending, the group shows the old values until
// the plugin applies them — the bar should not keep saying «изменено» meanwhile.
const metaSent = ref('')
const metaSaving = ref(false)
watch(() => selected.value?.name, () => { metaSent.value = '' })
const metaDirty = computed(() => {
  const g = selected.value
  if (!g || !g.may_edit || !meta.value) return false
  if (metaSent.value && metaSent.value === JSON.stringify(meta.value)) return false
  const w = meta.value.weight === '' || meta.value.weight == null ? null : Number(meta.value.weight)
  return w !== (g.weight ?? null) || ['prefix', 'suffix', 'display'].some((k) => (meta.value[k] || '') !== (g[k] || ''))
})
function resetMeta() {
  const g = selected.value
  meta.value = { weight: g.weight ?? '', prefix: g.prefix || '', suffix: g.suffix || '', display: g.display || '' }
}
useUnsavedGuard(() => metaDirty.value)
async function saveMeta() {
  const g = selected.value
  const body = {}
  const w = meta.value.weight === '' ? null : Number(meta.value.weight)
  if (w !== (g.weight ?? null)) body.weight = w
  for (const k of ['prefix', 'suffix', 'display']) if ((meta.value[k] || '') !== (g[k] || '')) body[k] = meta.value[k] || ''
  if (!Object.keys(body).length) return
  metaSaving.value = true
  try {
    await queued(() => changeGroupMeta(token(), g.name, body), 'Оформление отправлено на сервер')
    metaSent.value = JSON.stringify(meta.value)
  } finally { metaSaving.value = false }
}
const parentOptions = computed(() => groups.value.filter((g) => g.name !== selected.value?.name && !selected.value?.parents.includes(g.name)))
const addParent = (p) => p && queued(() => changeGroupParent(token(), selected.value.name, p))
const removeParent = (p) => queued(() => changeGroupParent(token(), selected.value.name, p, true))

// ── Участники ──
function source(m) {
  if (m.roles?.length) return { cls: 'gp-src--role', text: `роль: ${m.roles.join(', ')}` }
  if (m.direct) return { cls: 'gp-src--direct', text: 'выдано в админке' }
  if (m.managed) return { cls: 'gp-src--direct', text: 'выдано админкой' }
  return { cls: 'gp-src--manual', text: 'выдано вручную в игре' }
}
async function addMember() {
  const name = memberName.value.trim()
  if (!name) return
  await queued(() => addGroupMember(token(), selected.value.name, name), `${name} получит группу через несколько секунд`)
  memberName.value = ''
}
async function removeMember(m) {
  const ok = await confirmDialog({ title: `Снять группу «${selected.value.name}» с ${m.name}?`, message: 'Изменение уйдёт на сервер.', confirmLabel: 'Снять', danger: true })
  if (ok) await queued(() => removeGroupMember(token(), selected.value.name, m.name), 'Отправлено на сервер')
}

// ── Группы ──
async function create() {
  const name = (newGroup.value || '').trim().toLowerCase()
  if (!name) return
  await queued(() => createGameGroup(token(), name), `Группа «${name}» создаётся на сервере`)
  newGroup.value = null
}
async function removeGroup() {
  const g = selected.value
  const ok = await confirmDialog({ title: `Удалить группу «${g.name}»?`, message: 'Она пропадёт у всех игроков и из ролей. Отменить нельзя.', confirmLabel: 'Удалить', danger: true })
  if (ok) await queued(() => deleteGameGroup(token(), g.name), 'Группа удаляется на сервере')
}
const toggleOwnerOnly = () => queued(() => setGroupOwnerOnly(token(), selected.value.name, !selected.value.owner_only), 'Сохранено')

const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'только что'
  if (s < 3600) return `${Math.round(s / 60)} мин назад`
  if (s < 86400) return `${Math.round(s / 3600)} ч назад`
  return `${Math.round(s / 86400)} дн назад`
}
function opText(o) {
  const x = o.op
  switch (x.op) {
    case 'user.parent': return `${x.remove ? 'снять' : 'выдать'} ${x.group} — ${x.name}`
    case 'group.node': return `${x.group}: ${x.remove ? '−' : '+'} ${x.value === false ? '-' : ''}${x.key}`
    case 'group.meta': return `${x.group}: оформление`
    case 'group.parent': return `${x.group}: ${x.remove ? 'не наследует' : 'наследует'} ${x.parent}`
    case 'group.create': return `создать группу ${x.group}`
    case 'group.delete': return `удалить группу ${x.group}`
    default: return x.op
  }
}
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Права в игре</h1>
        <p class="adm-sub">Группы LuckPerms этого сервера. В игре <code>/lp</code> закрыт — права меняются только здесь.</p>
      </div>
      <div v-if="data?.available" class="adm-head-actions">
        <span class="gp-sync" :class="{ 'gp-sync--busy': data.pending }">
          <i />{{ data.pending ? `применяется: ${data.pending}` : `сервер ответил ${ago(data.updated_at)}` }}
        </span>
        <button v-if="data.me.may_create" class="adm-btn adm-btn--acc" :disabled="newGroup !== null" @click="newGroup = ''">Новая группа</button>
      </div>
    </div>

    <div v-if="loading" class="adm-skel" style="height: 360px" />

    <div v-else-if="data && !data.available" class="adm-card adm-card--pad gp-empty">
      <b>На этом сервере нет плагина VoidRpPerms</b>
      <p>Поставь <code>VoidRpPerms.jar</code> в папку plugins рядом с LuckPerms, впиши в его config.yml секрет сервера и перезапусти — группы появятся здесь сами.</p>
    </div>

    <template v-else-if="data">
      <form v-if="newGroup !== null" class="adm-card adm-card--pad gp-new" @submit.prevent="create">
        <input v-model="newGroup" class="adm-input" placeholder="имя группы латиницей, например helper" maxlength="36" autofocus />
        <button class="adm-btn adm-btn--acc">Создать</button>
        <button type="button" class="adm-btn" @click="newGroup = null">Отмена</button>
      </form>

      <div class="gp-layout">
        <aside class="adm-card gp-list">
          <button
            v-for="g in groups" :key="g.name" type="button" class="gp-item" :class="{ 'gp-item--on': g.name === selectedName }"
            @click="selectedName = g.name; tab = 'perms'; nodeQuery = ''"
          >
            <span class="gp-item__main">
              <b>{{ g.name }}</b>
              <span class="gp-item__prefix"><span v-for="(p, i) in mcParts(g.prefix)" :key="i" :style="{ color: p.color, fontWeight: p.bold ? 800 : 600 }">{{ p.text }}</span></span>
            </span>
            <span class="gp-item__w adm-num" title="Вес — чем больше, тем старше">{{ g.weight ?? '—' }}</span>
            <span class="gp-item__n adm-num" title="Участников">{{ g.members.length }}</span>
            <svg v-if="g.owner_only" class="gp-item__lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
          </button>
          <p class="gp-hint">Порядок — по весу. Выдавать можно только группы легче своей; группы с замком — только владелец.</p>
        </aside>

        <section v-if="selected" class="adm-card gp-editor">
          <header class="gp-editor__head">
            <div>
              <div class="gp-editor__name">{{ selected.name }}
                <span v-if="selected.prefix" class="gp-editor__prefix"><span v-for="(p, i) in mcParts(selected.prefix)" :key="i" :style="{ color: p.color, fontWeight: p.bold ? 800 : 600 }">{{ p.text }}</span></span>
              </div>
              <div class="gp-editor__sub">
                вес {{ selected.weight ?? '—' }} · {{ selected.nodes.length }} прав · {{ selected.members.length }} участников
                <template v-if="selected.parents.length"> · наследует {{ selected.parents.join(', ') }}</template>
                <template v-if="selected.roles.length"> · в ролях: {{ selected.roles.map((r) => r.name).join(', ') }}</template>
              </div>
            </div>
            <div class="adm-tabs">
              <button class="adm-tab" :class="{ 'adm-tab--active': tab === 'perms' }" @click="tab = 'perms'">Права</button>
              <button class="adm-tab" :class="{ 'adm-tab--active': tab === 'look' }" @click="tab = 'look'">Оформление</button>
              <button class="adm-tab" :class="{ 'adm-tab--active': tab === 'members' }" @click="tab = 'members'">Участники · {{ selected.members.length }}</button>
            </div>
          </header>

          <div v-if="!selected.may_edit && tab !== 'members'" class="gp-lock">
            Только просмотр: менять состав групп можно с правом «Права в игре: менять состав групп»<template v-if="selected.owner_only">, а эту группу — только владелец</template>.
          </div>

          <!-- Права -->
          <div v-if="tab === 'perms'" class="gp-pane">
            <form v-if="selected.may_edit" class="gp-add" @submit.prevent="addTyped">
              <input v-model="nodeQuery" class="adm-input" placeholder="Поиск или новое право: essentials.kick, -worldedit.* (минус — запрет)" />
              <button class="adm-btn adm-btn--acc" :disabled="!nodeQuery.trim()">Добавить</button>
            </form>
            <input v-else v-model="nodeQuery" class="adm-input gp-add" placeholder="Поиск по правам группы" />
            <ul v-if="suggestions.length && selected.may_edit" class="gp-sugg">
              <li v-for="p in suggestions" :key="p.node">
                <button type="button" @click="addNode(p.node); nodeQuery = ''">
                  <code>{{ p.node }}</code>
                  <span>{{ p.description || '—' }}</span>
                  <em v-if="p.plugin">{{ p.plugin }}</em>
                </button>
              </li>
            </ul>
            <ul class="gp-nodes">
              <li v-for="n in shownNodes" :key="n.key + JSON.stringify(n.contexts || {})" :class="{ 'gp-node--deny': !n.value }">
                <code>{{ n.value ? '' : '−' }}{{ n.key }}</code>
                <span class="gp-node__desc">{{ permsByNode[n.key]?.description || (n.key.endsWith('*') ? 'все права группы узлов' : '') }}</span>
                <span v-if="n.contexts" class="gp-node__ctx">{{ Object.entries(n.contexts).map(([k, v]) => `${k}=${v.join(',')}`).join(' ') }}</span>
                <span v-if="n.expiry" class="gp-node__ctx">до {{ new Date(n.expiry * 1000).toLocaleDateString('ru-RU') }}</span>
                <em v-if="permsByNode[n.key]?.plugin" class="gp-node__plugin">{{ permsByNode[n.key].plugin }}</em>
                <button v-if="selected.may_edit" type="button" class="gp-x" title="Снять" @click="removeNode(n)">×</button>
              </li>
              <li v-if="!shownNodes.length" class="gp-none">{{ nodeQuery ? 'Не найдено' : 'Своих прав нет' }}{{ selected.parents.length ? ` — всё наследуется от ${selected.parents.join(', ')}` : '' }}</li>
            </ul>
          </div>

          <!-- Оформление -->
          <div v-else-if="tab === 'look'" class="gp-pane gp-look">
            <label class="adm-field"><span>Вес (старшинство)</span><input v-model="meta.weight" type="number" min="0" class="adm-input" :disabled="!selected.may_edit" /></label>
            <label class="adm-field"><span>Префикс в чате (цвета &amp;c, &amp;l…)</span><input v-model="meta.prefix" class="adm-input" maxlength="64" :disabled="!selected.may_edit" /></label>
            <div class="gp-preview">
              <span v-for="(p, i) in mcParts(meta.prefix)" :key="i" :style="{ color: p.color, fontWeight: p.bold ? 800 : 600 }">{{ p.text }}</span><span class="gp-preview__nick">Игрок</span>
              <span v-for="(p, i) in mcParts(meta.suffix)" :key="'s' + i" :style="{ color: p.color, fontWeight: p.bold ? 800 : 600 }">{{ p.text }}</span><span class="gp-preview__msg">: привет!</span>
            </div>
            <label class="adm-field"><span>Суффикс</span><input v-model="meta.suffix" class="adm-input" maxlength="64" :disabled="!selected.may_edit" /></label>
            <label class="adm-field"><span>Отображаемое имя группы</span><input v-model="meta.display" class="adm-input" maxlength="64" :disabled="!selected.may_edit" /></label>
            <AdminSaveBar :dirty="metaDirty" :saving="metaSaving" :text="`оформление группы «${selected.name}»`" save-label="Сохранить оформление" @save="saveMeta" @reset="resetMeta" />

            <div class="adm-field">
              <span>Наследует права групп</span>
              <div class="gp-parents">
                <span v-for="p in selected.parents" :key="p" class="gp-chip">{{ p }}<button v-if="selected.may_edit" type="button" @click="removeParent(p)">×</button></span>
                <select v-if="selected.may_edit && parentOptions.length" class="adm-select" @change="addParent($event.target.value); $event.target.value = ''">
                  <option value="">+ добавить</option>
                  <option v-for="g in parentOptions" :key="g.name" :value="g.name">{{ g.name }}</option>
                </select>
                <span v-if="!selected.parents.length && !selected.may_edit" class="gp-none">не наследует</span>
              </div>
            </div>

            <div class="gp-danger">
              <label v-if="data.me.owner" class="gp-flag">
                <input type="checkbox" :checked="selected.owner_only" @change="toggleOwnerOnly" />
                <span><b>Только владелец</b><small>выдавать и менять эту группу сможешь только ты — для admin, owner и групп с OP-правами</small></span>
              </label>
              <button v-if="selected.may_edit && selected.name !== 'default'" class="adm-btn adm-btn--danger adm-btn--sm" @click="removeGroup">Удалить группу</button>
            </div>
          </div>

          <!-- Участники -->
          <div v-else class="gp-pane">
            <form v-if="selected.may_give" class="gp-add" @submit.prevent="addMember">
              <NickSuggest v-model="memberName" placeholder="Ник игрока — выдать группу" @submit="addMember" />
              <button class="adm-btn adm-btn--acc" :disabled="!memberName.trim()">Выдать</button>
            </form>
            <p v-else class="gp-lock">Выдавать эту группу нельзя: она не легче твоей игровой группы<template v-if="selected.owner_only"> или только для владельца</template>.</p>
            <ul class="gp-members">
              <li v-for="m in selected.members" :key="m.uuid">
                <span class="adm-avatar gp-ava">{{ (m.name || '?').charAt(0).toUpperCase() }}</span>
                <span class="gp-m__name">{{ m.name || m.uuid }}</span>
                <span class="gp-src" :class="source(m).cls">{{ source(m).text }}</span>
                <button v-if="selected.may_give && !m.roles?.length" type="button" class="gp-x" title="Снять группу" @click="removeMember(m)">×</button>
              </li>
              <li v-if="!selected.members.length" class="gp-none">В группе никого нет{{ selected.name === 'default' ? ' — она есть у всех по умолчанию' : '' }}</li>
            </ul>
          </div>
        </section>
      </div>

      <details class="adm-card gp-ops">
        <summary>История изменений на сервере</summary>
        <ul>
          <li v-for="o in ops" :key="o.id" :class="`gp-op--${o.status}`">
            <span class="gp-op__st">{{ o.status === 'done' ? '✓' : o.status === 'failed' ? '✕' : '…' }}</span>
            <span class="gp-op__txt">{{ opText(o) }}</span>
            <span class="gp-op__res">{{ o.status === 'failed' ? o.result : '' }}</span>
            <span class="gp-op__by">{{ o.by }} · {{ ago(o.at) }}</span>
          </li>
          <li v-if="!ops.length" class="gp-none">Изменений пока не было</li>
        </ul>
      </details>
    </template>
  </div>
</template>

<style scoped>
.gp-sync { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.74rem; color: var(--adm-dim); }
.gp-sync i { width: 0.45rem; height: 0.45rem; border-radius: 50%; background: var(--adm-ok); }
.gp-sync--busy i { background: var(--adm-warn); animation: gp-pulse 1s ease-in-out infinite; }
@keyframes gp-pulse { 50% { opacity: 0.3; } }
.gp-empty { display: flex; flex-direction: column; gap: 0.5rem; max-width: 640px; }
.gp-empty p { margin: 0; font-size: 0.84rem; color: var(--adm-mut); line-height: 1.55; }
.gp-new { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.gp-layout { display: grid; grid-template-columns: minmax(230px, 280px) 1fr; gap: 1rem; align-items: start; }
@media (max-width: 900px) { .gp-layout { grid-template-columns: 1fr; } }
.gp-list { padding: 0.55rem; display: flex; flex-direction: column; gap: 2px; }
.gp-item { display: flex; align-items: center; gap: 0.55rem; padding: 0.55rem 0.6rem; border-radius: 9px; border: none; background: transparent; cursor: pointer; text-align: left; color: inherit; }
.gp-item:hover { background: rgba(148, 163, 184, 0.06); }
.gp-item--on { background: var(--adm-acc-soft); }
.gp-item__main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.gp-item__main b { font-size: 0.86rem; color: var(--adm-text); }
.gp-item__prefix { font-size: 0.7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp-item__w { font-size: 0.66rem; color: var(--adm-acc-text); background: var(--adm-acc-soft); border-radius: 6px; padding: 0.05rem 0.35rem; }
.gp-item__n { font-size: 0.66rem; color: var(--adm-mut); background: rgba(148, 163, 184, 0.08); border-radius: 999px; padding: 0.05rem 0.4rem; }
.gp-item__lock { width: 0.8rem; height: 0.8rem; color: var(--adm-warn); flex-shrink: 0; }
.gp-hint { margin: 0.6rem 0.5rem 0.2rem; font-size: 0.7rem; line-height: 1.45; color: var(--adm-dim); }
.gp-editor { padding: 0; overflow: hidden; }
.gp-editor__head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; padding: 1rem 1.2rem; border-bottom: 1px solid var(--adm-line); }
.gp-editor__name { font-size: 1.05rem; font-weight: 800; color: var(--adm-text); display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
.gp-editor__prefix { font-size: 0.8rem; padding: 0.1rem 0.45rem; border-radius: 6px; background: rgba(0, 0, 0, 0.35); }
.gp-editor__sub { font-size: 0.72rem; color: var(--adm-dim); margin-top: 0.2rem; }
.gp-lock { margin: 0.9rem 1.2rem 0; padding: 0.55rem 0.8rem; border-radius: 9px; font-size: 0.76rem; color: var(--adm-mut); background: rgba(148, 163, 184, 0.06); }
.gp-pane { padding: 1rem 1.2rem 1.3rem; }
.gp-add { display: flex; gap: 0.5rem; margin-bottom: 0.7rem; }
.gp-add .adm-input { flex: 1; }
.gp-sugg { list-style: none; margin: -0.3rem 0 0.8rem; padding: 0.3rem; border-radius: 10px; border: 1px solid var(--adm-line-strong); background: var(--adm-bg-soft); max-height: 16rem; overflow-y: auto; }
.gp-sugg button { display: grid; grid-template-columns: minmax(10rem, auto) 1fr auto; gap: 0.7rem; align-items: baseline; width: 100%; padding: 0.4rem 0.5rem; border: none; border-radius: 7px; background: transparent; cursor: pointer; text-align: left; color: var(--adm-mut); font-size: 0.76rem; }
.gp-sugg button:hover { background: var(--adm-acc-soft); color: var(--adm-text); }
.gp-sugg code, .gp-nodes code { font-family: var(--adm-mono); font-size: 0.78rem; color: var(--adm-text); }
.gp-sugg em, .gp-node__plugin { font-style: normal; font-size: 0.66rem; color: var(--adm-info); }
.gp-nodes, .gp-members { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.gp-nodes li { display: flex; align-items: baseline; gap: 0.6rem; padding: 0.4rem 0.6rem; border-radius: 8px; background: var(--adm-bg-soft); flex-wrap: wrap; }
.gp-node--deny code { color: var(--adm-err); }
.gp-node__desc { flex: 1; min-width: 8rem; font-size: 0.74rem; color: var(--adm-dim); }
.gp-node__ctx { font-size: 0.66rem; color: var(--adm-warn); }
.gp-x { margin-left: auto; padding: 0 0.35rem; border: none; background: none; color: var(--adm-dim); font-size: 1.05rem; line-height: 1; cursor: pointer; }
.gp-x:hover { color: var(--adm-err); }
.gp-none { font-size: 0.78rem; color: var(--adm-dim); padding: 0.4rem 0.2rem; }
.gp-look { display: flex; flex-direction: column; gap: 0.9rem; max-width: 560px; }
.gp-preview { padding: 0.55rem 0.8rem; border-radius: 8px; background: #16181d; font-family: var(--adm-mono); font-size: 0.86rem; }
.gp-preview__nick { color: #fff; font-weight: 600; }
.gp-preview__msg { color: #ddd; }
.gp-save { align-self: flex-start; }
.gp-parents { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin-top: 0.3rem; }
.gp-chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.3rem 0.2rem 0.6rem; border-radius: 999px; font-size: 0.76rem; font-weight: 700; color: var(--adm-text); background: var(--adm-acc-soft); }
.gp-chip button { border: none; background: none; color: var(--adm-dim); cursor: pointer; }
.gp-danger { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; padding-top: 0.9rem; border-top: 1px solid var(--adm-line); }
.gp-flag { display: flex; gap: 0.55rem; align-items: flex-start; cursor: pointer; max-width: 380px; }
.gp-flag input { margin-top: 0.2rem; accent-color: var(--adm-acc); }
.gp-flag b { display: block; font-size: 0.82rem; color: var(--adm-text); }
.gp-flag small { font-size: 0.72rem; color: var(--adm-dim); }
.gp-members li { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.6rem; border-radius: 9px; background: var(--adm-bg-soft); }
.gp-ava { width: 1.6rem; height: 1.6rem; font-size: 0.68rem; }
.gp-m__name { font-weight: 700; font-size: 0.84rem; color: var(--adm-text); }
.gp-src { font-size: 0.68rem; font-weight: 700; padding: 0.08rem 0.45rem; border-radius: 999px; }
.gp-src--role { color: var(--adm-acc-text); background: var(--adm-acc-soft); }
.gp-src--direct { color: var(--adm-ok); background: rgba(52, 211, 153, 0.1); }
.gp-src--manual { color: var(--adm-warn); background: rgba(251, 191, 36, 0.1); }
.gp-ops { margin-top: 1rem; padding: 0.8rem 1.1rem; }
.gp-ops summary { cursor: pointer; font-size: 0.82rem; font-weight: 700; color: var(--adm-mut); }
.gp-ops ul { list-style: none; margin: 0.7rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; max-height: 22rem; overflow-y: auto; }
.gp-ops li { display: flex; gap: 0.6rem; align-items: baseline; font-size: 0.76rem; color: var(--adm-mut); }
.gp-op__st { width: 1rem; text-align: center; }
.gp-op--done .gp-op__st { color: var(--adm-ok); }
.gp-op--failed .gp-op__st, .gp-op__res { color: var(--adm-err); }
.gp-op--pending .gp-op__st { color: var(--adm-warn); }
.gp-op__txt { color: var(--adm-text); }
.gp-op__by { margin-left: auto; color: var(--adm-dim); white-space: nowrap; }
</style>
