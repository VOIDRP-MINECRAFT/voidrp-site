<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  slotName: { type: String, required: true },
  variant: { type: String, default: 'banner' },
  previewUrl: { type: String, default: '' },
  selectedFileName: { type: String, default: '' },
  uploading: { type: Boolean, default: false },
  hasAsset: { type: Boolean, default: false },
  recommendation: { type: String, default: '' },
  accept: {
    type: String,
    default: 'image/png,image/jpeg,image/webp',
  },
})

const emit = defineEmits(['select-file', 'upload', 'remove'])
const fileInput = ref(null)

const previewClass = computed(() => {
  if (props.variant === 'avatar') return 'aspect-square max-w-[180px] rounded-[24px]'
  if (props.variant === 'background') return 'aspect-[16/9] rounded-[24px]'
  return 'aspect-[16/6] rounded-[24px]'
})

const slotChip = computed(() => {
  if (props.slotName === 'avatar') return 'Аватар'
  if (props.slotName === 'background') return 'Фон'
  return 'Баннер'
})

const pickerPanelClass = computed(() => {
  return props.selectedFileName
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]'
    : 'border-white/10 bg-slate-950/60 text-slate-200 hover:border-violet-400/40 hover:bg-violet-500/8'
})

const pickerHint = computed(() => {
  return props.selectedFileName ? 'Файл выбран. Можно загружать.' : 'Нажми, чтобы выбрать файл.'
})

function onSelect(event) {
  const file = event.target?.files?.[0] || null
  emit('select-file', file)
}

function openFilePicker() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
    <div class="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4">
      <div class="min-w-0">
        <h3 class="text-lg font-black text-slate-50">{{ title }}</h3>
        <p class="mt-1 text-sm leading-6 text-slate-400">{{ subtitle }}</p>
      </div>

      <span class="shrink-0 rounded-full border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
        {{ slotChip }}
      </span>
    </div>

    <div class="p-4">
      <div class="flex justify-center">
        <div class="flex w-full items-center justify-center overflow-hidden border border-white/10 bg-slate-950 shadow-sm" :class="previewClass">
          <img v-if="previewUrl" :src="previewUrl" :alt="title" class="h-full w-full object-cover" />
          <div v-else class="flex h-full w-full items-center justify-center px-6 text-center text-sm font-semibold leading-6 text-slate-500">
            Изображение пока не выбрано
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <div class="rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3">
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Файл</p>
          <p class="mt-2 break-words text-sm font-medium leading-6 text-slate-200">{{ selectedFileName || 'Ничего не выбрано' }}</p>
        </div>

        <div class="rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3">
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Рекомендации</p>
          <p class="mt-2 text-sm leading-6 text-slate-300">{{ recommendation }}</p>
        </div>
      </div>

      <div class="mt-3 rounded-[18px] border border-dashed border-white/10 bg-slate-950/60 px-4 py-3">
        <input ref="fileInput" type="file" :accept="accept" class="hidden" @change="onSelect" />

        <button
          type="button"
          class="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-[16px] border px-4 py-4 text-left transition"
          :class="pickerPanelClass"
          @click="openFilePicker"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-100 group-hover:text-white">Выбрать файл</p>
            <p class="mt-1 text-sm leading-6" :class="selectedFileName ? 'text-emerald-200' : 'text-slate-400 group-hover:text-slate-300'">
              {{ pickerHint }}
            </p>
          </div>

          <div
            class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition"
            :class="selectedFileName ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-black/20 text-slate-300 group-hover:border-violet-400/30 group-hover:bg-violet-500/10 group-hover:text-violet-200'"
          >
            Нажать
          </div>
        </button>

        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary rounded-2xl" :disabled="uploading || !selectedFileName" @click="$emit('upload')">
            <span v-if="uploading" class="spinner"></span>
            <span v-else>Загрузить</span>
          </button>

          <button type="button" class="btn btn-outline rounded-2xl" :disabled="uploading || !hasAsset" @click="$emit('remove')">
            Удалить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
