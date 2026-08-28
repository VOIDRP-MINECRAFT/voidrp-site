<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { marked } from 'marked'
import { authState, hasPermission } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastSuccess, toastError, toastInfo } from '../../services/toast'
import { pushAdminAlert } from '../../composables/useAdminNotifications'
import {
  adminListNewsServers,
  adminListNews,
  adminCreateNews,
  adminUpdateNews,
  adminDeleteNews,
  adminBroadcastNews,
  adminUploadNewsImage,
} from '../../services/newsApi'

const token = () => authState.accessToken

marked.setOptions({ gfm: true, breaks: true })

// News categories: 'update' (Обновления) | 'media' (Новости).
// Permission key segment differs: 'update' → 'updates', 'media' → 'media'.
const CATS = [{ key: 'update', label: 'Обновления' }, { key: 'media', label: 'Новости' }]
const permSeg = (cat) => (cat === 'update' ? 'updates' : 'media')
const canViewCat = (cat) => hasPermission('news.' + permSeg(cat) + '.view') || hasPermission('news.' + permSeg(cat) + '.manage')
const canManageCat = (cat) => hasPermission('news.' + permSeg(cat) + '.manage')
const visibleCats = computed(() => CATS.filter((c) => canViewCat(c.key)))
const category = ref('update')
const canManage = computed(() => canManageCat(category.value))

const servers = ref([])
const selectedServerId = ref('')
const posts = ref([])
const total = ref(0)
const loading = ref(false)
const saving = ref(false)

// ── list controls ───────────────────────────────────────────────────────────
const PAGE_SIZE = 20
const page = ref(0)
const search = ref('')
const statusFilter = ref('')
const STATUS_OPTIONS = [
  { key: '', label: 'Все' },
  { key: 'published', label: 'Опубликованные' },
  { key: 'scheduled', label: 'Запланированные' },
  { key: 'draft', label: 'Черновики' },
]
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const blankForm = () => ({
  title: '', summary: '', cover_image_url: '', body: '',
  category: category.value,
  is_published: true,
  schedule: false,
  published_at_local: '',
  post_telegram: false, post_discord: false,
})
const editing = ref(null) // null | 'new' | postId
const form = reactive(blankForm())
const editorTab = ref('edit') // 'edit' | 'preview' | 'broadcast'
const bodyEl = ref(null)
const coverUploading = ref(false)
const inlineUploading = ref(false)
const dragOver = ref(false)
const inlineFileEl = ref(null)

// Snapshot taken when the editor opens — anything different means unsaved work.
let pristine = ''
// Was the post scheduled when the editor opened? Decides whether a PATCH may
// touch `published_at` at all — see buildPayload().
let wasScheduled = false
const isDirty = computed(() => editing.value !== null && snapshot() !== pristine)

function snapshot() {
  return JSON.stringify({
    title: form.title, summary: form.summary, cover_image_url: form.cover_image_url,
    body: form.body, category: form.category, is_published: form.is_published,
    schedule: form.schedule, published_at_local: form.published_at_local,
  })
}

function resetForm(values = {}) {
  Object.assign(form, blankForm(), values)
}

// ── date helpers (datetime-local ⇄ ISO) ─────────────────────────────────────
function isoToLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localInputToIso(local) {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
function fmtDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

// ── autosave draft (survives an accidental tab close) ───────────────────────
const DRAFT_PREFIX = 'voidrp_news_draft_v1'
const draftSavedAt = ref(null)
let draftTimer = null

function draftKey() {
  return `${DRAFT_PREFIX}:${selectedServerId.value}:${category.value}:${editing.value}`
}
function writeDraft() {
  if (editing.value === null) return
  try {
    localStorage.setItem(draftKey(), JSON.stringify({ at: Date.now(), form: JSON.parse(snapshot()) }))
    draftSavedAt.value = Date.now()
  } catch { /* storage full/unavailable — autosave is best-effort */ }
}
function clearDraft() {
  try { localStorage.removeItem(draftKey()) } catch { /* ignore */ }
  draftSavedAt.value = null
}
async function maybeRestoreDraft() {
  let raw = null
  try { raw = localStorage.getItem(draftKey()) } catch { return }
  if (!raw) return
  let saved
  try { saved = JSON.parse(raw) } catch { return }
  if (!saved?.form || JSON.stringify(saved.form) === pristine) { clearDraft(); return }
  const ok = await confirmDialog({
    title: 'Восстановить черновик?',
    message: `Остался несохранённый текст от ${fmtDate(new Date(saved.at).toISOString())}. Восстановить его или продолжить с сохранённой версией?`,
    confirmLabel: 'Восстановить',
    cancelLabel: 'Начать заново',
  })
  if (ok) Object.assign(form, saved.form)
  else clearDraft()
}

watch(
  () => snapshot(),
  () => {
    if (editing.value === null) return
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(writeDraft, 800)
  },
)

function onBeforeUnload(e) {
  if (!isDirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

// ── data loading ────────────────────────────────────────────────────────────
const selectedServer = computed(() => servers.value.find((s) => s.id === selectedServerId.value) || null)
const tgConfigured = computed(() => !!selectedServer.value?.channels?.[category.value]?.tg)
const dcConfigured = computed(() => !!selectedServer.value?.channels?.[category.value]?.dc)

async function loadServers() {
  try {
    const res = await adminListNewsServers(token())
    servers.value = Array.isArray(res) ? res : (res.items || [])
    const def = servers.value.find((s) => s.is_default) || servers.value[0]
    if (def) selectedServerId.value = def.id
  } catch (e) {
    toastError(e?.message || 'Не удалось загрузить серверы')
  }
}

async function loadPosts() {
  if (!selectedServerId.value) return
  loading.value = true
  try {
    const res = await adminListNews(token(), selectedServerId.value, {
      limit: PAGE_SIZE,
      offset: page.value * PAGE_SIZE,
      category: category.value,
      q: search.value.trim(),
      status: statusFilter.value,
    })
    posts.value = res.items || []
    total.value = res.total || 0
    // Deleting the last row of a page would otherwise leave an empty view.
    if (!posts.value.length && page.value > 0) {
      page.value -= 1
      await loadPosts()
    }
  } catch (e) {
    toastError(e?.message || 'Не удалось загрузить новости')
  } finally {
    loading.value = false
  }
}

watch(selectedServerId, async (next, prev) => {
  if (next === prev) return
  if (!(await confirmLeave())) {
    // Staying in the editor — put the dropdown back where it was.
    selectedServerId.value = prev
    return
  }
  page.value = 0
  closeEditor()
  loadPosts()
})
watch(statusFilter, () => { page.value = 0; loadPosts() })

let searchTimer = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 0; loadPosts() }, 350)
})

