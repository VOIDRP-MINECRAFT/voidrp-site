<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { marked } from 'marked'
import { authState, hasPermission } from '../../stores/authStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastSuccess, toastError, toastInfo } from '../../services/toast'
import {
  adminListNewsServers,
  adminListNews,
  adminCreateNews,
  adminUpdateNews,
  adminDeleteNews,
  adminBroadcastNews,
  adminUploadNewsCover,
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
const loading = ref(false)
const saving = ref(false)

const blankForm = () => ({
  title: '', summary: '', cover_image_url: '', body: '',
  is_published: true, post_telegram: false, post_discord: false,
})
const editing = ref(null) // null | 'new' | postId
const form = ref(blankForm())
const bodyEl = ref(null)
const coverUploading = ref(false)

async function onCoverSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  coverUploading.value = true
  try {
    const res = await adminUploadNewsCover(token(), file)
    form.value.cover_image_url = res.url
    toastSuccess('Обложка загружена')
  } catch (err) {
    toastError(err?.message || 'Не удалось загрузить обложку')
  } finally {
    coverUploading.value = false
    e.target.value = ''
  }
}

const selectedServer = computed(() => servers.value.find((s) => s.id === selectedServerId.value) || null)
const preview = computed(() => (form.value.body ? marked.parse(form.value.body) : ''))

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
    const res = await adminListNews(token(), selectedServerId.value, { limit: 100, category: category.value })
    posts.value = res.items || []
  } catch (e) {
    toastError(e?.message || 'Не удалось загрузить новости')
  } finally {
    loading.value = false
  }
}

watch(selectedServerId, () => {
  cancelEdit()
  loadPosts()
})

function setCategory(cat) {
  if (category.value === cat) return
  category.value = cat
  cancelEdit()
  loadPosts()
}

function startNew() {
  editing.value = 'new'
  form.value = blankForm()
}

function startEdit(post) {
  editing.value = post.id
  form.value = {
    title: post.title,
    summary: post.summary || '',
    cover_image_url: post.cover_image_url || '',
    body: post.body || '',
    is_published: post.is_published,
    post_telegram: false,
    post_discord: false,
  }
}

function cancelEdit() {
  editing.value = null
  form.value = blankForm()
}

async function save() {
  if (!form.value.title.trim()) {
    toastError('Введите заголовок')
    return
  }
  saving.value = true
  try {
    const payload = {
      title: form.value.title.trim(),
      summary: form.value.summary.trim() || null,
      cover_image_url: form.value.cover_image_url.trim() || null,
      body: form.value.body,
      is_published: form.value.is_published,
    }
    if (editing.value === 'new') {
      await adminCreateNews(token(), selectedServerId.value, {
        ...payload,
        category: category.value,
        post_telegram: form.value.post_telegram,
        post_discord: form.value.post_discord,
      })
      toastSuccess('Новость создана' + (form.value.post_telegram || form.value.post_discord ? ' и отправлена' : ''))
    } else {
      await adminUpdateNews(token(), selectedServerId.value, editing.value, payload)
      toastSuccess('Новость сохранена')
    }
    cancelEdit()
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
    confirmText: 'Удалить',
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

async function broadcast(post, channel) {
  const payload = { post_telegram: channel === 'tg', post_discord: channel === 'dc' }
  try {
    const res = await adminBroadcastNews(token(), selectedServerId.value, post.id, payload)
    if (res.detail) toastInfo(res.detail)
    if ((channel === 'tg' && res.telegram_ok) || (channel === 'dc' && res.discord_ok)) {
      toastSuccess(channel === 'tg' ? 'Отправлено в Telegram' : 'Отправлено в Discord')
    } else if (!res.detail) {
      toastError('Отправка не удалась')
    }
    await loadPosts()
  } catch (e) {
    toastError(e?.message || 'Ошибка отправки')
  }
}

// ── markdown toolbar ────────────────────────────────────────────────────────
function surround(before, after = before, placeholder = '') {
  const el = bodyEl.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const val = form.value.body
  const sel = val.slice(start, end) || placeholder
  form.value.body = val.slice(0, start) + before + sel + after + val.slice(end)
  requestAnimationFrame(() => {
    el.focus()
    el.selectionStart = start + before.length
    el.selectionEnd = start + before.length + sel.length
  })
}
function linePrefix(prefix) {
  const el = bodyEl.value
  if (!el) return
  const start = el.selectionStart
  const val = form.value.body
  const lineStart = val.lastIndexOf('\n', start - 1) + 1
  form.value.body = val.slice(0, lineStart) + prefix + val.slice(lineStart)
  requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + prefix.length })
}

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

