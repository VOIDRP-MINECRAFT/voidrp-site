<script setup>
import { useI18n } from 'vue-i18n'
import { usePageMeta } from '../composables/usePageMeta.js'

const { t } = useI18n()

usePageMeta({
  title: t('notFound.title'),
  description: t('notFound.subtitle'),
  url: 'https://void-rp.ru/404',
})
</script>

<template>
  <section class="py-16 md:py-24">
    <div class="container-shell max-w-3xl">
      <div class="surface-card p-8 text-center md:p-12">
        <div class="section-kicker justify-center">{{ t('notFound.kicker') }}</div>
        <p class="mt-2 text-6xl font-black tracking-tight text-violet-300 md:text-8xl">404</p>
        <h1 class="section-title mt-4">{{ t('notFound.title') }}</h1>
        <p class="section-subtitle mx-auto max-w-xl">{{ t('notFound.subtitle') }}</p>

        <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <RouterLink to="/" class="btn btn-primary">{{ t('notFound.home') }}</RouterLink>
          <RouterLink to="/download-launcher" class="btn btn-outline">{{ t('notFound.download') }}</RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>
