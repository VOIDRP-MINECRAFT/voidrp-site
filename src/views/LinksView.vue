<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { siteConfig } from '../config.site'

const { t } = useI18n()

const links = computed(() => [
  {
    title: t('links.launcherTitle'),
    description: t('links.launcherDesc'),
    internal: '/download-launcher',
    button: t('links.launcherBtn'),
    tag: t('links.launcherTag'),
  },
  {
    title: t('links.mapTitle'),
    description: t('links.mapDesc'),
    url: siteConfig.bluemapUrl,
    button: t('links.mapBtn'),
    tag: t('links.mapTag'),
  },
  {
    title: t('links.discordTitle'),
    description: t('links.discordDesc'),
    url: siteConfig.discordUrl,
    button: t('links.discordBtn'),
    tag: t('links.discordTag'),
  },
  {
    title: t('links.telegramTitle'),
    description: t('links.telegramDesc'),
    url: siteConfig.telegramUrl,
    button: t('links.telegramBtn'),
    tag: t('links.telegramTag'),
  },
  {
    title: t('links.siteTitle'),
    description: t('links.siteDesc'),
    url: siteConfig.siteUrl,
    button: t('links.siteBtn'),
    tag: t('links.siteTag'),
  },
])
</script>

<template>
  <section class="py-5 md:py-6">
    <div class="container-shell space-y-4">
      <section class="surface-card p-4 md:p-5">
        <div class="max-w-3xl">
          <div class="section-kicker !mb-2">{{ t('links.kicker') }}</div>
          <h1 class="text-2xl font-black tracking-tight text-slate-50 md:text-3xl">
            {{ t('links.title') }}
          </h1>
          <p class="mt-3 text-sm leading-6 text-slate-400 md:text-[14px]">
            {{ t('links.desc') }}
          </p>
        </div>
      </section>

      <section class="grid gap-3 page-entry md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="item in links"
          :key="item.title"
          class="surface-card p-4 md:p-5"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="section-kicker !mb-0">{{ item.tag }}</div>
            <div class="footer-chip">{{ t('links.quickLink') }}</div>
          </div>

          <h2 class="mt-3 text-lg font-black tracking-tight text-slate-50 md:text-xl">
            {{ item.title }}
          </h2>
          <p class="mt-2 text-sm leading-6 text-slate-400">
            {{ item.description }}
          </p>

          <RouterLink
            v-if="item.internal"
            :to="item.internal"
            class="btn btn-primary mt-4 w-full sm:w-auto"
          >
            {{ item.button }}
          </RouterLink>

          <a
            v-else
            :href="item.url"
            target="_blank"
            rel="noreferrer"
            class="btn btn-primary mt-4 w-full sm:w-auto"
          >
            {{ item.button }}
          </a>
        </article>
      </section>
    </div>
  </section>
</template>
