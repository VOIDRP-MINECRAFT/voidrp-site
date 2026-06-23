<script setup>
import { computed } from 'vue'

const props = defineProps({
  profile: {
    type: Object,
    default: null,
  },
  form: {
    type: Object,
    required: true,
  },
  publicProfileUrl: {
    type: String,
    default: '',
  },
})

function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(139, 92, 246, ${alpha})`
  const value = hex.replace('#', '')
  const normalized = value.length === 3 ? value.split('').map((x) => x + x).join('') : value

  if (normalized.length !== 6) {
    return `rgba(139, 92, 246, ${alpha})`
  }

  const intValue = Number.parseInt(normalized, 16)
  const r = (intValue >> 16) & 255
  const g = (intValue >> 8) & 255
  const b = intValue & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const displayName = computed(() => props.form.display_name || props.profile?.display_name || props.profile?.player_account?.minecraft_nickname || 'Твоё имя')
const slugText = computed(() => props.form.slug || props.profile?.slug || 'your-profile')
const statusText = computed(() => props.form.status_text || props.profile?.status_text || 'Короткий статус ещё не заполнен')
const bioText = computed(() => props.form.bio || props.profile?.bio || 'Здесь будет описание профиля.')

const accent = computed(() => props.form.accent_color || props.profile?.accent_color || '#8b5cf6')
const avatarUrl = computed(() => props.profile?.assets?.avatar_url || props.profile?.assets?.avatar_preview_url || '')
const bannerUrl = computed(() => props.profile?.assets?.banner_url || props.profile?.assets?.banner_preview_url || '')
const backgroundUrl = computed(() => props.profile?.assets?.background_url || props.profile?.assets?.background_preview_url || '')
const avatarFallback = computed(() => displayName.value.slice(0, 1).toUpperCase())

const pageShellStyle = computed(() => {
  const accentGlow = hexToRgba(accent.value, 0.18)

  if (!backgroundUrl.value) {
    return {
      background: [
        `radial-gradient(circle at top left, ${accentGlow} 0%, transparent 26%)`,
        `linear-gradient(180deg, ${hexToRgba(accent.value, 0.08)} 0%, #0b1020 34%, #111827 100%)`,
      ].join(', '),
      borderColor: hexToRgba(accent.value, 0.2),
      boxShadow: `0 20px 70px ${hexToRgba(accent.value, 0.12)}`,
    }
  }

  return {
    backgroundImage: [
      'linear-gradient(180deg, rgba(4,6,11,0.48), rgba(4,6,11,0.82))',
      `radial-gradient(circle at top left, ${accentGlow} 0%, transparent 28%)`,
      `url(${backgroundUrl.value})`,
    ].join(', '),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderColor: hexToRgba(accent.value, 0.2),
    boxShadow: `0 20px 70px ${hexToRgba(accent.value, 0.12)}`,
  }
})

const heroStyle = computed(() => {
  if (bannerUrl.value) {
    return {
      backgroundImage: [
        'linear-gradient(180deg, rgba(4,6,11,0.12), rgba(4,6,11,0.72))',
        `radial-gradient(circle at top left, ${hexToRgba(accent.value, 0.24)} 0%, transparent 32%)`,
        `url(${bannerUrl.value})`,
      ].join(', '),
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }

  return {
    background: [
      `radial-gradient(circle at top left, ${hexToRgba(accent.value, 0.36)} 0%, transparent 32%)`,
      'linear-gradient(135deg, rgba(6,9,19,0.96) 0%, rgba(10,15,27,0.98) 56%, rgba(22,28,48,1) 100%)',
    ].join(', '),
  }
})

const accentBadgeStyle = computed(() => ({
  borderColor: accent.value,
  backgroundColor: hexToRgba(accent.value, 0.12),
  color: accent.value,
}))

const accentDotStyle = computed(() => ({
  backgroundColor: accent.value,
  boxShadow: `0 0 0 8px ${hexToRgba(accent.value, 0.12)}`,
}))

const accentLineStyle = computed(() => ({
  background: `linear-gradient(90deg, ${accent.value}, ${hexToRgba(accent.value, 0.18)})`,
}))

const infoPanelStyle = computed(() => ({
  borderColor: hexToRgba(accent.value, 0.16),
  background: `linear-gradient(180deg, rgba(8,13,22,0.95), ${hexToRgba(accent.value, 0.12)})`,
  boxShadow: `0 16px 46px ${hexToRgba(accent.value, 0.12)}`,
}))

const cardStyle = computed(() => ({
  borderColor: hexToRgba(accent.value, 0.14),
  backgroundColor: hexToRgba(accent.value, 0.06),
}))
</script>

<template>
  <div class="overflow-hidden rounded-[28px] border shadow-[0_18px_70px_rgba(0,0,0,0.28)]" :style="pageShellStyle">
    <div class="p-3">
      <div class="overflow-hidden rounded-[24px] border border-white/10 bg-black/20 backdrop-blur">
        <div class="relative h-[220px] overflow-hidden bg-slate-950" :style="heroStyle">
          <div class="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/72"></div>

          <div class="absolute left-4 top-4 flex flex-wrap gap-2">
            <span class="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-white/88 backdrop-blur-md">
              @{{ slugText }}
            </span>
            <span class="rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em]" :style="accentBadgeStyle">
              Акцент
            </span>
          </div>
        </div>

        <div class="relative px-4 pb-4">
          <div class="-mt-14 rounded-[24px] border p-4 backdrop-blur" :style="infoPanelStyle">
            <div class="flex items-start gap-4">
              <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border-4 border-white/90 bg-slate-900 text-3xl font-black uppercase text-slate-100 shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
                <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="h-full w-full object-cover" />
                <span v-else>{{ avatarFallback }}</span>
              </div>

              <div class="min-w-0 flex-1 pt-1">
                <div class="flex items-center gap-3">
                  <span class="h-2.5 w-2.5 rounded-full" :style="accentDotStyle"></span>
                  <span class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Цвет страницы</span>
                </div>

                <h3 class="mt-3 break-words text-2xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] md:text-[1.95rem]">
                  {{ displayName }}
                </h3>

                <p class="mt-2 text-sm leading-6 text-slate-300">
                  {{ statusText }}
                </p>
              </div>
            </div>

            <div class="mt-4 h-[2px] w-full rounded-full" :style="accentLineStyle"></div>

            <div class="mt-4 grid gap-3">
              <div class="rounded-[20px] border p-4 backdrop-blur" :style="cardStyle">
                <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">О себе</p>
                <p class="mt-2 text-sm leading-6 text-slate-300">
                  {{ bioText }}
                </p>
              </div>

              <div class="rounded-[20px] border p-4 backdrop-blur" :style="cardStyle">
                <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Ссылка</p>
                <p class="mt-2 break-all text-sm leading-6 text-slate-300">
                  {{ publicProfileUrl || `/u/${slugText}` }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
