<script setup>
import { onMounted, ref, computed } from 'vue'
import { authState } from '../../stores/authStore'
import { toastError, toastSuccess } from '../../services/toast'
import { confirmDialog } from '../../composables/useConfirm'
import {
  adminListCosmetics, adminUploadCosmetic, adminPatchCosmetic, adminDeleteCosmetic, adminGrantCosmetic,
  adminListCosmeticUploads, adminPromoteCosmetic, adminUploadCosmeticPreview,
  adminListPlayerCosmetics, adminRevokeCosmetic, adminListCosmeticOwners,
} from '../../services/adminApi'

const token = () => authState.accessToken
const SLOTS = ['full', 'head', 'body', 'wings', 'accessory']
const slotLabel = { full: 'Весь', head: 'Голова', body: 'Тело', wings: 'Крылья', accessory: 'Аксессуар' }

const items = ref([])
const loading = ref(true)
const busy = ref('')

async function load() {
  loading.value = true
  try { items.value = await adminListCosmetics(token()) || [] }
  catch (e) { toastError(e?.message || 'Ошибка загрузки'); items.value = [] }
  finally { loading.value = false }
}

// upload
const up = ref({ name: '', slot: 'full', price: 0, file: null })
function onFile(e) { up.value.file = e.target.files?.[0] || null }
async function doUpload() {
  if (!up.value.file) { toastError('Выбери файл модели (экспорт из Figura)'); return }
  if (!up.value.name.trim()) { toastError('Укажи название'); return }
  busy.value = 'upload'
  try {
    await adminUploadCosmetic(token(), up.value.file, up.value.name.trim(), up.value.slot, Number(up.value.price) || 0)
    toastSuccess('Косметика загружена')
    up.value = { name: '', slot: 'full', price: 0, file: null }
    document.getElementById('cos-file').value = ''
    await load()
  } catch (e) { toastError(e?.message || 'Ошибка загрузки') } finally { busy.value = '' }
}

// promote from game (a player's Figura-loaded avatar → valid NBT)
const prom = ref({ nickname: '', slot: 'full', price: 0 })
const promUploads = ref([])
const promNames = ref({})   // avatar_id -> name
async function loadUploads() {
  if (!prom.value.nickname.trim()) { toastError('Укажи ник'); return }
  busy.value = 'uploads'
  try {
    promUploads.value = await adminListCosmeticUploads(token(), prom.value.nickname.trim()) || []
    if (!promUploads.value.length) toastError('У этого ника нет загруженных в Figura аватаров')
  } catch (e) { toastError(e?.message || 'Ошибка'); promUploads.value = [] } finally { busy.value = '' }
}
async function doPromote(a) {
  const name = (promNames.value[a.avatar_id] || '').trim()
  if (!name) { toastError('Введи название косметики'); return }
  busy.value = a.avatar_id
  try {
    await adminPromoteCosmetic(token(), {
      nickname: prom.value.nickname.trim(), source_avatar_id: a.avatar_id,
      name, slot: prom.value.slot, price: Number(prom.value.price) || 0,
    })
    toastSuccess(`Добавлено в каталог: ${name}`)
    promNames.value[a.avatar_id] = ''
    await load()
  } catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}

// row edit
async function savePatch(c, payload) {
  busy.value = c.slug
  try {
    const r = await adminPatchCosmetic(token(), c.slug, payload)
    Object.assign(c, r)
    toastSuccess('Сохранено')
  } catch (e) { toastError(e?.message || 'Ошибка'); await load() } finally { busy.value = '' }
}
function toggleEnabled(c) { savePatch(c, { enabled: !c.enabled }) }
function toggleFeatured(c) { savePatch(c, { featured: !c.featured }) }

// catalog search
const search = ref('')
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
})

