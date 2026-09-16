<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { RouterLink, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AccountTabs from '../components/AccountTabs.vue'
import { SOCIAL_PLATFORMS } from '../utils/socialLinks.js'
import { accentVars } from '../utils/accentColor.js'
import {
  deleteAvatar,
  deleteBackground,
  deleteBanner,
  getMyPublicProfile,
  updateMyPublicProfile,
  uploadAvatar,
  uploadBackground,
  uploadBanner,
} from '../services/profileApi'
import { toastError, toastSuccess } from '../services/toast'
import { useAuthStore } from '../stores/authStore'

const { t } = useI18n()
const authStore = useAuthStore()

// Limits mirror UpdatePublicProfileRequest and the media settings on the backend.
const LIMITS = { name: 32, status: 140, bio: 500, slugMin: 3, slugMax: 64 }
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/
const MEDIA = {
  avatar: { maxBytes: 512 * 1024, upload: uploadAvatar, remove: deleteAvatar },
  banner: { maxBytes: 2 * 1024 * 1024, upload: uploadBanner, remove: deleteBanner },
  background: { maxBytes: 3 * 1024 * 1024, upload: uploadBackground, remove: deleteBackground },
}
const ACCEPT = 'image/png,image/jpeg,image/webp'
const COLOR_PRESETS = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#f5f5f4', '#64748b']

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const profile = ref(null)
const busy = reactive({ avatar: false, banner: false, background: false })
const fileInputs = { avatar: ref(null), banner: ref(null), background: ref(null) }
const snapshot = ref('')

const form = reactive({
  slug: '',
  display_name: '',
  bio: '',
  status_text: '',
  theme_mode: 'default',
  accent_color: '#8b5cf6',
  is_public: true,
  allow_followers_list_public: true,
  allow_friends_list_public: true,
  social_links: Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, ''])),
})

const assets = computed(() => profile.value?.assets || {})
const avatarUrl = computed(() => assets.value.avatar_url || assets.value.avatar_preview_url || '')
const bannerUrl = computed(() => assets.value.banner_url || assets.value.banner_preview_url || '')
const backgroundUrl = computed(() => assets.value.background_url || assets.value.background_preview_url || '')

const origin = typeof window !== 'undefined' ? window.location.host : 'void-rp.ru'
const slugClean = computed(() => form.slug.trim().toLowerCase())
const slugError = computed(() => (slugClean.value && !SLUG_RE.test(slugClean.value) ? t('editProfile.slugInvalid') : ''))
const savedSlug = computed(() => profile.value?.slug || '')
const publicUrl = computed(() => (savedSlug.value ? `/u/${savedSlug.value}` : ''))

const accent = computed(() => (/^#[0-9a-f]{6}$/i.test(form.accent_color) ? form.accent_color : '#8b5cf6'))
const previewVars = computed(() => accentVars(accent.value, '--pv'))
const previewName = computed(() => form.display_name.trim() || authStore.state.playerAccount?.minecraft_nickname || savedSlug.value || t('app.playerFallback'))
const previewLinks = computed(() => SOCIAL_PLATFORMS.filter((p) => form.social_links[p.key]?.trim()))

function serialize() {
  return JSON.stringify({ ...form, social_links: { ...form.social_links } })
}
const dirty = computed(() => Boolean(snapshot.value) && serialize() !== snapshot.value)
const canSave = computed(() => dirty.value && !slugError.value && !saving.value)

// What would make the page look finished; shown as a short list, not a percentage.
const missing = computed(() => {
  const list = []
  if (!avatarUrl.value) list.push('avatar')
  if (!bannerUrl.value) list.push('banner')
  if (!form.status_text.trim()) list.push('status')
  if (!form.bio.trim()) list.push('bio')
  return list
})

function hydrate(payload) {
  profile.value = payload
  form.slug = payload?.slug || ''
  form.display_name = payload?.display_name || ''
  form.bio = payload?.bio || ''
  form.status_text = payload?.status_text || ''
  form.theme_mode = payload?.theme_mode || 'default'
  form.accent_color = payload?.accent_color || '#8b5cf6'
  form.is_public = Boolean(payload?.is_public)
  form.allow_followers_list_public = Boolean(payload?.allow_followers_list_public)
  form.allow_friends_list_public = Boolean(payload?.allow_friends_list_public)
  for (const p of SOCIAL_PLATFORMS) form.social_links[p.key] = payload?.social_links?.[p.key] || ''
  snapshot.value = serialize()
}

// Media uploads return the whole profile; keep unsaved text edits instead of overwriting them.
function applyAssets(payload) {
  if (!payload) return
  const keepDirty = dirty.value ? JSON.parse(serialize()) : null
  hydrate(payload)
  if (keepDirty) {
    const base = snapshot.value
    Object.assign(form, { ...keepDirty, social_links: form.social_links })
    Object.assign(form.social_links, keepDirty.social_links)
    snapshot.value = base
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    hydrate(await getMyPublicProfile(authStore.accessToken))
  } catch (err) {
    loadError.value = err.message || t('editProfile.loadError')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    const payload = await updateMyPublicProfile(authStore.accessToken, {
      slug: slugClean.value || null,
      display_name: form.display_name.trim() || null,
      bio: form.bio.trim() || null,
      status_text: form.status_text.trim() || null,
      theme_mode: form.theme_mode || 'default',
      accent_color: accent.value,
      is_public: form.is_public,
      allow_followers_list_public: form.allow_followers_list_public,
      allow_friends_list_public: form.allow_friends_list_public,
      social_links: Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, form.social_links[p.key]?.trim() || null])),
    })
    hydrate(payload)
    toastSuccess(t('editProfile.saved'))
  } catch (err) {
    toastError(err.message || t('editProfile.saveError'))
  } finally {
    saving.value = false
  }
}

