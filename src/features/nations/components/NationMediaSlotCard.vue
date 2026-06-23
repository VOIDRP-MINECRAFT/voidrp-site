<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  previewUrl: { type: String, default: '' },
  selectedFileName: { type: String, default: '' },
  uploading: { type: Boolean, default: false },
  hasAsset: { type: Boolean, default: false },
  recommendation: { type: String, default: '' },
  variant: { type: String, default: 'banner' },
})

const emit = defineEmits(['select-file', 'upload', 'remove'])

function onSelect(event) {
  emit('select-file', event.target?.files?.[0] || null)
}
</script>

<template>
  <div class="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
    <div class="border-b border-white/10 px-4 py-4">
      <h3 class="text-lg font-black text-slate-50">{{ title }}</h3>
      <p class="mt-1 text-sm leading-6 text-slate-400">{{ subtitle }}</p>
    </div>

    <div class="p-4">
      <div class="overflow-hidden rounded-[22px] border border-white/10 bg-slate-950" :class="variant === 'icon' ? 'aspect-square max-w-[180px]' : variant === 'background' ? 'aspect-[16/9]' : 'aspect-[16/6]'">
        <img v-if="previewUrl" :src="previewUrl" :alt="title" class="h-full w-full object-cover" />
        <div v-else class="flex h-full w-full items-center justify-center px-5 text-center text-sm font-medium text-slate-500">Изображение пока не выбрано</div>
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
        <label class="form-control">
          <span class="mb-2 text-sm font-semibold text-slate-300">Выбрать файл</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" class="file-input w-full rounded-2xl" @change="onSelect" />
        </label>

        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary rounded-2xl" :disabled="uploading || !selectedFileName" @click="$emit('upload')">
            <span v-if="uploading" class="spinner"></span>
            <span v-else>Загрузить</span>
          </button>

          <button type="button" class="btn btn-outline rounded-2xl" :disabled="uploading || !hasAsset" @click="$emit('remove')">Удалить</button>
        </div>
      </div>
    </div>
  </div>
</template>