// owners modal
const ownersOf = ref(null)   // cosmetic being inspected
const owners = ref([])
const ownersLoading = ref(false)
async function openOwners(c) {
  ownersOf.value = c
  ownersLoading.value = true
  owners.value = []
  try { owners.value = await adminListCosmeticOwners(token(), c.slug) || [] }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { ownersLoading.value = false }
}
async function revokeFromOwner(nick) {
  const ok = await confirmDialog({ title: 'Забрать', message: `Забрать «${ownersOf.value.name}» у ${nick}?`, confirmLabel: 'Забрать', danger: true })
  if (!ok) return
  try {
    await adminRevokeCosmetic(token(), nick, ownersOf.value.slug)
    owners.value = owners.value.filter((o) => o.nickname !== nick)
    toastSuccess('Забрано')
    await load()
  } catch (e) { toastError(e?.message || 'Ошибка') }
}
function commitField(c, field, value) {
  if (field === 'price') value = Number(value) || 0
  if (c[field] === value) return
  savePatch(c, { [field]: value })
}

async function onPreviewPick(c, e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  busy.value = c.slug
  try {
    const r = await adminUploadCosmeticPreview(token(), c.slug, file)
    c.preview_url = r.preview_url
    toastSuccess('Превью загружено')
  } catch (err) { toastError(err?.message || 'Ошибка превью') } finally { busy.value = '' }
}

async function doDelete(c) {
  const ok = await confirmDialog({
    title: 'Удалить косметику',
    message: `Удалить «${c.name}» (${c.slug})? Модель, каталог и выдачи ${c.owned_count} игрокам будут удалены. Необратимо.`,
    confirmLabel: 'Удалить', danger: true,
  })
  if (!ok) return
  busy.value = c.slug
  try { await adminDeleteCosmetic(token(), c.slug); items.value = items.value.filter((x) => x.slug !== c.slug) }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}

// grant
const grant = ref({ nickname: '', slug: '' })
async function doGrant() {
  if (!grant.value.nickname.trim() || !grant.value.slug) { toastError('Укажи ник и косметику'); return }
  busy.value = 'grant'
  try {
    const r = await adminGrantCosmetic(token(), grant.value.nickname.trim(), grant.value.slug)
    toastSuccess(r.already_owned ? `У ${r.nickname} уже была «${r.name}»` : `Выдано ${r.nickname}: ${r.name}`)
    grant.value.nickname = ''
    await load()
  } catch (e) { toastError(e?.message || 'Ошибка выдачи') } finally { busy.value = '' }
}

// player-owned cosmetics (view + revoke)
const pc = ref({ nickname: '' })
const pcList = ref([])
const pcLoadedNick = ref('')
async function loadPlayerCosmetics() {
  if (!pc.value.nickname.trim()) { toastError('Укажи ник'); return }
  busy.value = 'pc'
  try {
    pcList.value = await adminListPlayerCosmetics(token(), pc.value.nickname.trim()) || []
    pcLoadedNick.value = pc.value.nickname.trim()
    if (!pcList.value.length) toastError('У игрока нет косметики')
  } catch (e) { toastError(e?.message || 'Ошибка'); pcList.value = [] } finally { busy.value = '' }
}
async function doRevoke(item) {
  const ok = await confirmDialog({
    title: 'Забрать косметику',
    message: `Забрать «${item.name}» у игрока ${pcLoadedNick.value}?${item.equipped ? ' Сейчас надета — будет снята.' : ''}`,
    confirmLabel: 'Забрать', danger: true,
  })
  if (!ok) return
  busy.value = item.slug
  try {
    await adminRevokeCosmetic(token(), pcLoadedNick.value, item.slug)
    pcList.value = pcList.value.filter((x) => x.slug !== item.slug)
    toastSuccess('Косметика забрана')
    await load()
  } catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}

function kb(n) { return `${Math.max(1, Math.round((n || 0) / 1024))} КБ` }
function money(v) { return Number(v || 0).toLocaleString('ru') }

