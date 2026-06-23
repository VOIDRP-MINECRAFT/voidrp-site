<script setup>
import {computed, onMounted, reactive, ref, watch} from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ProfileMediaSlotCard from '../features/profile/components/ProfileMediaSlotCard.vue'
import PublicProfileStudioPreview from '../features/profile/components/PublicProfileStudioPreview.vue'
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

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const profile = ref(null)

const selectedFiles = reactive({
  avatar: null,
  banner: null,
  background: null,
})

const uploading = reactive({
  avatar: false,
  banner: false,
  background: false,
})

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
})

const colorPresets = ['#8b5cf6', '#7c3aed', '#3b82f6', '#14b8a6', '#ef4444', '#f59e0b', '#ec4899']

const selectedFileNames = computed(() => ({
  avatar: selectedFiles.avatar?.name || '',
  banner: selectedFiles.banner?.name || '',
  background: selectedFiles.background?.name || '',
}))

const publicSlug = computed(() => form.slug?.trim() || profile.value?.slug || '')
const publicProfileUrl = computed(() => {
  if (!publicSlug.value || typeof window === 'undefined') return ''
  return `${window.location.origin}/u/${publicSlug.value}`
})

const completionItems = computed(() => {
  const assets = profile.value?.assets || {}
  return [
    { key: 'slug', label: t('editProfile.completionSlug'), ready: Boolean(form.slug?.trim()), missingText: t('editProfile.missingSlug') },
    { key: 'display_name', label: t('editProfile.completionName'), ready: Boolean(form.display_name?.trim()), missingText: t('editProfile.missingName') },
    { key: 'status_text', label: t('editProfile.completionStatus'), ready: Boolean(form.status_text?.trim()), missingText: t('editProfile.missingStatus') },
    { key: 'bio', label: t('editProfile.completionBio'), ready: Boolean(form.bio?.trim()), missingText: t('editProfile.missingBio') },
    { key: 'avatar', label: t('editProfile.completionAvatar'), ready: Boolean(assets.avatar_url || assets.avatar_preview_url), missingText: t('editProfile.missingAvatar') },
    { key: 'banner', label: t('editProfile.completionBanner'), ready: Boolean(assets.banner_url || assets.banner_preview_url), missingText: t('editProfile.missingBanner') },
    { key: 'background', label: t('editProfile.completionBg'), ready: Boolean(assets.background_url || assets.background_preview_url), missingText: t('editProfile.missingBg'), optional: true },
  ]
})

const completion = computed(() => {
  const done = completionItems.value.filter((item) => item.ready).length
  return Math.round((done / completionItems.value.length) * 100)
})

const requiredMissingItems = computed(() => completionItems.value.filter((item) => !item.ready && !item.optional))
const showCompletionHints = computed(() => requiredMissingItems.value.length > 0)
const showCompletionPanel = computed(() => completion.value < 100)

function hydrateForm(payload) {
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
}

async function loadProfile() {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await getMyPublicProfile(authStore.accessToken)
    hydrateForm(payload)
  } catch (err) {
    error.value = err.message || 'Не удалось загрузить публичный профиль.'
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  saving.value = true
  error.value = ''
  success.value = ''

  try {
    const payload = await updateMyPublicProfile(authStore.accessToken, {
      slug: form.slug?.trim() || null,
      display_name: form.display_name?.trim() || null,
      bio: form.bio?.trim() || null,
      status_text: form.status_text?.trim() || null,
      theme_mode: form.theme_mode || 'default',
      accent_color: form.accent_color?.trim() || null,
      is_public: form.is_public,
      allow_followers_list_public: form.allow_followers_list_public,
      allow_friends_list_public: form.allow_friends_list_public,
    })

    hydrateForm(payload)
    success.value = t('editProfile.saved')
  } catch (err) {
    error.value = err.message || 'Не удалось сохранить профиль.'
  } finally {
    saving.value = false
  }
}

function onFileSelected(slot, file) {
  selectedFiles[slot] = file || null
}