async function setCategory(cat) {
  if (category.value === cat) return
  if (!(await confirmLeave())) return
  category.value = cat
  page.value = 0
  closeEditor()
  loadPosts()
}

function goPage(delta) {
  const next = page.value + delta
  if (next < 0 || next >= pageCount.value) return
  page.value = next
  loadPosts()
}

// ── editor open/close ───────────────────────────────────────────────────────
async function confirmLeave() {
  if (!isDirty.value) return true
  return await confirmDialog({
    title: 'Потерять изменения?',
    message: 'В редакторе есть несохранённые правки. Если уйти сейчас, они пропадут.',
    confirmLabel: 'Уйти без сохранения',
    cancelLabel: 'Остаться',
    danger: true,
  })
}

function closeEditor() {
  if (draftTimer) clearTimeout(draftTimer)
  if (editing.value !== null) clearDraft()
  editing.value = null
  editorTab.value = 'edit'
  resetForm()
  pristine = ''
}

async function startNew() {
  if (!(await confirmLeave())) return
  closeEditor()
  editing.value = 'new'
  resetForm({ category: category.value })
  wasScheduled = false
  pristine = snapshot()
  await maybeRestoreDraft()
}

async function startEdit(post) {
  if (!(await confirmLeave())) return
  closeEditor()
  editing.value = post.id
  resetForm({
    title: post.title,
    summary: post.summary || '',
    cover_image_url: post.cover_image_url || '',
    body: post.body || '',
    category: post.category,
    is_published: post.is_published,
    schedule: !!post.is_scheduled,
    published_at_local: isoToLocalInput(post.published_at),
  })
  wasScheduled = !!post.is_scheduled
  pristine = snapshot()
  await maybeRestoreDraft()
}

// Prefill the create form from an existing post instead of creating a copy
// straight away — patch notes are usually a small edit of the previous one.
async function duplicate(post) {
  if (!(await confirmLeave())) return
  closeEditor()
  editing.value = 'new'
  resetForm({
    title: `${post.title} (копия)`,
    summary: post.summary || '',
    cover_image_url: post.cover_image_url || '',
    body: post.body || '',
    category: post.category,
    is_published: false,
  })
  wasScheduled = false
  pristine = snapshot()
  toastInfo('Копия открыта как черновик — поправь и создай.')
}

async function cancelEdit() {
  if (!(await confirmLeave())) return
  closeEditor()
}

// ── save ────────────────────────────────────────────────────────────────────
function buildPayload() {
  const payload = {
    title: form.title.trim(),
    // Explicit null (not '') so the backend clears the column instead of
    // keeping the old value.
    summary: form.summary.trim() || null,
    cover_image_url: form.cover_image_url.trim() || null,
    body: form.body,
    is_published: form.is_published,
  }
  // `published_at` is sent only when the author actually meant to change it.
  // Sending null unconditionally would wipe the original date of an already
  // published post and drop it to the bottom of the feed.
  if (form.schedule && form.published_at_local) {
    payload.published_at = localInputToIso(form.published_at_local)
  } else if (wasScheduled) {
    // Schedule switched off → publish it here and now.
    payload.published_at = new Date().toISOString()
  }
  return payload
}

async function save() {
  if (!form.title.trim()) { toastError('Введите заголовок'); editorTab.value = 'edit'; return }
  if (form.schedule && !form.published_at_local) {
    toastError('Укажите дату отложенной публикации')
    return
  }
  saving.value = true
  try {
    const payload = buildPayload()
    if (editing.value === 'new') {
      const requested = form.post_telegram || form.post_discord
      const created = await adminCreateNews(token(), selectedServerId.value, {
        ...payload,
        category: form.category,
        post_telegram: form.post_telegram,
        post_discord: form.post_discord,
      })
      const b = created?.broadcast
      if (requested && b && (b.telegram_ok === false || b.discord_ok === false)) {
        toastSuccess('Новость создана')
        pushAdminAlert({
          id: `news-broadcast-${created.id}`,
          level: 'error',
          title: 'Новость создана, но не отправлена',
          message: `${b.detail || 'Не удалось доставить в один из каналов.'} — «${created.title}»`,
          link: '/admin/server',
        })
      } else {
        toastSuccess('Новость создана' + (requested ? ' и отправлена' : ''))
      }
    } else {
      await adminUpdateNews(token(), selectedServerId.value, editing.value, {
        ...payload,
        category: form.category,
      })
      toastSuccess('Новость сохранена')
    }
    // Category may have moved the post out of the currently open tab.
    const movedTo = form.category
    closeEditor()
    if (movedTo !== category.value) {
      category.value = movedTo
      page.value = 0
    }
    await loadPosts()
  } catch (e) {
    toastError(e?.message || 'Не удалось сохранить')
  } finally {
    saving.value = false
  }
}

async function removePost(post) {
  const ok = await confirmDialog({
    title: 'Удалить новость?',
    message: `«${post.title}» будет удалена безвозвратно.`,
    confirmLabel: 'Удалить',
    danger: true,
  })
  if (!ok) return
  try {
    await adminDeleteNews(token(), selectedServerId.value, post.id)
    toastSuccess('Новость удалена')
    await loadPosts()
  } catch (e) {
    toastError(e?.message || 'Не удалось удалить')
  }
}

// Quick publish/unpublish straight from the row.
const togglingId = ref(null)
async function togglePublished(post) {
  togglingId.value = post.id
  try {
    const updated = await adminUpdateNews(token(), selectedServerId.value, post.id, {
      is_published: !post.is_published,
    })
    Object.assign(post, updated)
    toastSuccess(updated.is_published ? 'Опубликовано' : 'Снято с публикации')
  } catch (e) {
    toastError(e?.message || 'Не удалось изменить статус')
  } finally {
    togglingId.value = null
  }
}