onMounted(load)
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Косметика Figura</h1>
        <p class="adm-sub">Каталог моделей: загрузка, цены, выдача игрокам · общие для всех серверов</p>
      </div>
      <button class="adm-btn" @click="load">Обновить</button>
    </div>

    <!-- promote from game (recommended) -->
    <div class="adm-card adm-card--pad">
      <div class="adm-label">Из игры (рекомендуется)</div>
      <p class="cos-hint">Загрузи модель в Figura в игре (мод сам упакует её в правильный формат) → укажи здесь свой ник → выбери аватар и добавь в каталог. Только так получается валидная модель.</p>
      <div class="cos-form">
        <input v-model="prom.nickname" class="adm-input" placeholder="Ник (чей аватар из Figura)" maxlength="32" style="flex:1;min-width:170px" />
        <select v-model="prom.slot" class="adm-select" style="width:130px">
          <option v-for="s in SLOTS" :key="s" :value="s">{{ slotLabel[s] }}</option>
        </select>
        <input v-model.number="prom.price" type="number" min="0" class="adm-input" placeholder="Цена VC" style="width:110px" />
        <button class="adm-btn" :disabled="busy === 'uploads'" @click="loadUploads">Показать аватары</button>
      </div>
      <div v-if="promUploads.length" class="cos-uploads">
        <div v-for="a in promUploads" :key="a.avatar_id" class="cos-upload-row">
          <span class="cos-upload-id">{{ a.avatar_id }} <span style="color:var(--adm-faint)">{{ kb(a.size_bytes) }}</span></span>
          <input v-model="promNames[a.avatar_id]" class="adm-input" placeholder="Название косметики" maxlength="48" style="flex:1;min-width:150px" />
          <button class="adm-btn adm-btn--acc adm-btn--sm" :disabled="busy === a.avatar_id" @click="doPromote(a)">В каталог</button>
        </div>
      </div>
    </div>

    <!-- upload file (advanced) -->
    <div class="adm-card adm-card--pad">
      <div class="adm-label">Загрузить файлом (для готового блоба Figura)</div>
      <p class="cos-hint">Только если у тебя уже есть валидный блоб Figura (gzip-NBT). Обычную папку/tar.gz грузить нельзя — Figura её не прочитает, используй «Из игры» выше.</p>
      <div class="cos-form">
        <input id="cos-file" type="file" class="adm-input cos-file" @change="onFile" />
        <input v-model="up.name" class="adm-input" placeholder="Название" maxlength="48" style="flex:1;min-width:150px" />
        <select v-model="up.slot" class="adm-select" style="width:130px">
          <option v-for="s in SLOTS" :key="s" :value="s">{{ slotLabel[s] }}</option>
        </select>
        <input v-model.number="up.price" type="number" min="0" class="adm-input" placeholder="Цена VC" style="width:110px" />
        <button class="adm-btn adm-btn--acc" :disabled="busy === 'upload'" @click="doUpload">{{ busy === 'upload' ? 'Загрузка…' : 'Загрузить' }}</button>
      </div>
    </div>

    <!-- grant -->
    <div class="adm-card adm-card--pad">
      <div class="adm-label">Выдать игроку</div>
      <div class="cos-form">
        <input v-model="grant.nickname" class="adm-input" placeholder="Ник игрока" maxlength="32" style="flex:1;min-width:150px" />
        <select v-model="grant.slug" class="adm-select" style="min-width:170px">
          <option value="">Выбери косметику</option>
          <option v-for="c in items" :key="c.slug" :value="c.slug">{{ c.name }}</option>
        </select>
        <button class="adm-btn adm-btn--acc" :disabled="busy === 'grant'" @click="doGrant">Выдать</button>
      </div>
    </div>

    <!-- player's cosmetics (view + revoke) -->
    <div class="adm-card adm-card--pad">
      <div class="adm-label">Косметика игрока</div>
      <p class="cos-hint">Посмотреть, что есть у игрока, и при необходимости забрать (надетая снимется автоматически).</p>
      <div class="cos-form">
        <input v-model="pc.nickname" class="adm-input" placeholder="Ник игрока" maxlength="32" style="flex:1;min-width:170px" @keyup.enter="loadPlayerCosmetics" />
        <button class="adm-btn" :disabled="busy === 'pc'" @click="loadPlayerCosmetics">Показать</button>
      </div>
      <div v-if="pcList.length" class="cos-uploads">
        <div v-for="it in pcList" :key="it.slug" class="cos-upload-row">
          <span class="cos-upload-id" style="min-width:auto">{{ it.name }}</span>
          <span class="adm-badge" style="font-size:.62rem">{{ it.slot }}</span>
          <span v-if="it.equipped" class="adm-badge adm-badge--ok" style="font-size:.62rem">надета</span>
          <span style="flex:1"></span>
          <button class="adm-btn adm-btn--danger adm-btn--sm" :disabled="busy === it.slug" @click="doRevoke(it)">Забрать</button>
        </div>
      </div>
    </div>

    <!-- catalog table -->
    <div v-if="loading" class="adm-skel" style="height: 260px" />
    <div v-else-if="!items.length" class="adm-empty">
      <div class="adm-empty__title">Косметики пока нет</div>
      <div class="adm-empty__sub">Загрузи первую модель выше</div>
    </div>
    <template v-else>
      <div class="cos-form" style="margin-bottom:10px">
        <input v-model="search" class="adm-input" placeholder="Поиск по названию / slug…" style="flex:1;min-width:200px" />
        <span class="adm-sub" style="align-self:center">{{ shown.length }} / {{ items.length }}</span>
      </div>
      <div class="adm-table-wrap">
      <div class="adm-table-scroll">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Превью</th>
              <th>Название</th>
              <th>Слот</th>
              <th>Цена VC</th>
              <th>Порядок</th>
              <th>Размер</th>
              <th>Куплено</th>
              <th>Хит</th>
              <th>Вкл.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in shown" :key="c.slug" :class="{ 'row--loading': busy === c.slug, 'row--dim': !c.enabled }">
              <td>
                <label class="cos-preview" :title="c.preview_url ? 'Заменить превью' : 'Загрузить превью'">
                  <img v-if="c.preview_url" :src="c.preview_url" alt="" />
                  <span v-else class="cos-preview__add">＋</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onPreviewPick(c, $event)" />
                </label>
              </td>
              <td>
                <input class="cos-cell" :value="c.name" @change="commitField(c, 'name', $event.target.value)" />
                <div class="adm-mono" style="color:var(--adm-faint);font-size:.66rem;margin-top:2px">{{ c.slug }}</div>
              </td>
              <td>
                <select class="cos-cell" :value="c.slot" @change="commitField(c, 'slot', $event.target.value)">
                  <option v-for="s in SLOTS" :key="s" :value="s">{{ slotLabel[s] }}</option>
                </select>
              </td>
              <td><input class="cos-cell cos-cell--num" type="number" min="0" :value="c.price" @change="commitField(c, 'price', $event.target.value)" /></td>
              <td><input class="cos-cell" style="width:64px" type="number" min="0" :value="c.sort_order" @change="commitField(c, 'sort_order', $event.target.value)" /></td>
              <td class="adm-num" style="color:var(--adm-mut)">{{ kb(c.size_bytes) }}</td>
              <td class="adm-num"><button class="cos-owners" :disabled="!c.owned_count" @click="openOwners(c)">{{ c.owned_count }}</button></td>
              <td><button class="cos-toggle cos-toggle--star" :class="{ on: c.featured }" :disabled="busy === c.slug" @click="toggleFeatured(c)">{{ c.featured ? '★' : '☆' }}</button></td>
              <td><button class="cos-toggle" :class="{ on: c.enabled }" :disabled="busy === c.slug" @click="toggleEnabled(c)">{{ c.enabled ? 'да' : 'нет' }}</button></td>
              <td><button class="adm-btn adm-btn--danger adm-btn--sm" :disabled="busy === c.slug" @click="doDelete(c)">Удалить</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </template>

    <!-- owners modal -->
    <div v-if="ownersOf" class="cos-ovl" @click.self="ownersOf = null">
      <div class="adm-card adm-card--pad cos-ownbox">
        <div class="adm-page__head" style="margin-bottom:10px">
          <div><h3 class="adm-title" style="font-size:1rem">Владельцы: {{ ownersOf.name }}</h3><p class="adm-sub">{{ owners.length }} игроков</p></div>
          <button class="adm-btn adm-btn--sm" @click="ownersOf = null">✕</button>
        </div>
        <div v-if="ownersLoading" class="adm-skel" style="height:120px" />
        <div v-else-if="!owners.length" class="adm-sub">Пока никто не владеет.</div>
        <div v-else class="cos-ownlist">
          <div v-for="o in owners" :key="o.nickname" class="cos-ownrow">
            <span class="adm-mono">{{ o.nickname }}</span>
            <span v-if="o.equipped" class="adm-badge adm-badge--ok" style="font-size:.6rem">надета</span>
            <span style="flex:1"></span>
            <button class="adm-btn adm-btn--danger adm-btn--sm" @click="revokeFromOwner(o.nickname)">Забрать</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cos-hint { font-size: .76rem; color: var(--adm-faint); margin: 2px 0 10px; }