onMounted(() => {
  // Default to the first category the user can actually view.
  const first = visibleCats.value[0]
  if (first) category.value = first.key
  loadServers()
})
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1 class="adm-title">Новости</h1>
        <p class="adm-mut">Пиши новости для выбранного сервера и рассылай их в Telegram и Discord.</p>
      </div>
      <div class="news-head-actions">
        <select v-model="selectedServerId" class="adm-select">
          <option v-for="s in servers" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <button v-if="canManage" class="adm-btn adm-btn--acc" :disabled="!selectedServerId || editing === 'new'" @click="startNew">
          + Новая новость
        </button>
      </div>
    </div>

    <div v-if="visibleCats.length > 1" class="news-cat-tabs">
      <button
        v-for="c in visibleCats"
        :key="c.key"
        type="button"
        class="news-cat-tab"
        :class="{ 'news-cat-tab--active': category === c.key }"
        @click="setCategory(c.key)"
      >{{ c.label }}</button>
    </div>

    <div v-if="selectedServer && !tgConfigured && !dcConfigured" class="news-hint">
      ⚙️ Авторассылка выключена: у сервера не задан ни один канал. Добавь хотя бы один —
      Telegram chat_id <b>или</b> Discord webhook — в
      <RouterLink to="/admin/server" class="news-hint__link">настройках сервера</RouterLink>.
      Публикация новостей на сайте работает и без них.
    </div>
    <div v-else-if="selectedServer && (!tgConfigured || !dcConfigured)" class="news-hint news-hint--soft">
      ℹ️ Авторассылка активна для:
      <span v-if="tgConfigured">Telegram</span><span v-if="tgConfigured && dcConfigured"> и </span><span v-if="dcConfigured">Discord</span>.
      Второй канал можно добавить в
      <RouterLink to="/admin/server" class="news-hint__link">настройках сервера</RouterLink>.
    </div>

    <!-- Editor -->
    <div v-if="editing" class="adm-card news-editor">
      <div class="news-editor__grid">
        <div class="news-editor__main">
          <label class="adm-field"><span>Заголовок</span>
            <input v-model="form.title" class="adm-input" placeholder="Заголовок новости" maxlength="200" /></label>
          <label class="adm-field"><span>Краткое описание (для карточки и рассылки)</span>
            <textarea v-model="form.summary" class="adm-textarea" rows="2" maxlength="500" placeholder="1–2 предложения…" /></label>
          <div class="adm-field">
            <span>Обложка (необязательно)</span>
            <div class="cover-upload">
              <div v-if="form.cover_image_url" class="cover-preview">
                <img :src="form.cover_image_url" alt="" />
                <button type="button" class="cover-remove" title="Удалить обложку" @click="form.cover_image_url = ''">✕</button>
              </div>
              <label class="cover-btn" :class="{ 'cover-btn--busy': coverUploading }">
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden :disabled="coverUploading" @change="onCoverSelect" />
                <svg v-if="!coverUploading" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {{ coverUploading ? 'Загрузка…' : (form.cover_image_url ? 'Заменить изображение' : 'Загрузить с ПК') }}
              </label>
            </div>
            <p class="cover-hint">
              📐 Рекомендуемый размер — <b>1600×600</b> (соотношение 16:6). Минимум 1000×375.
              PNG/JPG/WEBP до 8&nbsp;МБ. Картинка автоматически обрежется по центру под баннер —
              держи важное (текст/лого) по центру, чтобы ничего не срезалось.
            </p>
          </div>

          <div class="adm-field">
            <span>Текст (Markdown)</span>
            <div class="md-toolbar">
              <button type="button" title="Заголовок" @click="linePrefix('## ')">H</button>
              <button type="button" title="Жирный" @click="surround('**', '**', 'текст')"><b>B</b></button>
              <button type="button" title="Курсив" @click="surround('*', '*', 'текст')"><i>I</i></button>
              <button type="button" title="Список" @click="linePrefix('- ')">≡</button>
              <button type="button" title="Цитата" @click="linePrefix('> ')">”</button>
              <button type="button" title="Ссылка" @click="surround('[', '](https://)', 'текст')">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </button>
              <button type="button" title="Картинка" @click="surround('![', '](https://)', 'alt')">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 20"/></svg>
              </button>
              <button type="button" title="Код" @click="surround('`', '`', 'код')">&lt;/&gt;</button>
            </div>
            <textarea ref="bodyEl" v-model="form.body" rows="14" class="adm-textarea md-textarea" placeholder="Пиши тут… Поддерживается Markdown." />
          </div>
        </div>

        <div class="news-editor__side">
          <div class="news-side-block">
            <span class="adm-label">Публикация</span>
            <label class="adm-check"><input v-model="form.is_published" type="checkbox" /> Опубликовать (видно на сайте)</label>
          </div>
          <div v-if="editing === 'new'" class="news-side-block">
            <span class="adm-label">Авторассылка при создании</span>
            <label class="adm-check" :class="{ 'news-chk--off': !tgConfigured }">
              <input v-model="form.post_telegram" type="checkbox" :disabled="!tgConfigured" /> В Telegram
            </label>
            <label class="adm-check" :class="{ 'news-chk--off': !dcConfigured }">
              <input v-model="form.post_discord" type="checkbox" :disabled="!dcConfigured" /> В Discord
            </label>
          </div>

          <div class="news-side-block">
            <span class="adm-label">Превью</span>
            <div class="md-preview markdown-body" v-html="preview || '<p style=\'opacity:.5\'>Пусто</p>'"></div>
          </div>
        </div>
      </div>

      <div class="news-editor__bar">
        <button class="adm-btn adm-btn--acc" :disabled="saving" @click="save">
          {{ saving ? 'Сохраняем…' : (editing === 'new' ? 'Создать' : 'Сохранить') }}
        </button>
        <button class="adm-btn" :disabled="saving" @click="cancelEdit">Отмена</button>
      </div>
    </div>

    <!-- List -->
    <div class="adm-card">
      <div v-if="loading" class="adm-mut" style="padding:1rem">Загрузка…</div>
      <div v-else-if="!posts.length" class="adm-empty">Новостей для этого сервера пока нет.</div>
      <table v-else class="news-table">
        <thead>
          <tr><th>Заголовок</th><th>Статус</th><th>Каналы</th><th>Дата</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="p in posts" :key="p.id">
            <td>
              <div class="news-row-title">{{ p.title }}</div>
              <div class="news-row-summary">{{ p.summary }}</div>
            </td>
            <td>
              <span class="adm-badge" :class="p.is_published ? 'adm-badge--acc' : 'adm-badge--warn'">
                {{ p.is_published ? 'Опубликовано' : 'Черновик' }}
              </span>
            </td>
            <td class="news-channels">
              <span :class="p.posted_telegram ? 'ch-on' : 'ch-off'" title="Telegram">TG</span>
              <span :class="p.posted_discord ? 'ch-on' : 'ch-off'" title="Discord">DC</span>
            </td>
            <td class="news-date">{{ fmtDate(p.published_at || p.created_at) }}</td>
            <td class="news-actions">
              <template v-if="canManage">
                <button class="adm-btn adm-btn--sm" @click="startEdit(p)">Ред.</button>
                <button class="adm-btn adm-btn--sm" :disabled="!tgConfigured" title="Отправить в Telegram" @click="broadcast(p, 'tg')">TG</button>
                <button class="adm-btn adm-btn--sm" :disabled="!dcConfigured" title="Отправить в Discord" @click="broadcast(p, 'dc')">DC</button>
                <button class="adm-btn adm-btn--sm adm-btn--danger" @click="removePost(p)">✕</button>
              </template>
              <span v-else class="adm-mut" style="font-size:.8rem">только просмотр</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.adm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