async function uploadSelected(slot) {
  const file = selectedFiles[slot]
  if (!file) return

  uploading[slot] = true
  error.value = ''
  success.value = ''

  try {
    let payload = null
    if (slot === 'avatar') payload = await uploadAvatar(authStore.accessToken, file)
    if (slot === 'banner') payload = await uploadBanner(authStore.accessToken, file)
    if (slot === 'background') payload = await uploadBackground(authStore.accessToken, file)

    selectedFiles[slot] = null
    if (payload) hydrateForm(payload)
    else await loadProfile()

    success.value = t('editProfile.imageSaved')
  } catch (err) {
    error.value = err.message || 'Не удалось загрузить изображение.'
  } finally {
    uploading[slot] = false
  }
}

async function removeAsset(slot) {
  uploading[slot] = true
  error.value = ''
  success.value = ''

  try {
    let payload = null
    if (slot === 'avatar') payload = await deleteAvatar(authStore.accessToken)
    if (slot === 'banner') payload = await deleteBanner(authStore.accessToken)
    if (slot === 'background') payload = await deleteBackground(authStore.accessToken)

    selectedFiles[slot] = null
    if (payload) hydrateForm(payload)
    else await loadProfile()

    success.value = t('editProfile.imageRemoved')
  } catch (err) {
    error.value = err.message || 'Не удалось удалить изображение.'
  } finally {
    uploading[slot] = false
  }
}

async function copyPublicLink() {
  if (!publicProfileUrl.value) return

  try {
    await navigator.clipboard.writeText(publicProfileUrl.value)
    success.value = t('editProfile.linkCopied')
    error.value = ''
  } catch {
    error.value = 'Не удалось скопировать ссылку.'
  }
}

onMounted(loadProfile)
watch(error, (value) => { if (value) toastError(value) })
watch(success, (value) => { if (value) toastSuccess(value) })
</script>