function discard() {
  if (profile.value) hydrate(profile.value)
}

function pick(slot) {
  fileInputs[slot].value?.click()
}

// Picking a file uploads it straight away: no separate "upload" step.
async function onPicked(slot, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!ACCEPT.split(',').includes(file.type)) {
    toastError(t('editProfile.badType'))
    return
  }
  if (file.size > MEDIA[slot].maxBytes) {
    toastError(t('editProfile.tooBig', { size: formatSize(MEDIA[slot].maxBytes) }))
    return
  }
  busy[slot] = true
  try {
    applyAssets(await MEDIA[slot].upload(authStore.accessToken, file))
    toastSuccess(t('editProfile.imageSaved'))
  } catch (err) {
    toastError(err.message || t('editProfile.uploadError'))
  } finally {
    busy[slot] = false
  }
}

async function removeMedia(slot) {
  busy[slot] = true
  try {
    applyAssets(await MEDIA[slot].remove(authStore.accessToken))
    toastSuccess(t('editProfile.imageRemoved'))
  } catch (err) {
    toastError(err.message || t('editProfile.uploadError'))
  } finally {
    busy[slot] = false
  }
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${bytes / (1024 * 1024)} MB` : `${Math.round(bytes / 1024)} KB`
}

function beforeUnload(e) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}
onBeforeRouteLeave(() => (dirty.value ? window.confirm(t('editProfile.leaveConfirm')) : true))
onMounted(() => {
  load()
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <section class="ed-page">
    <div class="container-shell ed">
      <header class="ed-head">
        <div>
          <h1 class="ed-title">{{ t('editProfile.title') }}</h1>
          <p class="ed-sub">{{ t('editProfile.subtitle') }}</p>
        </div>
        <RouterLink v-if="publicUrl" :to="publicUrl" class="ed-btn">
          <svg class="ed-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          {{ t('editProfile.openProfile') }}
        </RouterLink>
      </header>

      <AccountTabs />

      <div v-if="loading" class="ed-grid">
        <div class="skeleton ed-skel ed-skel--tall"></div>
        <div class="skeleton ed-skel"></div>
      </div>
      <div v-else-if="loadError" class="alert alert-error">{{ loadError }}</div>

      <div v-else class="ed-grid">
        <div class="ed-main">
          <!-- look: cover, avatar, background -->
          <section class="ed-card">
            <h2 class="ed-h">{{ t('editProfile.lookTitle') }}</h2>
            <p class="ed-hint">{{ t('editProfile.lookHint') }}</p>

            <div class="ed-cover" :class="{ 'ed-cover--empty': !bannerUrl }" :style="bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : null">
              <button type="button" class="ed-cover__hit" :disabled="busy.banner" :aria-label="bannerUrl ? t('editProfile.changeCover') : t('editProfile.addCover')" @click="pick('banner')"></button>
              <div class="ed-cover__actions">
                <button type="button" class="ed-chipbtn" :disabled="busy.banner" @click="pick('banner')">
                  <span v-if="busy.banner" class="spinner"></span>
                  <svg v-else class="ed-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/></svg>
                  {{ bannerUrl ? t('editProfile.changeCover') : t('editProfile.addCover') }}
                </button>
                <button v-if="bannerUrl" type="button" class="ed-chipbtn ed-chipbtn--icon" :disabled="busy.banner" :aria-label="t('editProfile.removeCover')" :title="t('editProfile.removeCover')" @click="removeMedia('banner')">
                  <svg class="ed-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
                </button>
              </div>
              <p v-if="!bannerUrl" class="ed-cover__empty">{{ t('editProfile.coverEmpty') }}</p>
            </div>

            <div class="ed-under">
              <button type="button" class="ed-avatar" :disabled="busy.avatar" :aria-label="t('editProfile.changeAvatar')" @click="pick('avatar')">
                <img v-if="avatarUrl" :src="avatarUrl" alt="" />
                <span v-else class="ed-avatar__plus">+</span>
                <span class="ed-avatar__overlay">
                  <span v-if="busy.avatar" class="spinner"></span>
                  <svg v-else class="ed-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/></svg>
                </span>
              </button>
              <div class="ed-under__text">
                <p class="ed-label">{{ t('editProfile.avatarTitle') }}</p>
                <p class="ed-hint">{{ t('editProfile.avatarRec') }}</p>
                <div class="ed-row">
                  <button type="button" class="ed-btn ed-btn--sm" :disabled="busy.avatar" @click="pick('avatar')">{{ avatarUrl ? t('editProfile.change') : t('editProfile.upload') }}</button>
                  <button v-if="avatarUrl" type="button" class="ed-btn ed-btn--sm ed-btn--danger" :disabled="busy.avatar" @click="removeMedia('avatar')">{{ t('editProfile.remove') }}</button>
                </div>
              </div>
              <p class="ed-hint ed-under__cover">{{ t('editProfile.bannerRec') }}</p>
            </div>

            <div class="ed-bg">
              <div class="ed-bg__thumb" :style="backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : null">
                <span v-if="!backgroundUrl">{{ t('editProfile.none') }}</span>
              </div>
              <div class="ed-bg__text">
                <p class="ed-label">{{ t('editProfile.bgTitle') }} <span class="ed-optional">{{ t('editProfile.optional') }}</span></p>
                <p class="ed-hint">{{ t('editProfile.bgSubtitle') }} {{ t('editProfile.bgRec') }}</p>
              </div>
              <div class="ed-row">
                <button type="button" class="ed-btn ed-btn--sm" :disabled="busy.background" @click="pick('background')">
                  <span v-if="busy.background" class="spinner"></span>
                  {{ backgroundUrl ? t('editProfile.change') : t('editProfile.upload') }}
                </button>
                <button v-if="backgroundUrl" type="button" class="ed-btn ed-btn--sm ed-btn--danger" :disabled="busy.background" @click="removeMedia('background')">{{ t('editProfile.remove') }}</button>
              </div>
            </div>

            <input :ref="fileInputs.banner" type="file" :accept="ACCEPT" hidden @change="onPicked('banner', $event)" />
            <input :ref="fileInputs.avatar" type="file" :accept="ACCEPT" hidden @change="onPicked('avatar', $event)" />
            <input :ref="fileInputs.background" type="file" :accept="ACCEPT" hidden @change="onPicked('background', $event)" />
          </section>

          <!-- text -->
          <section class="ed-card">
            <h2 class="ed-h">{{ t('editProfile.aboutTitle') }}</h2>
            <div class="ed-fields">
              <label class="ed-field">
                <span class="ed-field__top"><span class="ed-label">{{ t('editProfile.displayNameLabel') }}</span><span class="ed-count">{{ form.display_name.length }}/{{ LIMITS.name }}</span></span>
                <input v-model="form.display_name" type="text" :maxlength="LIMITS.name" class="ed-input" :placeholder="authStore.state.playerAccount?.minecraft_nickname || ''" />
              </label>

              <label class="ed-field">
                <span class="ed-field__top"><span class="ed-label">{{ t('editProfile.slugLabel') }}</span></span>
                <span class="ed-prefixed" :class="{ 'ed-prefixed--err': slugError }">
                  <span class="ed-prefix">{{ origin }}/u/</span>
                  <input v-model="form.slug" type="text" :maxlength="LIMITS.slugMax" class="ed-input ed-input--bare" autocapitalize="off" spellcheck="false" />
                </span>
                <span v-if="slugError" class="ed-err">{{ slugError }}</span>
                <span v-else-if="savedSlug && slugClean && slugClean !== savedSlug" class="ed-warn">{{ t('editProfile.slugChangeWarn') }}</span>
                <span v-else class="ed-hint">{{ t('editProfile.slugHint') }}</span>
              </label>

              <label class="ed-field">
                <span class="ed-field__top"><span class="ed-label">{{ t('editProfile.statusLabel') }}</span><span class="ed-count">{{ form.status_text.length }}/{{ LIMITS.status }}</span></span>
                <input v-model="form.status_text" type="text" :maxlength="LIMITS.status" class="ed-input" :placeholder="t('editProfile.statusPlaceholder')" />
              </label>

              <label class="ed-field">
                <span class="ed-field__top"><span class="ed-label">{{ t('editProfile.bioLabel') }}</span><span class="ed-count">{{ form.bio.length }}/{{ LIMITS.bio }}</span></span>
                <textarea v-model="form.bio" rows="4" :maxlength="LIMITS.bio" class="ed-input ed-textarea" :placeholder="t('editProfile.bioPlaceholder')"></textarea>
              </label>
            </div>
          </section>

          <!-- colour -->
          <section class="ed-card">
            <h2 class="ed-h">{{ t('editProfile.accentTitle') }}</h2>
            <p class="ed-hint">{{ t('editProfile.accentHint') }}</p>
            <div class="ed-swatches" role="radiogroup" :aria-label="t('editProfile.accentTitle')">
              <button v-for="c in COLOR_PRESETS" :key="c" type="button" role="radio" class="ed-swatch"
                      :aria-checked="accent.toLowerCase() === c" :aria-label="c"
                      :class="{ on: accent.toLowerCase() === c }" :style="{ '--sw': c }" @click="form.accent_color = c"></button>
              <label class="ed-swatch ed-swatch--custom" :class="{ on: !COLOR_PRESETS.includes(accent.toLowerCase()) }" :style="{ '--sw': accent }" :title="t('editProfile.customColor')">
                <input v-model="form.accent_color" type="color" :aria-label="t('editProfile.customColor')" />
              </label>
              <input v-model="form.accent_color" type="text" maxlength="7" class="ed-input ed-hex" spellcheck="false" aria-label="HEX" />
            </div>
          </section>

          <!-- links -->
          <section class="ed-card">
            <h2 class="ed-h">{{ t('editProfile.linksTitle') }}</h2>
            <p class="ed-hint">{{ t('editProfile.linksHint') }}</p>
            <div class="ed-links">
              <label v-for="p in SOCIAL_PLATFORMS" :key="p.key" class="ed-prefixed ed-link" :style="{ '--brand': p.color }">
                <span class="ed-link__brand">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="p.icon" /></svg>
                  <span class="sr-only">{{ p.label }}</span>
                </span>
                <input v-model="form.social_links[p.key]" type="url" maxlength="200" class="ed-input ed-input--bare" :placeholder="p.placeholder" :aria-label="p.label" />
              </label>
            </div>
          </section>

          <!-- privacy -->
          <section class="ed-card">
            <h2 class="ed-h">{{ t('editProfile.privacyTitle') }}</h2>
            <div class="ed-toggles">
              <label class="ed-toggle">
                <span><b>{{ t('editProfile.publicProfile') }}</b><span>{{ t('editProfile.publicProfileDesc') }}</span></span>
                <input v-model="form.is_public" type="checkbox" class="ed-switch" />
              </label>
              <label class="ed-toggle">
                <span><b>{{ t('editProfile.followersList') }}</b><span>{{ t('editProfile.followersListDesc') }}</span></span>
                <input v-model="form.allow_followers_list_public" type="checkbox" class="ed-switch" />
              </label>
              <label class="ed-toggle">
                <span><b>{{ t('editProfile.friendsList') }}</b><span>{{ t('editProfile.friendsListDesc') }}</span></span>
                <input v-model="form.allow_friends_list_public" type="checkbox" class="ed-switch" />
              </label>
            </div>
          </section>
        </div>

        <!-- live preview -->
        <aside class="ed-aside">
          <div class="ed-sticky">
            <p class="ed-aside__label">{{ t('editProfile.previewTitle') }}</p>
            <div class="pv" :style="[previewVars, backgroundUrl ? { '--pv-bg': `url(${backgroundUrl})` } : null]">
              <div class="pv-banner" :style="bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : null"></div>
              <div class="pv-id">
                <div class="pv-avatar">
                  <img v-if="avatarUrl" :src="avatarUrl" alt="" />
                  <span v-else>{{ previewName.slice(0, 1).toUpperCase() }}</span>
                </div>
                <span class="pv-follow">+ {{ t('publicProfile.follow') }}</span>
              </div>
              <div class="pv-body">
                <p class="pv-name">{{ previewName }}</p>
                <p class="pv-slug">@{{ slugClean || savedSlug }}</p>
                <p v-if="form.status_text.trim()" class="pv-status">{{ form.status_text }}</p>
                <div v-if="previewLinks.length" class="pv-links">
                  <span v-for="p in previewLinks" :key="p.key" class="pv-link" :style="{ '--brand': p.color }">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="p.icon" /></svg>{{ p.label }}
                  </span>
                </div>
                <p v-if="form.bio.trim()" class="pv-bio">{{ form.bio }}</p>
                <div class="pv-bar"><span></span></div>
              </div>
              <p v-if="!form.is_public" class="pv-private">{{ t('editProfile.previewPrivate') }}</p>
            </div>

            <div v-if="missing.length" class="ed-missing">
              <p class="ed-label">{{ t('editProfile.missingTitle') }}</p>
              <ul>
                <li v-for="m in missing" :key="m">{{ t(`editProfile.missing.${m}`) }}</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- save bar: only when something changed -->
    <Transition name="ed-bar">
      <div v-if="dirty" class="ed-savebar" role="region" :aria-label="t('editProfile.unsaved')">
        <div class="ed-savebar__inner">
          <span class="ed-savebar__text">{{ slugError ? t('editProfile.slugFix') : t('editProfile.unsaved') }}</span>
          <button type="button" class="ed-btn ed-btn--sm" :disabled="saving" @click="discard">{{ t('editProfile.discard') }}</button>
          <button type="button" class="ed-btn ed-btn--sm ed-btn--primary" :disabled="!canSave" @click="save">
            <span v-if="saving" class="spinner"></span>
            {{ saving ? t('editProfile.saving') : t('editProfile.save') }}
          </button>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.ed-page { padding-block: 24px 120px; }
.ed {
  --e-surface: rgba(19, 16, 33, 0.8);
  --e-line: rgba(255, 255, 255, 0.08);
  --e-line-2: rgba(255, 255, 255, 0.14);
  --e-text: #eeecf7;
  --e-muted: #9d99b6;
  --e-accent: #8b5cf6;
  --e-accent-2: #a78bfa;
  color: var(--e-text);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ed-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.ed-title { margin: 0; font-size: clamp(1.7rem, 1.2rem + 1.2vw, 2.3rem); font-weight: 900; letter-spacing: -0.02em; line-height: 1.1; }
.ed-sub { margin: 6px 0 0; max-width: 60ch; font-size: 0.98rem; line-height: 1.5; color: var(--e-muted); }

.ed-grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; }
.ed-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.ed-skel { height: 420px; border-radius: 20px; }
.ed-skel--tall { height: 760px; }

.ed-card { border-radius: 20px; border: 1px solid var(--e-line); background: var(--e-surface); padding: 22px 24px; backdrop-filter: blur(18px); min-width: 0; }
.ed-h { margin: 0; font-size: 1.12rem; font-weight: 800; letter-spacing: -0.01em; }
.ed-hint { margin: 4px 0 0; font-size: 0.86rem; line-height: 1.45; color: var(--e-muted); }
.ed-label { margin: 0; font-size: 0.92rem; font-weight: 700; color: var(--e-text); }
.ed-optional { margin-left: 6px; font-size: 0.76rem; font-weight: 700; color: var(--e-muted); padding: 2px 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); }
.ed-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.ed-ico { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }

.ed-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 42px; padding: 0 16px; border-radius: 12px;
  font: inherit; font-size: 0.92rem; font-weight: 700; color: var(--e-text); text-decoration: none; white-space: nowrap;
  background: rgba(255, 255, 255, 0.06); border: 1px solid var(--e-line-2); cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.ed-btn:hover { background: rgba(255, 255, 255, 0.1); }
.ed-btn:disabled { opacity: 0.55; cursor: default; }
.ed-btn--sm { height: 36px; padding: 0 14px; font-size: 0.86rem; border-radius: 10px; }
.ed-btn--primary { color: #fff; background: var(--e-accent); border-color: transparent; box-shadow: 0 10px 28px -12px rgba(139, 92, 246, 0.8); }
.ed-btn--primary:hover { background: #7c4dff; }
.ed-btn--danger { color: #fca5a5; border-color: rgba(248, 113, 113, 0.3); background: transparent; }
.ed-btn--danger:hover { background: rgba(248, 113, 113, 0.1); }
.ed-btn:focus-visible, .ed-chipbtn:focus-visible, .ed-avatar:focus-visible, .ed-swatch:focus-visible, .ed-swatch:focus-within { outline: 2px solid var(--e-accent-2); outline-offset: 2px; }

/* cover + avatar */
.ed-cover {
  position: relative; margin-top: 16px; aspect-ratio: 4 / 1; min-height: 140px; border-radius: 16px; overflow: hidden;
  background-size: cover; background-position: center; border: 1px solid var(--e-line);
}
.ed-cover--empty { background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.025) 0 12px, transparent 12px 24px), rgba(0, 0, 0, 0.25); border-style: dashed; border-color: var(--e-line-2); }
.ed-cover__hit { position: absolute; inset: 0; width: 100%; border: 0; padding: 0; background: transparent; cursor: pointer; }
.ed-cover__hit:hover { background: rgba(8, 6, 16, 0.18); }
.ed-cover__hit:focus-visible { outline: 2px solid var(--e-accent-2); outline-offset: -4px; }
.ed-cover__actions { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; z-index: 1; }
.ed-cover__empty { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; font-size: 0.9rem; color: var(--e-muted); pointer-events: none; }
.ed-chipbtn {
  display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 13px; border-radius: 10px;
  font: inherit; font-size: 0.86rem; font-weight: 700; color: #fff; cursor: pointer;
  background: rgba(10, 8, 18, 0.72); border: 1px solid rgba(255, 255, 255, 0.18); backdrop-filter: blur(8px);
}
.ed-chipbtn:hover { background: rgba(10, 8, 18, 0.88); }
.ed-chipbtn--icon { width: 36px; padding: 0; justify-content: center; }
.ed-chipbtn:disabled { opacity: 0.6; cursor: default; }

.ed-under { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 18px; align-items: start; padding: 0 8px; }
.ed-avatar {
  position: relative; width: 116px; height: 116px; margin-top: -48px; border-radius: 24px; overflow: hidden; padding: 0; cursor: pointer;
  display: grid; place-items: center; background: #1a1530; border: 4px solid #15122a;
  box-shadow: 0 0 0 1px var(--e-line-2), 0 16px 32px rgba(0, 0, 0, 0.45);
}
.ed-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ed-avatar__plus { font-size: 2.4rem; font-weight: 300; color: var(--e-muted); }
.ed-avatar__overlay { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; background: rgba(8, 6, 16, 0.55); opacity: 0; transition: opacity 0.15s; }
.ed-avatar:hover .ed-avatar__overlay, .ed-avatar:focus-visible .ed-avatar__overlay, .ed-avatar:disabled .ed-avatar__overlay { opacity: 1; }
.ed-avatar .ed-ico { width: 26px; height: 26px; }
.ed-under__text { padding-top: 12px; min-width: 0; }
.ed-under__cover { margin-top: 12px; text-align: right; max-width: 220px; }

.ed-bg { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; gap: 16px; align-items: center; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--e-line); }
.ed-bg__thumb { width: 112px; aspect-ratio: 16 / 10; border-radius: 10px; background-size: cover; background-position: center; border: 1px solid var(--e-line-2); display: grid; place-items: center; font-size: 0.78rem; color: var(--e-muted); background-color: rgba(0, 0, 0, 0.25); }
.ed-bg .ed-row { margin-top: 0; }

/* fields */
.ed-fields { display: grid; gap: 16px; margin-top: 16px; }
.ed-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.ed-field__top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.ed-count { font-size: 0.78rem; color: var(--e-muted); font-variant-numeric: tabular-nums; }
.ed-input {
  width: 100%; height: 44px; padding: 0 14px; border-radius: 12px;
  font: inherit; font-size: 0.95rem; color: var(--e-text);
  background: rgba(0, 0, 0, 0.28); border: 1px solid var(--e-line-2); outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ed-input::placeholder { color: rgba(157, 153, 182, 0.6); }
.ed-input:focus { border-color: rgba(167, 139, 250, 0.7); box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2); }
.ed-textarea { height: auto; padding: 12px 14px; line-height: 1.55; resize: vertical; min-height: 110px; }
.ed-prefixed { display: flex; align-items: center; height: 44px; border-radius: 12px; background: rgba(0, 0, 0, 0.28); border: 1px solid var(--e-line-2); overflow: hidden; transition: border-color 0.15s, box-shadow 0.15s; }
.ed-prefixed:focus-within { border-color: rgba(167, 139, 250, 0.7); box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2); }
.ed-prefixed--err, .ed-prefixed--err:focus-within { border-color: rgba(248, 113, 113, 0.6); box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.15); }
.ed-prefix { padding: 0 2px 0 14px; font-size: 0.95rem; color: var(--e-muted); white-space: nowrap; }
.ed-input--bare { height: 100%; border: 0; background: transparent; padding-left: 2px; box-shadow: none !important; }
.ed-err { font-size: 0.84rem; color: #fca5a5; }
.ed-warn { font-size: 0.84rem; color: #fde68a; }

/* colour */
.ed-swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 16px; }
.ed-swatch {
  position: relative; width: 38px; height: 38px; border-radius: 999px; padding: 0; cursor: pointer;
  background: var(--sw); border: 2px solid rgba(255, 255, 255, 0.12);
  transition: transform 0.12s;
}
.ed-swatch:hover { transform: scale(1.08); }
.ed-swatch.on { box-shadow: 0 0 0 3px #15122a, 0 0 0 5px var(--sw); }
.ed-swatch--custom { background: conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #ec4899, #ef4444); }
.ed-swatch--custom.on { background: var(--sw); }
.ed-swatch--custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
.ed-hex { width: 110px; height: 38px; font-variant-numeric: tabular-nums; text-transform: lowercase; }

/* links */
.ed-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
.ed-link__brand { flex: none; width: 44px; height: 100%; display: grid; place-items: center; border-right: 1px solid var(--e-line); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.ed-link__brand svg { width: 18px; height: 18px; fill: var(--brand); }
.ed-link .ed-input--bare { padding-left: 12px; }

/* privacy */
.ed-toggles { display: flex; flex-direction: column; margin-top: 8px; }
.ed-toggle { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--e-line); cursor: pointer; }
.ed-toggle:first-child { border-top: 0; }
.ed-toggle > span { display: flex; flex-direction: column; gap: 3px; }
.ed-toggle b { font-size: 0.95rem; }
.ed-toggle > span > span { font-size: 0.86rem; color: var(--e-muted); line-height: 1.4; }
.ed-switch {
  appearance: none; flex: none; position: relative; width: 46px; height: 26px; border-radius: 999px; cursor: pointer;
  background: rgba(255, 255, 255, 0.12); border: 1px solid var(--e-line-2); transition: background-color 0.15s;
}
.ed-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 999px; background: #cbc7dd; transition: transform 0.15s, background-color 0.15s; }
.ed-switch:checked { background: var(--e-accent); border-color: transparent; }
.ed-switch:checked::after { transform: translateX(20px); background: #fff; }
.ed-switch:focus-visible { outline: 2px solid var(--e-accent-2); outline-offset: 2px; }

/* preview */
.ed-aside { min-width: 0; }
.ed-sticky { position: sticky; top: 100px; display: flex; flex-direction: column; gap: 12px; }
.ed-aside__label { margin: 0; font-size: 0.88rem; font-weight: 700; color: var(--e-muted); }
.pv {
  position: relative; border-radius: 20px; overflow: hidden; border: 1px solid var(--e-line);
  background: linear-gradient(180deg, rgba(10, 8, 18, 0.72), rgba(10, 8, 18, 0.94)), var(--pv-bg, none) center / cover, #0f0c1c;
  box-shadow: 0 24px 60px -30px var(--pv-accent-glow);
}
.pv-banner { aspect-ratio: 3 / 1; background: radial-gradient(120% 140% at 0% 0%, var(--pv-accent-line), transparent 60%), linear-gradient(135deg, #1a1530, #0d0b17); background-size: cover; background-position: center; }
.pv-id { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; padding: 0 16px; margin-top: -34px; }
.pv-avatar { width: 72px; height: 72px; border-radius: 18px; overflow: hidden; display: grid; place-items: center; background: #1a1530; border: 3px solid #15122a; box-shadow: 0 0 0 1px var(--pv-accent-line); font-size: 1.8rem; font-weight: 900; color: var(--pv-accent-ui); }
.pv-avatar img { width: 100%; height: 100%; object-fit: cover; }
.pv-follow { font-size: 0.8rem; font-weight: 700; padding: 7px 12px; border-radius: 9px; color: var(--pv-on-accent); background: var(--pv-accent); }
.pv-body { padding: 10px 16px 18px; }
.pv-name { margin: 0; font-size: 1.35rem; font-weight: 900; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.pv-slug { margin: 2px 0 0; font-size: 0.84rem; color: var(--e-muted); }
.pv-status { margin: 8px 0 0; font-size: 0.9rem; color: #d6d2ea; overflow-wrap: anywhere; }
.pv-links { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.pv-link { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px 0 7px; border-radius: 7px; font-size: 0.76rem; font-weight: 700; border: 1px solid color-mix(in srgb, var(--brand) 40%, transparent); background: color-mix(in srgb, var(--brand) 12%, transparent); }
.pv-link svg { width: 13px; height: 13px; fill: var(--brand); }
.pv-bio { margin: 12px 0 0; font-size: 0.86rem; line-height: 1.5; color: #cfcbe3; white-space: pre-line; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.pv-bar { margin-top: 14px; height: 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.pv-bar span { display: block; width: 38%; height: 100%; border-radius: inherit; background: var(--pv-accent-ui); }
.pv-private { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 20px; text-align: center; font-weight: 700; background: rgba(8, 6, 16, 0.78); backdrop-filter: blur(2px); }
.ed-missing { padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(242, 193, 78, 0.25); background: rgba(242, 193, 78, 0.06); }
.ed-missing ul { margin: 6px 0 0; padding-left: 18px; font-size: 0.86rem; line-height: 1.55; color: #e9dcb4; }

/* save bar */
.ed-savebar { position: fixed; left: 0; right: 0; bottom: 20px; z-index: 40; display: flex; justify-content: center; padding: 0 12px; pointer-events: none; }
.ed-savebar__inner {
  pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 18px; border-radius: 16px;
  background: rgba(22, 18, 40, 0.94); border: 1px solid rgba(167, 139, 250, 0.35); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); backdrop-filter: blur(14px);
}
.ed-savebar__text { font-size: 0.92rem; font-weight: 600; margin-right: 8px; }
.ed-bar-enter-active, .ed-bar-leave-active { transition: opacity 0.2s, transform 0.2s; }
.ed-bar-enter-from, .ed-bar-leave-to { opacity: 0; transform: translateY(16px); }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 1100px) {
  .ed-grid { grid-template-columns: minmax(0, 1fr); }
  .ed-aside { order: -1; }
  .ed-sticky { position: static; }
  .pv { max-width: 460px; }
}
@media (max-width: 640px) {
  .ed-page { padding-block: 12px 110px; }
  .ed-card { padding: 18px; }
  .ed-cover { aspect-ratio: 16 / 7; }
  .ed-under { grid-template-columns: auto minmax(0, 1fr); padding: 0; gap: 14px; }
  .ed-avatar { width: 92px; height: 92px; margin-top: -36px; }
  .ed-under__cover { grid-column: 1 / -1; text-align: left; max-width: none; margin-top: 0; }
  .ed-bg { grid-template-columns: 88px minmax(0, 1fr); }
  .ed-bg__thumb { width: 88px; }
  .ed-bg .ed-row { grid-column: 1 / -1; }
  .ed-links { grid-template-columns: minmax(0, 1fr); }
  .ed-prefix { font-size: 0.85rem; padding-left: 12px; }
  .ed-savebar { bottom: 12px; }
  .ed-savebar__inner { width: 100%; }
  .ed-savebar__text { flex: 1; font-size: 0.85rem; }
}
@media (prefers-reduced-motion: reduce) {
  .ed-bar-enter-active, .ed-bar-leave-active, .ed-swatch, .ed-switch, .ed-switch::after { transition: none; }
}
</style>