.news-head-actions { display: flex; gap: .6rem; align-items: center; }
.news-head-actions .adm-select { min-width: 190px; }
.news-cat-tabs { display: flex; gap: .4rem; margin-bottom: 1rem; }
.news-cat-tab {
  padding: .45rem 1.1rem; border-radius: 10px; cursor: pointer; font-size: .88rem; font-weight: 600;
  border: 1px solid rgba(var(--adm-acc-rgb), .18); background: rgba(var(--adm-acc-rgb), .04); color: var(--adm-mut, #8b86a3);
}
.news-cat-tab:hover { color: var(--adm-text); }
.news-cat-tab--active { background: rgba(var(--adm-acc-rgb), .18); color: var(--adm-text); border-color: rgba(var(--adm-acc-rgb), .4); }
.news-hint {
  background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.3);
  color: #fcd34d; border-radius: 12px; padding: .7rem 1rem; margin-bottom: 1rem; font-size: .88rem;
}
.news-hint__link { color: #fbbf24; text-decoration: underline; }
.news-hint--soft {
  background: rgba(124,58,237,.1); border-color: rgba(167,139,250,.3); color: #c4b5fd;
}
.news-hint--soft .news-hint__link { color: #a78bfa; }

.news-editor { margin-bottom: 1.25rem; padding: 1.1rem; }
.news-editor__grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.25rem; }
@media (max-width: 900px) { .news-editor__grid { grid-template-columns: 1fr; } }
.adm-field { margin-bottom: .85rem; }
.md-textarea { font-family: ui-monospace, monospace; line-height: 1.5; }

/* Cover upload */
.cover-upload { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
.cover-preview { position: relative; }
.cover-preview img {
  height: 74px; width: 132px; object-fit: cover; border-radius: 10px;
  border: 1px solid rgba(255,255,255,.14); display: block;
}
.cover-remove {
  position: absolute; top: -8px; right: -8px; width: 22px; height: 22px;
  border-radius: 50%; border: 1px solid rgba(255,255,255,.2);
  background: rgba(239,68,68,.9); color: #fff; cursor: pointer; font-size: .7rem;
  display: flex; align-items: center; justify-content: center;
}
.cover-btn {
  display: inline-flex; align-items: center; gap: .4rem;
  padding: .5rem .9rem; border-radius: 10px; cursor: pointer;
  border: 1px dashed rgba(167,139,250,.4); background: rgba(124,58,237,.1);
  color: #c4b5fd; font-size: .85rem; font-weight: 600;
}
.cover-btn:hover { background: rgba(124,58,237,.18); }
.cover-btn--busy { opacity: .6; cursor: default; }
.cover-hint { margin-top: .5rem; font-size: .78rem; line-height: 1.5; color: #8b86a3; max-width: 620px; }
.cover-hint b { color: #c4b5fd; }
.md-toolbar { display: flex; gap: .25rem; margin-bottom: .4rem; flex-wrap: wrap; }
.md-toolbar button {
  min-width: 30px; height: 30px; padding: 0 .5rem;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  color: #d6d2e6; border-radius: 8px; cursor: pointer; font-size: .85rem;
}
.md-toolbar button:hover { background: rgba(124,58,237,.25); }

.news-side-block { margin-bottom: 1rem; }
.news-side-block .adm-check { margin: .35rem 0; }
.news-chk--off { opacity: .5; }
.md-preview {
  background: rgba(10,7,20,.5); border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px; padding: .8rem 1rem; max-height: 340px; overflow-y: auto;
}
.news-editor__bar { display: flex; gap: .6rem; margin-top: 1rem; }

.news-table { width: 100%; border-collapse: collapse; }
.news-table th { text-align: left; font-size: .75rem; color: #8b86a3; text-transform: uppercase; padding: .6rem .5rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.news-table td { padding: .7rem .5rem; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.news-row-title { font-weight: 600; color: #f4f2fb; }
.news-row-summary { font-size: .8rem; color: #8b86a3; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.news-channels span { font-size: .72rem; font-weight: 700; padding: .1rem .35rem; border-radius: 5px; margin-right: .25rem; }
.ch-on { background: rgba(16,185,129,.18); color: #34d399; }
.ch-off { background: rgba(255,255,255,.06); color: #6b6880; }
.news-date { font-size: .82rem; color: #a5a1bb; white-space: nowrap; }
.news-actions { display: flex; gap: .3rem; justify-content: flex-end; }
</style>

<style>
/* markdown preview (shared with public .markdown-body rules if present) */
.md-preview.markdown-body h1, .md-preview.markdown-body h2, .md-preview.markdown-body h3 { color: #f4f2fb; margin: .6rem 0 .3rem; }
.md-preview.markdown-body a { color: #a78bfa; }
.md-preview.markdown-body code { background: rgba(255,255,255,.08); padding: .1rem .3rem; border-radius: 5px; }
.md-preview.markdown-body blockquote { border-left: 3px solid #7c3aed; padding-left: .8rem; color: #b8b2cf; margin: .5rem 0; }
.md-preview.markdown-body img { max-width: 100%; border-radius: 8px; }
</style>
