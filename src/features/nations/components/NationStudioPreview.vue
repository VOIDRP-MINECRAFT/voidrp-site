<script setup>
import { computed } from 'vue'

const props = defineProps({
  nation: { type: Object, default: null },
  form: { type: Object, required: true },
  publicNationUrl: { type: String, default: '' },
})

const title = computed(() => props.form.title || props.nation?.title || 'Название государства')
const tag = computed(() => props.form.tag || props.nation?.tag || 'TAG')
const shortDescription = computed(() => props.form.short_description || props.nation?.short_description || 'Короткое описание государства')
const description = computed(() => props.form.description || props.nation?.description || 'Подробное описание государства')
const accent = computed(() => props.form.accent_color || props.nation?.accent_color || '#6d5df6')

const iconUrl = computed(() => props.nation?.assets?.icon_url || props.nation?.assets?.icon_preview_url || '')
const bannerUrl = computed(() => props.nation?.assets?.banner_url || props.nation?.assets?.banner_preview_url || '')
const backgroundUrl = computed(() => props.nation?.assets?.background_url || props.nation?.assets?.background_preview_url || '')

const shellStyle = computed(() => {
  if (!backgroundUrl.value) {
    return { background: `linear-gradient(180deg, ${accent.value}12 0%, #f8fafc 36%, #eef2ff 100%)` }
  }
  return {
    backgroundImage: `linear-gradient(180deg, rgba(248,250,252,0.86), rgba(241,245,249,0.94)), url(${backgroundUrl.value})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
})

const heroStyle = computed(() => {
  if (bannerUrl.value) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.16), rgba(15,23,42,0.72)), url(${bannerUrl.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return { background: `linear-gradient(135deg, ${accent.value}55, rgba(15,23,42,0.95) 58%, rgba(2,6,23,1))` }
})

const iconFallback = computed(() => tag.value.slice(0, 2).toUpperCase())
</script>

<template>
  <div class="overflow-hidden rounded-[28px] border border-slate-200 shadow-[0_18px_70px_rgba(15,23,42,0.10)]" :style="shellStyle">
    <div class="p-3">
      <div class="overflow-hidden rounded-[24px] border border-white/50 bg-white/82 shadow-sm">
        <div class="relative h-[220px] overflow-hidden bg-slate-950" :style="heroStyle">
          <div class="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/55"></div>
        </div>

        <div class="relative px-4 pb-4">
          <div class="-mt-12 flex items-end gap-4">
            <div class="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[24px] border-4 border-white bg-slate-100 text-2xl font-black uppercase text-slate-700 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
              <img v-if="iconUrl" :src="iconUrl" alt="icon" class="h-full w-full object-cover" />
              <span v-else>{{ iconFallback }}</span>
            </div>

            <div class="min-w-0 flex-1 pb-1">
              <div class="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Государство</div>
              <h3 class="mt-2 truncate text-2xl font-black tracking-tight text-slate-950">{{ title }}</h3>
              <p class="mt-1 text-sm leading-6 text-slate-600">[{{ tag }}] · {{ shortDescription }}</p>
            </div>
          </div>

          <div class="mt-4 rounded-[20px] border border-slate-200 bg-white/82 p-4">
            <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Описание</p>
            <p class="mt-2 text-sm leading-6 text-slate-700">{{ description }}</p>
          </div>

          <div class="mt-3 rounded-[20px] border border-slate-200 bg-white/82 p-4">
            <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Ссылка</p>
            <p class="mt-2 break-all text-sm leading-6 text-slate-700">
              {{ publicNationUrl || `/nation/${props.form.slug || props.nation?.slug || 'your-nation'}` }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
