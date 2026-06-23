<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '../config.site'
import { usePageMeta } from '../composables/usePageMeta.js'

usePageMeta({
  title: 'Скачать лаунчер',
  description: 'Скачай официальный лаунчер VoidRP — автоматическая установка сборки модов, авторизация и запуск Minecraft одной кнопкой.',
  url: 'https://void-rp.ru/download-launcher',
  breadcrumbs: [
    { name: 'Главная', url: '/' },
    { name: 'Скачать лаунчер' },
  ],
})
import { useAuthStore } from '../stores/authStore'

const { t } = useI18n()
const auth = useAuthStore()
const isAuthenticated = computed(() => auth.isAuthenticated.value)
</script>

<template>
  <section class="py-12 md:py-18">
    <div class="container-shell space-y-6">
      <div class="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
        <div class="surface-card p-6 md:p-8 lg:p-10">
          <div class="section-kicker">{{ t('downloadLauncher.kicker') }}</div>
          <h1 class="section-title">{{ t('downloadLauncher.title') }}</h1>
          <p class="section-subtitle">
            {{ t('downloadLauncher.subtitle') }}
          </p>

          <div v-if="isAuthenticated" class="mt-6 rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
            <div class="metric-label">{{ t('downloadLauncher.loggedInAs') }}</div>
            <div class="mt-3 text-2xl font-black tracking-tight text-slate-50">{{ auth.displayName.value }}</div>
            <p class="mt-3 text-sm leading-7 text-slate-300">
              {{ t('downloadLauncher.canDownload') }}
            </p>
            <div v-if="!auth.emailVerified.value" class="alert alert-warn mt-4">
              {{ t('downloadLauncher.emailNotVerified') }}
            </div>
          </div>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              :href="siteConfig.launcherPortableUrl"
              target="_blank"
              rel="noreferrer"
              class="btn btn-primary"
            >
              {{ t('downloadLauncher.download') }}
            </a>
            <RouterLink v-if="!isAuthenticated" to="/register" class="btn btn-outline">{{ t('downloadLauncher.createAccount') }}</RouterLink>
            <RouterLink v-if="!isAuthenticated" to="/login" class="btn btn-outline">{{ t('downloadLauncher.logIn') }}</RouterLink>
            <RouterLink v-if="isAuthenticated" to="/profile" class="btn btn-outline">{{ t('downloadLauncher.openDashboard') }}</RouterLink>
            <RouterLink v-if="isAuthenticated && !auth.emailVerified.value" to="/verify-email" class="btn btn-outline">
              {{ t('downloadLauncher.verifyEmail') }}
            </RouterLink>
          </div>

          <p v-if="!isAuthenticated" class="mt-4 text-sm leading-6 text-slate-500">
            {{ t('downloadLauncher.needAccount') }}
            <RouterLink to="/register" class="text-violet-400 hover:text-violet-300">{{ t('downloadLauncher.registerFree') }}</RouterLink>
          </p>
        </div>

        <div class="gradient-panel p-6 md:p-8 lg:p-10">
          <div class="section-kicker section-kicker--light">{{ t('downloadLauncher.nextKicker') }}</div>
          <h2 class="text-3xl font-black tracking-tight text-white md:text-4xl">{{ t('downloadLauncher.nextTitle') }}</h2>

          <div class="mt-6 grid gap-3">
            <div class="dark-list-card">
              <p class="text-sm font-black text-white">{{ t('downloadLauncher.step1title') }}</p>
              <p class="mt-2 text-sm leading-7 text-white/78">{{ t('downloadLauncher.step1desc') }}</p>
            </div>
            <div class="dark-list-card">
              <p class="text-sm font-black text-white">{{ t('downloadLauncher.step2title') }}</p>
              <p class="mt-2 text-sm leading-7 text-white/78">{{ t('downloadLauncher.step2desc') }}</p>
            </div>
            <div class="dark-list-card">
              <p class="text-sm font-black text-white">{{ t('downloadLauncher.step3title') }}</p>
              <p class="mt-2 text-sm leading-7 text-white/78">{{ t('downloadLauncher.step3desc') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