// ── broadcast ───────────────────────────────────────────────────────────────
async function broadcast(post, channel) {
  const chName = channel === 'tg' ? 'Telegram' : 'Discord'
  const sentAt = channel === 'tg' ? post.posted_telegram_at : post.posted_discord_at
  if (sentAt) {
    const ok = await confirmDialog({
      title: `Отправить в ${chName} ещё раз?`,
      message: `«${post.title}» уже уходила в ${chName} ${fmtDate(sentAt)}. Подписчики получат второе сообщение — удалить его из канала можно только вручную.`,
      confirmLabel: 'Отправить повторно',
      danger: true,
    })
    if (!ok) return
  }
  const payload = { post_telegram: channel === 'tg', post_discord: channel === 'dc' }
  try {
    const res = await adminBroadcastNews(token(), selectedServerId.value, post.id, payload)
    const ok = (channel === 'tg' && res.telegram_ok) || (channel === 'dc' && res.discord_ok)
    if (ok) {
      toastSuccess('Отправлено в ' + chName)
    } else {
      pushAdminAlert({
        id: `news-broadcast-${post.id}-${channel}`,
        level: 'error',
        title: `Не отправлено в ${chName}`,
        message: `${res.detail || 'Отправка не удалась.'} — «${post.title}»`,
        link: '/admin/server',
      })
    }
    await loadPosts()
  } catch (e) {
    pushAdminAlert({
      id: `news-broadcast-${post.id}-${channel}`,
      level: 'error',
      title: `Ошибка отправки в ${chName}`,
      message: `${e?.message || 'Не удалось отправить.'} — «${post.title}»`,
    })
  }
}

