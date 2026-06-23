<script setup>
const tabs = [
  { to: '/profile', label: 'Кабинет' },
  { to: '/profile/public', label: 'Оформление профиля' },
  { to: '/profile/referrals', label: 'Рефералы' },
  { to: '/profile/social', label: 'Друзья' },
]
</script>

<template>
  <nav class="account-tabs">
    <RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to" class="tab-link">
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>