.cos-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cos-file { flex: 1; min-width: 200px; padding: 6px 8px; }
.cos-uploads { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.cos-upload-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 7px 9px; border-radius: 9px; background: rgba(255,255,255,.02); border: 1px solid var(--adm-line-strong); }
.cos-upload-id { font-family: monospace; font-size: .76rem; color: var(--adm-mut); min-width: 90px; }
.cos-preview { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,.28); border: 1px solid var(--adm-line-strong); cursor: pointer; }
.cos-preview img { width: 100%; height: 100%; object-fit: contain; image-rendering: auto; }
.cos-preview__add { color: var(--adm-faint); font-size: 1.1rem; font-weight: 700; }
.cos-preview:hover { border-color: var(--adm-acc-line); }
.cos-cell { width: 100%; padding: 5px 7px; border-radius: 7px; background: #080c16; border: 1px solid var(--adm-line-strong); color: var(--adm-text); font-size: .8rem; }
.cos-cell--num { width: 90px; }
.cos-toggle { padding: 4px 12px; border-radius: 8px; font-weight: 800; font-size: .72rem; cursor: pointer; border: 1px solid rgba(248,113,113,.3); background: rgba(248,113,113,.1); color: #fca5a5; }
.cos-toggle.on { border-color: rgba(52,211,153,.3); background: rgba(52,211,153,.1); color: #6ee7b7; }
.cos-toggle--star { border-color: rgba(255,255,255,.1); background: rgba(255,255,255,.03); color: var(--adm-faint); }
.cos-toggle--star.on { border-color: rgba(245,166,35,.4); background: rgba(245,166,35,.12); color: #f5a623; }
.cos-owners { padding: 3px 12px; border-radius: 8px; font-weight: 800; font-size: .78rem; cursor: pointer; color: var(--adm-acc-text); background: var(--adm-acc-soft); border: 1px solid var(--adm-acc-line); }
.cos-owners:disabled { opacity: .4; cursor: default; color: var(--adm-faint); background: transparent; border-color: rgba(255,255,255,.08); }
.cos-ovl { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 20px; background: rgba(4,4,10,.6); backdrop-filter: blur(4px); }
.cos-ownbox { width: 100%; max-width: 420px; max-height: 80vh; overflow-y: auto; }
.cos-ownlist { display: flex; flex-direction: column; gap: 6px; }
.cos-ownrow { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 9px; background: rgba(255,255,255,.02); border: 1px solid var(--adm-line-strong); }
.row--loading { opacity: .55; pointer-events: none; }
.row--dim { opacity: .6; }
</style>