// Mirrors news_service._strip_markdown so the preview matches what actually
// goes out to the channels.
function stripMarkdown(text, limit = 400) {
  return String(text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`~]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, limit)
}
const broadcastExcerpt = computed(() => form.summary.trim() || stripMarkdown(form.body))
const postUrlPreview = computed(() => {
  const slug = selectedServer.value?.slug || 'server'
  return `${window.location.origin}/news/<slug>?server=${slug}`
})
function publicUrl(post) {
  const slug = selectedServer.value?.slug || ''
  return `${window.location.origin}/news/${post.slug}${slug ? `?server=${slug}` : ''}`
}

// ── markdown editing ────────────────────────────────────────────────────────
function applyToBody(mutate) {
  const el = bodyEl.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const { text, selStart, selEnd } = mutate(form.body, start, end)
  form.body = text
  requestAnimationFrame(() => {
    el.focus()
    el.selectionStart = selStart
    el.selectionEnd = selEnd
  })
}

function surround(before, after = before, placeholder = '') {
  applyToBody((val, start, end) => {
    const sel = val.slice(start, end) || placeholder
    return {
      text: val.slice(0, start) + before + sel + after + val.slice(end),
      selStart: start + before.length,
      selEnd: start + before.length + sel.length,
    }
  })
}

function linePrefix(prefix) {
  applyToBody((val, start, end) => {
    const lineStart = val.lastIndexOf('\n', start - 1) + 1
    // Toggle off when the prefix is already there.
    if (val.slice(lineStart).startsWith(prefix)) {
      return {
        text: val.slice(0, lineStart) + val.slice(lineStart + prefix.length),
        selStart: Math.max(lineStart, start - prefix.length),
        selEnd: Math.max(lineStart, end - prefix.length),
      }
    }
    return {
      text: val.slice(0, lineStart) + prefix + val.slice(lineStart),
      selStart: start + prefix.length,
      selEnd: end + prefix.length,
    }
  })
}

function insertBlock(block) {
  applyToBody((val, start) => {
    const needsNl = start > 0 && val[start - 1] !== '\n'
    const text = (needsNl ? '\n' : '') + block + '\n'
    return {
      text: val.slice(0, start) + text + val.slice(start),
      selStart: start + text.length,
      selEnd: start + text.length,
    }
  })
}

function onBodyKeydown(e) {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  const key = e.key.toLowerCase()
  if (key === 'b') { e.preventDefault(); surround('**', '**', 'текст') }
  else if (key === 'i') { e.preventDefault(); surround('*', '*', 'текст') }
  else if (key === 'k') { e.preventDefault(); surround('[', '](https://)', 'текст') }
  else if (key === 's') { e.preventDefault(); if (!saving.value) save() }
}

// ── images ──────────────────────────────────────────────────────────────────
async function onCoverSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  coverUploading.value = true
  try {
    const res = await adminUploadNewsImage(token(), file, 'cover')
    form.cover_image_url = res.url
    toastSuccess('Обложка загружена')
  } catch (err) {
    toastError(err?.message || 'Не удалось загрузить обложку')
  } finally {
    coverUploading.value = false
    e.target.value = ''
  }
}

// Inserts a placeholder immediately, then swaps in the real URL when the upload
// finishes — the author keeps typing instead of waiting.
async function insertInlineImage(file) {
  if (!file || !file.type?.startsWith('image/')) return
  const marker = `![загрузка…](uploading-${Date.now()}-${Math.random().toString(36).slice(2, 7)})`
  insertBlock(marker)
  inlineUploading.value = true
  try {
    const res = await adminUploadNewsImage(token(), file, 'inline')
    form.body = form.body.replace(marker, `![](${res.url})`)
    toastSuccess('Картинка вставлена')
  } catch (err) {
    form.body = form.body.replace(marker, '')
    toastError(err?.message || 'Не удалось загрузить картинку')
  } finally {
    inlineUploading.value = false
  }
}

async function onInlineFileSelect(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  await insertInlineImage(file)
}

async function onBodyPaste(e) {
  const items = Array.from(e.clipboardData?.items || [])
  const img = items.find((i) => i.type?.startsWith('image/'))
  if (!img) return
  e.preventDefault()
  await insertInlineImage(img.getAsFile())
}

async function onBodyDrop(e) {
  dragOver.value = false
  const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type?.startsWith('image/'))
  if (!files.length) return
  for (const f of files) await insertInlineImage(f)
}

// ── preview ─────────────────────────────────────────────────────────────────
const preview = computed(() => (form.body ? marked.parse(form.body) : ''))
const previewDate = computed(() =>
  form.schedule && form.published_at_local
    ? fmtDate(localInputToIso(form.published_at_local))
    : fmtDate(new Date().toISOString()),
)

// Draft is a neutral state, not a warning; scheduled is "not live yet" (amber);
// published is live (green) — same vocabulary the rest of the panel uses.
function statusOf(post) {
  if (!post.is_published) return { label: 'Черновик', cls: '' }
  if (post.is_scheduled) return { label: 'Запланировано', cls: 'adm-badge--warn' }
  return { label: 'Опубликовано', cls: 'adm-badge--ok' }
}

onMounted(() => {
  const first = visibleCats.value[0]
  if (first) category.value = first.key
  window.addEventListener('beforeunload', onBeforeUnload)
  loadServers()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (draftTimer) clearTimeout(draftTimer)
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Новости</h1>
        <p class="adm-sub">Публикация на сайте и рассылка в Telegram и Discord — для выбранного сервера</p>
      </div>
      <div class="adm-head-actions">
        <select v-model="selectedServerId" class="adm-select nw-server">
          <option v-for="s in servers" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <button v-if="canManage" class="adm-btn adm-btn--acc" :disabled="!selectedServerId || editing === 'new'" @click="startNew">
          Новая новость
        </button>
      </div>
    </div>

    <div v-if="visibleCats.length > 1" class="adm-tabs nw-self-start">
      <button
        v-for="c in visibleCats"
        :key="c.key"
        type="button"
        class="adm-tab"
        :class="{ 'adm-tab--active': category === c.key }"
        @click="setCategory(c.key)"
      >{{ c.label }}</button>
    </div>

    <div v-if="selectedServer && !tgConfigured && !dcConfigured" class="nw-note nw-note--warn">
      <span class="nw-note__dot adm-dot adm-dot--warn" />
      <span>
        Авторассылка выключена: у сервера не задан ни один канал. Добавь Telegram chat_id <b>или</b> Discord webhook в
        <RouterLink to="/admin/server" class="nw-note__link">настройках сервера</RouterLink>.
        На сайте новости публикуются и без этого.
      </span>
    </div>
    <div v-else-if="selectedServer && (!tgConfigured || !dcConfigured)" class="nw-note">
      <span class="nw-note__dot adm-dot adm-dot--ok" />
      <span>
        Авторассылка настроена для
        <b><span v-if="tgConfigured">Telegram</span><span v-if="tgConfigured && dcConfigured"> и </span><span v-if="dcConfigured">Discord</span></b>.
        Второй канал добавляется в
        <RouterLink to="/admin/server" class="nw-note__link">настройках сервера</RouterLink>.
      </span>
    </div>

    <!-- ══ Editor ══ -->
    <div v-if="editing" class="adm-card nw-editor">
      <div class="nw-editor__bar">
        <div class="adm-tabs">
          <button type="button" class="adm-tab" :class="{ 'adm-tab--active': editorTab === 'edit' }" @click="editorTab = 'edit'">Редактор</button>
          <button type="button" class="adm-tab" :class="{ 'adm-tab--active': editorTab === 'preview' }" @click="editorTab = 'preview'">Превью</button>
          <button type="button" class="adm-tab" :class="{ 'adm-tab--active': editorTab === 'broadcast' }" @click="editorTab = 'broadcast'">Рассылка</button>
        </div>
        <div class="nw-editor__state">
          <span v-if="isDirty" class="nw-unsaved"><span class="adm-dot adm-dot--warn" /> не сохранено</span>
          <span v-if="draftSavedAt" class="nw-autosave">черновик в браузере · <span class="adm-num">{{ fmtDate(new Date(draftSavedAt).toISOString()) }}</span></span>
        </div>
        <div class="nw-editor__actions">
          <button class="adm-btn" :disabled="saving" @click="cancelEdit">Отмена</button>
          <button class="adm-btn adm-btn--acc" :disabled="saving" @click="save">
            {{ saving ? 'Сохраняем…' : (editing === 'new' ? 'Создать' : 'Сохранить') }}
          </button>
        </div>
      </div>

      <!-- ── Edit ── -->
      <div v-show="editorTab === 'edit'" class="nw-grid">
        <div class="nw-main">
          <label class="adm-field nw-field">
            <span>Заголовок <em class="nw-cnt adm-num" :class="{ 'nw-cnt--warn': form.title.length > 180 }">{{ form.title.length }}/200</em></span>
            <input v-model="form.title" class="adm-input nw-title-input" placeholder="Что произошло" maxlength="200" />
          </label>

          <label class="adm-field nw-field">
            <span>Краткое описание <em class="nw-cnt adm-num" :class="{ 'nw-cnt--warn': form.summary.length > 450 }">{{ form.summary.length }}/500</em></span>
            <textarea v-model="form.summary" class="adm-textarea nw-summary" rows="2" maxlength="500" placeholder="Одно-два предложения — они уйдут в карточку и в рассылку" />
          </label>

          <div class="adm-field nw-field">
            <span>Обложка</span>
            <div class="nw-cover">
              <div v-if="form.cover_image_url" class="nw-cover__preview">
                <img :src="form.cover_image_url" alt="" />
                <button type="button" class="nw-cover__remove" title="Убрать обложку" @click="form.cover_image_url = ''">✕</button>
              </div>
              <label class="nw-upload" :class="{ 'nw-upload--busy': coverUploading }">
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden :disabled="coverUploading" @change="onCoverSelect" />
                <svg v-if="!coverUploading" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span v-else class="nw-spin" />
                {{ coverUploading ? 'Загружаем…' : (form.cover_image_url ? 'Заменить' : 'Загрузить обложку') }}
              </label>
              <p class="nw-hint nw-cover__hint">
                <b class="adm-num">1600×600</b> — рекомендуемый размер, минимум <span class="adm-num">1000×375</span>.
                Обрежется по центру, держи важное в середине.
              </p>
            </div>
          </div>

          <div class="adm-field nw-field">
            <span>Текст</span>
            <div class="nw-toolbar">
              <button type="button" title="Заголовок 2 уровня" @click="linePrefix('## ')">H2</button>
              <button type="button" title="Заголовок 3 уровня" @click="linePrefix('### ')">H3</button>
              <i class="nw-toolbar__sep" />
              <button type="button" title="Жирный · Ctrl+B" @click="surround('**', '**', 'текст')"><b>B</b></button>
              <button type="button" title="Курсив · Ctrl+I" @click="surround('*', '*', 'текст')"><i>I</i></button>
              <button type="button" title="Зачёркнутый" @click="surround('~~', '~~', 'текст')"><s>S</s></button>
              <i class="nw-toolbar__sep" />
              <button type="button" title="Список" @click="linePrefix('- ')">•</button>
              <button type="button" title="Нумерованный список" @click="linePrefix('1. ')">1.</button>
              <button type="button" title="Цитата" @click="linePrefix('> ')">”</button>
              <button type="button" title="Разделитель" @click="insertBlock('---')">—</button>
              <i class="nw-toolbar__sep" />
              <button type="button" title="Ссылка · Ctrl+K" @click="surround('[', '](https://)', 'текст')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </button>
              <button type="button" title="Код" @click="surround('`', '`', 'код')">&lt;/&gt;</button>
              <button type="button" title="Блок кода" @click="insertBlock('```\nкод\n```')">{ }</button>
              <i class="nw-toolbar__sep" />
              <button type="button" class="nw-toolbar__img" :disabled="inlineUploading" title="Вставить картинку в текст" @click="inlineFileEl.click()">
                <svg v-if="!inlineUploading" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 20"/></svg>
                <span v-else class="nw-spin" />
                Картинка
              </button>
            </div>
            <input ref="inlineFileEl" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onInlineFileSelect" />
            <div class="nw-drop" :class="{ 'nw-drop--over': dragOver }">
              <textarea
                ref="bodyEl"
                v-model="form.body"
                rows="18"
                class="adm-textarea nw-body"
                placeholder="Markdown. Ctrl+B — жирный, Ctrl+I — курсив, Ctrl+K — ссылка, Ctrl+S — сохранить. Картинку можно перетащить сюда или вставить из буфера."
                @keydown="onBodyKeydown"
                @paste="onBodyPaste"
                @dragover.prevent="dragOver = true"
                @dragleave="dragOver = false"
                @drop.prevent="onBodyDrop"
              />
              <div v-if="dragOver" class="nw-drop__hint">Отпусти — загрузим и вставим в текст</div>
            </div>
          </div>
        </div>

        <aside class="nw-side">
          <div class="nw-block">
            <span class="adm-label">Раздел</span>
            <select v-model="form.category" class="adm-select">
              <option v-for="c in CATS" :key="c.key" :value="c.key" :disabled="!canManageCat(c.key)">{{ c.label }}</option>
            </select>
            <p class="nw-hint">Пост можно перенести между разделами — нужен доступ к обоим.</p>
          </div>

          <div class="nw-block">
            <span class="adm-label">Публикация</span>
            <label class="adm-check"><input v-model="form.is_published" type="checkbox" /> Опубликовать</label>
            <label class="adm-check" :class="{ 'nw-off': !form.is_published }">
              <input v-model="form.schedule" type="checkbox" :disabled="!form.is_published" /> Отложить до даты
            </label>
            <input
              v-if="form.schedule && form.is_published"
              v-model="form.published_at_local"
              type="datetime-local"
              class="adm-input nw-when"
            />
            <p v-if="form.schedule && form.is_published" class="nw-hint">
              До этого момента поста не будет в ленте на сайте и в лаунчере. Рассылку отправишь кнопкой после публикации.
            </p>
          </div>

          <div v-if="editing === 'new'" class="nw-block">
            <span class="adm-label">Рассылка при создании</span>
            <label class="adm-check" :class="{ 'nw-off': !tgConfigured }">
              <input v-model="form.post_telegram" type="checkbox" :disabled="!tgConfigured" /> Telegram
            </label>
            <label class="adm-check" :class="{ 'nw-off': !dcConfigured }">
              <input v-model="form.post_discord" type="checkbox" :disabled="!dcConfigured" /> Discord
            </label>
            <p v-if="(form.post_telegram || form.post_discord) && (!form.is_published || form.schedule)" class="nw-hint nw-hint--warn">
              {{ !form.is_published ? 'Черновик не рассылается' : 'Отложенный пост не рассылается сразу' }} — отправишь кнопкой в списке после публикации.
            </p>
          </div>
        </aside>
      </div>

      <!-- ── Preview: как на сайте ── -->
      <div v-show="editorTab === 'preview'" class="nw-pv">
        <article class="nw-pv__page">
          <div v-if="form.cover_image_url" class="nw-pv__cover"><img :src="form.cover_image_url" alt="" /></div>
          <h1 class="nw-pv__title">{{ form.title || 'Заголовок новости' }}</h1>
          <div class="nw-pv__meta">
            <span class="adm-num">{{ previewDate }}</span>
            <span v-if="form.schedule" class="adm-badge adm-badge--warn">запланировано</span>
          </div>
          <p v-if="form.summary" class="nw-pv__summary">{{ form.summary }}</p>
          <div class="nw-pv__body markdown-body" v-html="preview || '<p class=\'nw-pv__blank\'>Текст пока пуст</p>'" />
        </article>
      </div>

      <!-- ── Broadcast ── -->
      <div v-show="editorTab === 'broadcast'" class="nw-bc">
        <p class="nw-hint nw-bc__lead">
          Так пост придёт подписчикам. Текст берётся из краткого описания, а если оно пустое — из начала статьи.
        </p>
        <div class="nw-bc__grid">
          <div class="nw-bc__card nw-bc__card--tg">
            <div class="nw-bc__head">
              Telegram
              <span v-if="!tgConfigured" class="adm-badge adm-badge--err">канал не задан</span>
            </div>
            <div class="nw-bc__tg">
              <div class="nw-bc__tg-title">{{ form.title || 'Заголовок новости' }}</div>
              <div v-if="broadcastExcerpt" class="nw-bc__tg-text">{{ broadcastExcerpt }}</div>
              <span class="nw-bc__tg-link">Читать на сайте →</span>
              <div class="nw-bc__url adm-mono">{{ postUrlPreview }}</div>
            </div>
          </div>
          <div class="nw-bc__card nw-bc__card--dc">
            <div class="nw-bc__head">
              Discord
              <span v-if="!dcConfigured" class="adm-badge adm-badge--err">webhook не задан</span>
            </div>
            <div class="nw-bc__dc">
              <div class="nw-bc__embed">
                <div class="nw-bc__embed-title">{{ form.title || 'Заголовок новости' }}</div>
                <div v-if="broadcastExcerpt" class="nw-bc__embed-desc">{{ broadcastExcerpt.slice(0, 2000) }}</div>
                <img v-if="form.cover_image_url" :src="form.cover_image_url" class="nw-bc__embed-img" alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ Filters ══ -->
    <div class="nw-filters">
      <input v-model="search" class="adm-input nw-search" placeholder="Поиск по заголовку и описанию" />
      <div class="adm-tabs">
        <button
          v-for="s in STATUS_OPTIONS"
          :key="s.key"
          type="button"
          class="adm-tab"
          :class="{ 'adm-tab--active': statusFilter === s.key }"
          @click="statusFilter = s.key"
        >{{ s.label }}</button>
      </div>
      <span class="nw-count"><b class="adm-num">{{ total }}</b> {{ total === 1 ? 'запись' : 'записей' }}</span>
    </div>

    <!-- ══ List ══ -->
    <div v-if="loading" class="nw-skels">
      <div v-for="n in 4" :key="n" class="adm-skel nw-skel" />
    </div>

    <div v-else-if="!posts.length" class="adm-empty">
      <div class="adm-empty__title">{{ search || statusFilter ? 'Ничего не нашлось' : 'Здесь пока пусто' }}</div>
      <div class="adm-empty__sub">
        {{ search || statusFilter
          ? 'Измени запрос или сбрось фильтр статуса.'
          : 'Первая новость появится в ленте на сайте и в лаунчере сразу после публикации.' }}
      </div>
    </div>

    <template v-else>
      <div class="adm-table-wrap">
        <div class="adm-table-scroll">
          <table class="adm-table nw-table">
            <thead>
              <tr>
                <th>Заголовок</th>
                <th>Статус</th>
                <th>Каналы</th>
                <th>Автор</th>
                <th>Дата</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in posts" :key="p.id">
                <td>
                  <div class="nw-row__title">
                    <span class="nw-row__name">{{ p.title }}</span>
                    <a
                      v-if="p.is_published && !p.is_scheduled"
                      :href="publicUrl(p)"
                      target="_blank"
                      rel="noopener"
                      class="nw-row__ext"
                      title="Открыть на сайте"
                    >↗</a>
                  </div>
                  <div v-if="p.summary" class="nw-row__summary">{{ p.summary }}</div>
                </td>
                <td>
                  <span class="adm-badge" :class="statusOf(p).cls">{{ statusOf(p).label }}</span>
                </td>
                <td>
                  <div class="nw-ch">
                    <span
                      class="nw-ch__pill"
                      :class="{ 'nw-ch__pill--on': p.posted_telegram }"
                      :title="p.posted_telegram_at ? 'Telegram · ' + fmtDate(p.posted_telegram_at) : 'В Telegram не отправлялась'"
                    >TG</span>
                    <span
                      class="nw-ch__pill"
                      :class="{ 'nw-ch__pill--on': p.posted_discord }"
                      :title="p.posted_discord_at ? 'Discord · ' + fmtDate(p.posted_discord_at) : 'В Discord не отправлялась'"
                    >DC</span>
                  </div>
                </td>
                <td>
                  <div class="nw-author">
                    <span class="adm-avatar nw-author__ava">{{ (p.author_name || '?').charAt(0).toUpperCase() }}</span>
                    <span class="nw-author__name">{{ p.author_name || '—' }}</span>
                  </div>
                </td>
                <td class="nw-date adm-num">{{ fmtDate(p.published_at || p.created_at) }}</td>
                <td>
                  <div v-if="canManage" class="nw-row__actions">
                    <button
                      class="adm-btn adm-btn--sm adm-btn--icon"
                      :disabled="togglingId === p.id"
                      :title="p.is_published ? 'Снять с публикации' : 'Опубликовать'"
                      @click="togglePublished(p)"
                    >{{ togglingId === p.id ? '·' : (p.is_published ? '◉' : '○') }}</button>
                    <button class="adm-btn adm-btn--sm" @click="startEdit(p)">Изменить</button>
                    <button class="adm-btn adm-btn--sm adm-btn--icon" title="Сделать копию" @click="duplicate(p)">⧉</button>
                    <button class="adm-btn adm-btn--sm" :disabled="!tgConfigured" title="Отправить в Telegram" @click="broadcast(p, 'tg')">TG</button>
                    <button class="adm-btn adm-btn--sm" :disabled="!dcConfigured" title="Отправить в Discord" @click="broadcast(p, 'dc')">DC</button>
                    <button class="adm-btn adm-btn--sm adm-btn--danger adm-btn--icon" title="Удалить" @click="removePost(p)">✕</button>
                  </div>
                  <span v-else class="nw-readonly">только просмотр</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="pageCount > 1" class="adm-pager">
        <button class="adm-btn adm-btn--sm" :disabled="page === 0" @click="goPage(-1)">← Назад</button>
        <span class="adm-pager__info">Страница <span class="adm-num">{{ page + 1 }}</span> из <span class="adm-num">{{ pageCount }}</span></span>
        <button class="adm-btn adm-btn--sm" :disabled="page + 1 >= pageCount" @click="goPage(1)">Вперёд →</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Всё цветное — из токенов admin.css: акцент наследуется от активного сервера,
   поэтому страница перекрашивается вместе с остальной панелью. Свои цвета
   только там, где они несут смысл: фирменные Telegram/Discord в превью. */

.nw-server { min-width: 190px; width: auto; }
.nw-self-start { align-self: flex-start; }

/* ── Заметка о каналах ── */
.nw-note {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.7rem 0.95rem;
  border-radius: var(--adm-r);
  border: 1px solid var(--adm-line);
  background: var(--adm-card);
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--adm-mut);
}
.nw-note b { color: var(--adm-text); font-weight: 700; }
.nw-note--warn { border-color: rgba(251, 191, 36, 0.22); background: rgba(251, 191, 36, 0.05); }
.nw-note__dot { margin-top: 0.42rem; }
.nw-note__link { color: var(--adm-acc-text); text-decoration: underline; text-underline-offset: 2px; }

/* ── Редактор ── */
.nw-editor { padding: 1rem 1.15rem 1.15rem; }
.nw-editor__bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding-bottom: 0.9rem;
  margin-bottom: 1.1rem;
  border-bottom: 1px solid var(--adm-line);
}
.nw-editor__state { flex: 1; display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; min-width: 0; }
.nw-unsaved { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; font-weight: 700; color: var(--adm-warn); }
.nw-autosave { font-size: 0.71rem; color: var(--adm-faint); }
.nw-editor__actions { display: flex; gap: 0.45rem; }

.nw-grid { display: grid; grid-template-columns: minmax(0, 1fr) 264px; gap: 1.5rem; }
@media (max-width: 1000px) { .nw-grid { grid-template-columns: 1fr; } }
.nw-main { min-width: 0; display: flex; flex-direction: column; gap: 0.95rem; }
.nw-field > span { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
.nw-cnt { font-style: normal; font-size: 0.68rem; letter-spacing: 0; color: var(--adm-faint); }
.nw-cnt--warn { color: var(--adm-warn); }
.nw-title-input { font-size: 0.98rem; font-weight: 700; padding-block: 0.6rem; }
.nw-summary { min-height: 62px; }

.nw-hint { margin: 0.45rem 0 0; font-size: 0.72rem; line-height: 1.5; color: var(--adm-dim); }
.nw-hint b { color: var(--adm-mut); font-weight: 700; }
.nw-hint--warn { color: var(--adm-warn); }
.nw-off { opacity: 0.45; }

/* Обложка */
.nw-cover { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
.nw-cover__preview { position: relative; flex-shrink: 0; }
.nw-cover__preview img {
  display: block;
  width: 148px;
  aspect-ratio: 16 / 6;
  object-fit: cover;
  border-radius: var(--adm-r-sm);
  border: 1px solid var(--adm-line-strong);
}
.nw-cover__remove {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: var(--adm-card-2);
  color: var(--adm-err);
  font-size: 0.62rem;
  cursor: pointer;
}
.nw-cover__remove:hover { background: rgba(248, 113, 113, 0.16); }
.nw-cover__hint { flex: 1; min-width: 200px; margin: 0; }

.nw-upload {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.52rem 0.9rem;
  border-radius: var(--adm-r-sm);
  border: 1px dashed var(--adm-acc-line);
  background: var(--adm-acc-soft);
  color: var(--adm-acc-text);
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.14s, border-color 0.14s;
}
.nw-upload:hover { background: rgba(var(--adm-acc-rgb), 0.2); }
.nw-upload--busy { opacity: 0.6; cursor: default; }
.nw-upload svg { width: 0.85rem; height: 0.85rem; }

/* Тулбар */
.nw-toolbar { display: flex; align-items: center; gap: 0.22rem; flex-wrap: wrap; margin-bottom: 0.45rem; }
.nw-toolbar button {
  min-width: 28px;
  height: 28px;
  padding: 0 0.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border-radius: 7px;
  border: 1px solid var(--adm-line-strong);
  background: var(--adm-card-2);
  color: var(--adm-mut);
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.14s, border-color 0.14s, color 0.14s;
}
.nw-toolbar button:hover:not(:disabled) { color: var(--adm-text); border-color: var(--adm-acc-line); background: var(--adm-acc-soft); }
.nw-toolbar button:disabled { opacity: 0.45; cursor: not-allowed; }
.nw-toolbar svg { width: 0.82rem; height: 0.82rem; }
.nw-toolbar__sep { width: 1px; height: 16px; background: var(--adm-line-strong); margin: 0 0.28rem; }
/* Специфичностью, а не !important — иначе правило ховера выше не сработает. */
.nw-toolbar button.nw-toolbar__img {
  padding: 0 0.6rem;
  color: var(--adm-acc-text);
  border-color: var(--adm-acc-line);
  background: var(--adm-acc-soft);
}

.nw-spin {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--adm-line-strong);
  border-top-color: var(--adm-acc-text);
  animation: nw-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes nw-spin { to { transform: rotate(360deg); } }

/* Поле текста + drag&drop */
.nw-drop { position: relative; }
.nw-body { font-family: var(--adm-mono); font-size: 0.8rem; line-height: 1.6; }
.nw-drop--over .nw-body { border-color: var(--adm-acc-line); }
.nw-drop__hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--adm-r-sm);
  border: 2px dashed var(--adm-acc-line);
  background: rgba(var(--adm-acc-rgb), 0.18);
  color: var(--adm-text);
  font-size: 0.85rem;
  font-weight: 800;
  pointer-events: none;
  backdrop-filter: blur(2px);
}

/* Сайдбар */
.nw-side { display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }
.nw-block {
  padding: 0.85rem 0.9rem;
  border-radius: var(--adm-r);
  border: 1px solid var(--adm-line);
  background: var(--adm-bg-soft);
}
.nw-block .adm-check { margin-top: 0.4rem; }
.nw-when { margin-top: 0.5rem; }

/* ── Превью ── */
.nw-pv { padding: 0.2rem 0 0.4rem; }
.nw-pv__page { max-width: 780px; margin: 0 auto; }
.nw-pv__cover {
  aspect-ratio: 16 / 6;
  border-radius: var(--adm-r);
  overflow: hidden;
  border: 1px solid var(--adm-line);
  margin-bottom: 1.5rem;
}
.nw-pv__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.nw-pv__title {
  margin: 0 0 0.65rem;
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1.14;
  color: var(--adm-text);
}
.nw-pv__meta { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.2rem; font-size: 0.75rem; color: var(--adm-dim); }
.nw-pv__summary {
  margin: 0 0 1.5rem;
  padding-left: 0.95rem;
  border-left: 2px solid var(--adm-acc);
  font-size: 1.02rem;
  line-height: 1.62;
  color: var(--adm-mut);
}
.nw-pv__body { font-size: 0.95rem; line-height: 1.75; color: var(--adm-mut); }

/* ── Рассылка ── */
.nw-bc { padding: 0.2rem 0 0.4rem; }
.nw-bc__lead { margin: 0 0 1rem; }
.nw-bc__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
.nw-bc__card { border: 1px solid var(--adm-line); border-radius: var(--adm-r); overflow: hidden; }
.nw-bc__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.9rem;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  border-bottom: 1px solid var(--adm-line);
}
/* Фирменные цвета мессенджеров — это информация (куда уйдёт пост), не декор. */
.nw-bc__card--tg .nw-bc__head { color: #6ec3f0; background: rgba(42, 171, 238, 0.08); }
.nw-bc__card--dc .nw-bc__head { color: #98a0f6; background: rgba(88, 101, 242, 0.08); }
.nw-bc__tg { padding: 0.9rem 1rem; background: #17212b; }
.nw-bc__tg-title { font-weight: 700; color: #fff; margin-bottom: 0.45rem; font-size: 0.88rem; }
.nw-bc__tg-text { color: #dbe3ea; font-size: 0.82rem; line-height: 1.55; white-space: pre-wrap; margin-bottom: 0.55rem; }
.nw-bc__tg-link { color: #62bcf9; font-size: 0.82rem; }
.nw-bc__url { margin-top: 0.4rem; font-size: 0.66rem; color: #64798b; word-break: break-all; }
.nw-bc__dc { padding: 0.9rem 1rem; background: #313338; }
.nw-bc__embed { border-left: 4px solid var(--adm-acc); border-radius: 4px; background: #2b2d31; padding: 0.75rem 0.9rem; }
.nw-bc__embed-title { color: #a8b4ff; font-weight: 700; font-size: 0.86rem; margin-bottom: 0.35rem; }
.nw-bc__embed-desc { color: #dbdee1; font-size: 0.8rem; line-height: 1.55; white-space: pre-wrap; }
.nw-bc__embed-img { display: block; width: 100%; margin-top: 0.6rem; border-radius: 4px; }

/* ── Фильтры ── */
.nw-filters { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
.nw-search { flex: 1 1 240px; max-width: 340px; }
.nw-count { margin-left: auto; font-size: 0.72rem; color: var(--adm-dim); }
.nw-count b { color: var(--adm-mut); font-weight: 700; }

/* ── Список ── */
.nw-skels { display: flex; flex-direction: column; gap: 0.5rem; }
.nw-skel { height: 52px; }

.nw-table td { padding-block: 0.7rem; }
.nw-row__title { display: flex; align-items: center; gap: 0.4rem; }
.nw-row__name { font-weight: 700; color: var(--adm-text); }
.nw-row__ext { color: var(--adm-dim); text-decoration: none; font-size: 0.85rem; line-height: 1; }
.nw-row__ext:hover { color: var(--adm-acc-text); }
.nw-row__summary {
  margin-top: 0.15rem;
  font-size: 0.75rem;
  color: var(--adm-dim);
  max-width: 42ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nw-ch { display: flex; gap: 0.25rem; }
.nw-ch__pill {
  padding: 0.12rem 0.36rem;
  border-radius: 5px;
  font-family: var(--adm-mono);
  font-size: 0.66rem;
  font-weight: 700;
  background: rgba(148, 163, 184, 0.07);
  color: var(--adm-faint);
  cursor: help;
}
.nw-ch__pill--on { background: rgba(52, 211, 153, 0.12); color: var(--adm-ok); }
.nw-author { display: flex; align-items: center; gap: 0.45rem; }
.nw-author__ava { width: 1.45rem; height: 1.45rem; font-size: 0.62rem; border-radius: 7px; }
.nw-author__name { font-size: 0.78rem; color: var(--adm-mut); white-space: nowrap; }
.nw-date { font-size: 0.75rem; color: var(--adm-dim); white-space: nowrap; }
.nw-row__actions { display: flex; gap: 0.25rem; justify-content: flex-end; }
.nw-readonly { font-size: 0.72rem; color: var(--adm-faint); }
</style>

<style>
/* Разметка превью — повторяет типографику публичной страницы новости. */
.nw-pv__body.markdown-body h1,
.nw-pv__body.markdown-body h2,
.nw-pv__body.markdown-body h3 { color: var(--adm-text); margin: 1.5rem 0 0.6rem; line-height: 1.25; font-weight: 800; letter-spacing: -0.015em; }
.nw-pv__body.markdown-body h1 { font-size: 1.5rem; }
.nw-pv__body.markdown-body h2 { font-size: 1.28rem; }
.nw-pv__body.markdown-body h3 { font-size: 1.08rem; }
.nw-pv__body.markdown-body p { margin: 0.85rem 0; }
.nw-pv__body.markdown-body ul,
.nw-pv__body.markdown-body ol { margin: 0.85rem 0; padding-left: 1.35rem; }
.nw-pv__body.markdown-body li { margin: 0.3rem 0; }
.nw-pv__body.markdown-body li::marker { color: var(--adm-acc); }
.nw-pv__body.markdown-body a { color: var(--adm-acc-text); text-underline-offset: 2px; }
.nw-pv__body.markdown-body strong { color: var(--adm-text); }
.nw-pv__body.markdown-body code {
  font-family: var(--adm-mono);
  font-size: 0.88em;
  background: rgba(148, 163, 184, 0.1);
  padding: 0.1rem 0.32rem;
  border-radius: 5px;
}
.nw-pv__body.markdown-body pre {
  background: var(--adm-bg);
  border: 1px solid var(--adm-line);
  padding: 0.9rem 1rem;
  border-radius: var(--adm-r-sm);
  overflow-x: auto;
}
.nw-pv__body.markdown-body pre code { background: none; padding: 0; }
.nw-pv__body.markdown-body blockquote {
  margin: 0.95rem 0;
  padding-left: 0.9rem;
  border-left: 2px solid var(--adm-acc-line);
  color: var(--adm-dim);
}
.nw-pv__body.markdown-body img { display: block; max-width: 100%; margin: 1.1rem 0; border-radius: var(--adm-r-sm); border: 1px solid var(--adm-line); }
.nw-pv__body.markdown-body hr { border: none; border-top: 1px solid var(--adm-line); margin: 1.7rem 0; }
.nw-pv__blank { color: var(--adm-faint); }
</style>