<template>
  <section class="py-8 md:py-10">
    <div class="container-shell">
      <div v-if="loading" class="space-y-5">
        <div class="skeleton h-28 rounded-[28px]"></div>
        <div class="grid gap-5 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
          <div class="skeleton h-[540px] rounded-[28px]"></div>
          <div class="space-y-5">
            <div class="skeleton h-[260px] rounded-[28px]"></div>
            <div class="skeleton h-[560px] rounded-[28px]"></div>
          </div>
        </div>
      </div>

      <div v-else class="space-y-5">
        <section class="surface-card px-5 py-5 md:px-7 md:py-6">
          <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div class="max-w-3xl">
              <div class="section-kicker !mb-2">{{ t('editProfile.kicker') }}</div>
              <h1 class="text-2xl font-black tracking-tight text-slate-50 md:text-3xl">
                {{ t('editProfile.title') }}
              </h1>
              <p class="mt-2 text-sm leading-6 text-slate-400 md:text-[15px]">
                {{ t('editProfile.subtitle') }}
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <RouterLink to="/profile" class="btn btn-outline rounded-2xl">{{ t('editProfile.dashboard') }}</RouterLink>
              <button v-if="publicProfileUrl" type="button" class="btn btn-outline rounded-2xl" @click="copyPublicLink">{{ t('editProfile.copyLink') }}</button>
              <button type="button" class="btn btn-primary rounded-2xl" :disabled="saving" @click="saveProfile">
                <span v-if="saving" class="spinner"></span>
                <span v-else>{{ t('editProfile.save') }}</span>
              </button>
            </div>
          </div>

          <div v-if="showCompletionPanel" class="mt-5 rounded-[20px] border border-white/10 bg-black/20 px-4 py-4">
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-semibold text-slate-200">{{ t('editProfile.completionTitle') }}</span>
              <span class="text-sm font-bold text-slate-300">{{ completion }}%</span>
            </div>
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div class="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 transition-all" :style="{ width: `${completion}%` }"></div>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div
                v-for="item in completionItems"
                :key="item.key"
                class="rounded-[18px] border px-4 py-3 text-sm"
                :class="item.ready ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-slate-950/50 text-slate-300'"
              >
                <p class="font-semibold">{{ item.label }}</p>
                <p class="mt-1 text-xs uppercase tracking-[0.14em]">
                  {{ item.ready ? t('editProfile.statusReady') : item.optional ? t('editProfile.statusOptional') : t('editProfile.statusMissing') }}
                </p>
              </div>
            </div>

            <div v-if="showCompletionHints" class="mt-4 rounded-[18px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <p class="font-semibold">{{ t('editProfile.hintsTitle') }}</p>
              <ul class="mt-2 list-disc space-y-1 pl-5">
                <li v-for="item in requiredMissingItems" :key="`missing-${item.key}`">{{ item.missingText }}</li>
              </ul>
            </div>
          </div>

        </section>

        <div class="grid gap-5 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
          <aside class="space-y-5">
            <section class="surface-card p-5 md:p-6">
              <div class="section-kicker !mb-2">{{ t('editProfile.previewKicker') }}</div>
              <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('editProfile.previewTitle') }}</h2>
              <p class="mt-2 text-sm leading-6 text-slate-400">
                {{ t('editProfile.previewDesc') }}
              </p>

              <div class="mt-5">
                <PublicProfileStudioPreview :profile="profile" :form="form" :public-profile-url="publicProfileUrl" />
              </div>
            </section>

            <section class="surface-card p-5 md:p-6">
              <div class="section-kicker !mb-2">{{ t('editProfile.accentKicker') }}</div>
              <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('editProfile.accentTitle') }}</h2>

              <div class="mt-5 rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div class="flex items-center gap-4">
                  <input v-model="form.accent_color" type="color" class="h-14 w-16 cursor-pointer rounded-2xl border border-white/10 bg-transparent p-1" />
                  <input v-model="form.accent_color" type="text" class="input h-14 flex-1 rounded-2xl" placeholder="#8b5cf6" />
                </div>

                <div class="mt-4 flex flex-wrap gap-3">
                  <button
                    v-for="color in colorPresets"
                    :key="color"
                    type="button"
                    class="h-10 w-10 rounded-full border border-white/10 shadow-sm transition hover:scale-105"
                    :style="{ backgroundColor: color }"
                    @click="form.accent_color = color"
                  ></button>
                </div>
              </div>
            </section>
          </aside>

          <div class="space-y-5">
            <section class="surface-card p-5 md:p-6">
              <div class="section-kicker !mb-2">{{ t('editProfile.mediaKicker') }}</div>
              <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('editProfile.mediaTitle') }}</h2>

              <div class="mt-5 space-y-4">
                <ProfileMediaSlotCard
                  :title="t('editProfile.bannerTitle')"
                  :subtitle="t('editProfile.bannerSubtitle')"
                  slot-name="banner"
                  variant="banner"
                  :preview-url="profile?.assets?.banner_url || profile?.assets?.banner_preview_url || ''"
                  :selected-file-name="selectedFileNames.banner"
                  :uploading="uploading.banner"
                  :has-asset="Boolean(profile?.assets?.banner_url || profile?.assets?.banner_preview_url)"
                  :recommendation="t('editProfile.bannerRec')"
                  @select-file="onFileSelected('banner', $event)"
                  @upload="uploadSelected('banner')"
                  @remove="removeAsset('banner')"
                />

                <ProfileMediaSlotCard
                  :title="t('editProfile.avatarTitle')"
                  :subtitle="t('editProfile.avatarSubtitle')"
                  slot-name="avatar"
                  variant="avatar"
                  :preview-url="profile?.assets?.avatar_url || profile?.assets?.avatar_preview_url || ''"
                  :selected-file-name="selectedFileNames.avatar"
                  :uploading="uploading.avatar"
                  :has-asset="Boolean(profile?.assets?.avatar_url || profile?.assets?.avatar_preview_url)"
                  :recommendation="t('editProfile.avatarRec')"
                  @select-file="onFileSelected('avatar', $event)"
                  @upload="uploadSelected('avatar')"
                  @remove="removeAsset('avatar')"
                />

                <ProfileMediaSlotCard
                  :title="t('editProfile.bgTitle')"
                  :subtitle="t('editProfile.bgSubtitle')"
                  slot-name="background"
                  variant="background"
                  :preview-url="profile?.assets?.background_url || profile?.assets?.background_preview_url || ''"
                  :selected-file-name="selectedFileNames.background"
                  :uploading="uploading.background"
                  :has-asset="Boolean(profile?.assets?.background_url || profile?.assets?.background_preview_url)"
                  :recommendation="t('editProfile.bgRec')"
                  @select-file="onFileSelected('background', $event)"
                  @upload="uploadSelected('background')"
                  @remove="removeAsset('background')"
                />
              </div>
            </section>

            <section class="surface-card p-5 md:p-6">
              <div class="section-kicker !mb-2">{{ t('editProfile.textKicker') }}</div>
              <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('editProfile.textTitle') }}</h2>

              <div class="mt-5 grid gap-4">
                <label class="form-control">
                  <span class="mb-2 text-sm font-semibold text-slate-300">{{ t('editProfile.displayNameLabel') }}</span>
                  <input v-model="form.display_name" type="text" maxlength="32" class="input rounded-2xl" placeholder="mironoouv" />
                </label>

                <label class="form-control">
                  <span class="mb-2 text-sm font-semibold text-slate-300">{{ t('editProfile.slugLabel') }}</span>
                  <input v-model="form.slug" type="text" maxlength="32" class="input rounded-2xl" placeholder="mironoouv" />
                </label>

                <label class="form-control">
                  <span class="mb-2 text-sm font-semibold text-slate-300">{{ t('editProfile.statusLabel') }}</span>
                  <input v-model="form.status_text" type="text" maxlength="120" class="input rounded-2xl" :placeholder="t('editProfile.statusPlaceholder')" />
                </label>

                <label class="form-control">
                  <span class="mb-2 text-sm font-semibold text-slate-300">{{ t('editProfile.bioLabel') }}</span>
                  <textarea v-model="form.bio" rows="5" maxlength="1200" class="textarea rounded-2xl" :placeholder="t('editProfile.bioPlaceholder')"></textarea>
                </label>
              </div>
            </section>

            <section class="surface-card p-5 md:p-6">
              <div class="section-kicker !mb-2">{{ t('editProfile.privacyKicker') }}</div>
              <h2 class="text-xl font-black text-slate-50 md:text-2xl">{{ t('editProfile.privacyTitle') }}</h2>

              <div class="mt-5 grid gap-4">
                <label class="panel-card flex items-center justify-between gap-4 p-4">
                  <div>
                    <p class="font-semibold text-slate-100">{{ t('editProfile.publicProfile') }}</p>
                    <p class="mt-1 text-sm leading-6 text-slate-400">{{ t('editProfile.publicProfileDesc') }}</p>
                  </div>
                  <input v-model="form.is_public" type="checkbox" class="toggle" />
                </label>

                <label class="panel-card flex items-center justify-between gap-4 p-4">
                  <div>
                    <p class="font-semibold text-slate-100">{{ t('editProfile.followersList') }}</p>
                    <p class="mt-1 text-sm leading-6 text-slate-400">{{ t('editProfile.followersListDesc') }}</p>
                  </div>
                  <input v-model="form.allow_followers_list_public" type="checkbox" class="toggle" />
                </label>

                <label class="panel-card flex items-center justify-between gap-4 p-4">
                  <div>
                    <p class="font-semibold text-slate-100">{{ t('editProfile.friendsList') }}</p>
                    <p class="mt-1 text-sm leading-6 text-slate-400">{{ t('editProfile.friendsListDesc') }}</p>
                  </div>
                  <input v-model="form.allow_friends_list_public" type="checkbox" class="toggle" />
                </label>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>


