<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/authStore.js'
import { landingListScreenshots, landingUploadScreenshot, landingDeleteScreenshot } from '../../services/adminLandingApi.js'
import { toastSuccess, toastError } from '../../services/toast.js'

const auth = useAuthStore()
const token = auth.state.accessToken

const screenshots = ref([])
const loading = ref(true)
const uploading = ref(false)
const uploadProgress = ref({ done: 0, total: 0 })
const deletingId = ref(null)
const confirmDeleteId = ref(null)
const fileInput = ref(null)
const dragover = ref(false)

const count = computed(() => screenshots.value.length)

async function load() {
  loading.value = true
  try {
    screenshots.value = await landingListScreenshots(token)
  } catch (e) {
    toastError(e.message || 'Не удалось загрузить скриншоты')
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function handleFiles(files) {
  const list = Array.from(files || [])
  if (!list.length) return
  uploading.value = true
  uploadProgress.value = { done: 0, total: list.length }
  try {
    for (const file of list) {
      const result = await landingUploadScreenshot(token, file)
      screenshots.value.push(result)
      uploadProgress.value.done++
    }
    toastSuccess(list.length === 1 ? 'Фото добавлено' : `Добавлено ${list.length} фото`)
  } catch (e) {
    toastError(e.message || 'Ошибка загрузки')
  } finally {
    uploading.value = false
    uploadProgress.value = { done: 0, total: 0 }
    if (fileInput.value) fileInput.value.value = ''
  }
}

function onFileChange(e) { handleFiles(e.target.files) }
function onDrop(e)       { dragover.value = false; handleFiles(e.dataTransfer.files) }
function askDelete(id)   { confirmDeleteId.value = id }
function cancelDelete()  { confirmDeleteId.value = null }

async function confirmDelete(id) {
  confirmDeleteId.value = null
  deletingId.value = id
  try {
    await landingDeleteScreenshot(token, id)
    screenshots.value = screenshots.value.filter(s => s.id !== id)
    toastSuccess('Скриншот удалён')
  } catch (e) {
    toastError(e.message || 'Ошибка удаления')
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="adm-page" style="max-width: 1060px">

    <!-- Header -->
    <div class="adm-page__head">
      <div>
        <div style="display: flex; align-items: center; gap: 0.5rem">
          <h1 class="adm-title">Галерея главной страницы</h1>
          <span v-if="!loading" class="adm-badge adm-badge--acc">{{ count }}</span>
        </div>
        <p class="adm-sub">Фотографии отображаются в бесконечной ленте на главной. Порядок — по времени загрузки.</p>
      </div>
      <a href="/" target="_blank" rel="noreferrer" class="adm-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Посмотреть на сайте
      </a>
    </div>

    <!-- Upload zone -->
    <div
      class="lz"
      :class="{ 'lz--over': dragover, 'lz--busy': uploading }"
      @dragover.prevent="dragover = true"
      @dragleave="dragover = false"
      @drop.prevent="onDrop"
      @click="!uploading && fileInput?.click()"
    >
      <input ref="fileInput" type="file" accept="image/*" multiple class="sr-only" @change="onFileChange" />

      <template v-if="uploading">
        <span class="lz__spin" />
        <p class="lz__title">Загружаю {{ uploadProgress.done + 1 }} из {{ uploadProgress.total }}…</p>
        <div class="lz__bar"><div class="lz__bar-fill" :style="{ width: uploadProgress.total ? (uploadProgress.done / uploadProgress.total * 100) + '%' : '0%' }" /></div>
      </template>

      <template v-else>
        <div class="lz__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
        <p class="lz__title"><span class="lz__accent">Выбери файлы</span> или перетащи сюда</p>
        <p class="lz__hint">PNG · JPEG · WebP · до 12 МБ · несколько за раз</p>
      </template>
    </div>

    <!-- Loading skeletons -->
    <div v-if="loading" class="sc-grid">
      <div v-for="i in 8" :key="i" class="adm-skel" style="aspect-ratio: 16/9" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!count" class="adm-empty">
      <div class="adm-empty__title">Фотографий пока нет</div>
      <div class="adm-empty__sub">Загрузи скриншоты сервера — они появятся в бесконечной ленте на главной странице</div>
    </div>

    <!-- Grid -->
    <div v-else class="sc-grid">
      <div
        v-for="(s, idx) in screenshots"
        :key="s.id"
        class="sc-card"
        :class="{ 'sc-card--busy': deletingId === s.id }"
      >
        <img :src="s.url" :alt="'Скриншот ' + (idx + 1)" class="sc-card__img" loading="lazy" decoding="async" />

        <span class="sc-card__num adm-num">{{ idx + 1 }}</span>

        <!-- hover overlay: delete button -->
        <div v-if="confirmDeleteId !== s.id && deletingId !== s.id" class="sc-card__hover">
          <button class="adm-btn adm-btn--danger adm-btn--sm" @click.stop="askDelete(s.id)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Удалить
          </button>
        </div>

        <!-- confirm overlay -->
        <div v-else-if="confirmDeleteId === s.id" class="sc-card__confirm">
          <p class="sc-card__q">Удалить фото?</p>
          <div class="sc-card__q-btns">
            <button class="adm-btn adm-btn--danger adm-btn--sm" @click.stop="confirmDelete(s.id)">Да</button>
            <button class="adm-btn adm-btn--sm" @click.stop="cancelDelete()">Отмена</button>
          </div>
        </div>

        <!-- deleting spinner -->
        <div v-else class="sc-card__busy-ov"><span class="lz__spin" /></div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* Зона загрузки */
.lz {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
  padding: 2rem 1.5rem; border-radius: var(--adm-r);
  border: 2px dashed var(--adm-acc-line); background: var(--adm-acc-soft);
  cursor: pointer; user-select: none; text-align: center;
  transition: border-color 0.15s, background-color 0.15s;
}
.lz:hover { border-color: rgba(var(--adm-acc-rgb), 0.5); }
.lz--over { border-color: rgba(var(--adm-acc-rgb), 0.7); background: rgba(var(--adm-acc-rgb), 0.12); }
.lz--busy { pointer-events: none; opacity: 0.7; }
.lz__icon {
  width: 3rem; height: 3rem; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  background: var(--adm-acc-soft); border: 1px solid var(--adm-acc-line); color: var(--adm-acc-text);
  transition: transform 0.15s;
}
.lz--over .lz__icon { transform: scale(1.1); }
.lz__icon svg { width: 1.35rem; height: 1.35rem; }
.lz__title { font-size: 0.85rem; font-weight: 600; color: var(--adm-mut); margin: 0; }
.lz__accent { font-weight: 800; color: var(--adm-acc-text); }
.lz__hint { font-size: 0.72rem; color: var(--adm-dim); margin: 0; }
.lz__bar { width: 10rem; height: 4px; border-radius: 99px; background: rgba(148,163,184,0.2); overflow: hidden; }
.lz__bar-fill { height: 100%; border-radius: 99px; background: var(--adm-acc); transition: width 0.2s; }
.lz__spin {
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid var(--adm-acc-line); border-top-color: var(--adm-acc-text);
  animation: lz-spin 0.7s linear infinite;
}
@keyframes lz-spin { to { transform: rotate(360deg); } }

/* Сетка скриншотов */
.sc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; }
.sc-card {
  position: relative; aspect-ratio: 16/9; border-radius: var(--adm-r-sm); overflow: hidden;
  border: 1px solid var(--adm-line); background: var(--adm-card);
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.sc-card:hover { border-color: var(--adm-line-strong); box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
.sc-card--busy { opacity: 0.4; pointer-events: none; }
.sc-card__img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s; }
.sc-card:hover .sc-card__img { transform: scale(1.03); }
.sc-card__num {
  position: absolute; top: 0.35rem; left: 0.35rem;
  min-width: 20px; height: 20px; padding: 0 0.3rem; border-radius: 6px;
  font-size: 0.62rem; font-weight: 700; color: rgba(255,255,255,0.7);
  background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; pointer-events: none;
}
.sc-card__hover {
  position: absolute; inset: 0; display: flex; align-items: flex-end; padding: 0.5rem;
  background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
  opacity: 0; transition: opacity 0.15s;
}
.sc-card:hover .sc-card__hover { opacity: 1; }
.sc-card__confirm {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 0.6rem;
  background: rgba(3,5,10,0.78); backdrop-filter: blur(3px);
}
.sc-card__q { font-size: 0.85rem; font-weight: 800; color: var(--adm-text); margin: 0; }
.sc-card__q-btns { display: flex; gap: 0.4rem; }
.sc-card__busy-ov { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(3,5,10,0.6); }
</style>
