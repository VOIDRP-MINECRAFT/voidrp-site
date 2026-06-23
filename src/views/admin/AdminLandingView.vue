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
  <div class="p-4 md:p-6 space-y-6 max-w-5xl">

    <!-- Header -->
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <h1 class="text-xl font-black text-slate-100">Галерея главной страницы</h1>
          <span v-if="!loading" class="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold bg-violet-500/15 text-violet-400 border border-violet-500/25">
            {{ count }}
          </span>
        </div>
        <p class="text-sm text-slate-500">Фотографии отображаются в бесконечной ленте на главной. Порядок — по времени загрузки.</p>
      </div>
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        class="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Посмотреть на сайте
      </a>
    </div>

    <!-- Upload zone -->
    <div
      class="dropzone rounded-[16px] border-2 border-dashed px-6 py-8 flex flex-col items-center gap-3 cursor-pointer select-none transition"
      :class="[
        dragover  ? 'border-violet-500/60 bg-violet-500/8' : 'border-violet-500/25 bg-violet-500/3 hover:border-violet-500/45 hover:bg-violet-500/6',
        uploading ? 'pointer-events-none opacity-70' : ''
      ]"
      @dragover.prevent="dragover = true"
      @dragleave="dragover = false"
      @drop.prevent="onDrop"
      @click="!uploading && fileInput?.click()"
    >
      <input ref="fileInput" type="file" accept="image/*" multiple class="sr-only" @change="onFileChange" />

      <template v-if="uploading">
        <svg class="animate-spin text-violet-400" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <p class="text-sm font-semibold text-slate-300">
          Загружаю {{ uploadProgress.done + 1 }} из {{ uploadProgress.total }}…
        </p>
        <div class="w-40 h-1 rounded-full bg-slate-700/60 overflow-hidden">
          <div
            class="h-full rounded-full bg-violet-500 transition-all duration-200"
            :style="{ width: uploadProgress.total ? (uploadProgress.done / uploadProgress.total * 100) + '%' : '0%' }"
          />
        </div>
      </template>

      <template v-else>
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center border transition"
          :class="dragover ? 'bg-violet-500/20 border-violet-500/40 scale-110' : 'bg-violet-500/10 border-violet-500/20'"
        >
          <svg class="text-violet-400" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
        <p class="text-sm text-slate-400">
          <span class="font-semibold text-violet-400">Выбери файлы</span> или перетащи сюда
        </p>
        <p class="text-xs text-slate-600">PNG · JPEG · WebP &nbsp;·&nbsp; до 12 МБ &nbsp;·&nbsp; несколько за раз</p>
      </template>
    </div>

    <!-- Loading skeletons -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <div v-for="i in 8" :key="i" class="aspect-video rounded-xl bg-slate-800/60 animate-pulse" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!count" class="flex flex-col items-center gap-3 py-14 text-center">
      <div class="text-slate-700">
        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </div>
      <p class="text-sm font-semibold text-slate-500">Фотографий пока нет</p>
      <p class="text-xs text-slate-600 max-w-xs">Загрузи скриншоты сервера — они появятся в ленте на главной странице</p>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <div
        v-for="(s, idx) in screenshots"
        :key="s.id"
        class="sc-card group relative aspect-video rounded-xl overflow-hidden border border-white/7 bg-white/3 transition"
        :class="deletingId === s.id ? 'opacity-40 pointer-events-none' : 'hover:border-white/14 hover:shadow-lg hover:shadow-black/30'"
      >
        <img :src="s.url" class="w-full h-full object-cover block transition duration-300 group-hover:scale-[1.03]" loading="lazy" decoding="async" />

        <!-- order badge -->
        <span class="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1 rounded-md text-[10px] font-bold bg-black/55 backdrop-blur-sm text-white/60 flex items-center justify-center pointer-events-none">
          {{ idx + 1 }}
        </span>

        <!-- hover overlay: delete button -->
        <div v-if="confirmDeleteId !== s.id && deletingId !== s.id"
          class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2"
        >
          <button
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/28 transition"
            @click.stop="askDelete(s.id)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Удалить
          </button>
        </div>

        <!-- confirm overlay -->
        <div v-else-if="confirmDeleteId === s.id"
          class="absolute inset-0 bg-black/75 backdrop-blur-[3px] flex flex-col items-center justify-center gap-2.5"
        >
          <p class="text-sm font-bold text-slate-100">Удалить фото?</p>
          <div class="flex gap-2">
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 border border-red-500/35 text-red-300 hover:bg-red-500/32 transition"
              @click.stop="confirmDelete(s.id)"
            >Да</button>
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/6 border border-white/12 text-slate-400 hover:bg-white/10 transition"
              @click.stop="cancelDelete()"
            >Отмена</button>
          </div>
        </div>

        <!-- deleting spinner -->
        <div v-else class="absolute inset-0 bg-black/60 flex items-center justify-center">
          <svg class="animate-spin text-violet-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
.bg-violet-500\/3  { background-color: rgb(139 92 246 / 0.03); }
.bg-violet-500\/6  { background-color: rgb(139 92 246 / 0.06); }
.bg-violet-500\/8  { background-color: rgb(139 92 246 / 0.08); }
.border-white\/7   { border-color: rgb(255 255 255 / 0.07); }
.border-white\/14  { border-color: rgb(255 255 255 / 0.14); }
.bg-white\/3       { background-color: rgb(255 255 255 / 0.03); }
.bg-white\/6       { background-color: rgb(255 255 255 / 0.06); }
</style>
