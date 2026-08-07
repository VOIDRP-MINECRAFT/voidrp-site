<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const tabs = computed(() => [
  { to: '/profile', label: t('app.tabDashboard') },
  { to: '/profile/public', label: t('app.tabProfileDesign') },
  { to: '/profile/referrals', label: t('app.tabReferrals') },
  { to: '/profile/social', label: t('app.tabFriends') },
])
</script>

<template>
  <nav class="account-tabs">
    <RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to" class="tab-link">
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>
