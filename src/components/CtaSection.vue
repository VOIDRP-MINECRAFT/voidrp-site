<script setup>
import { siteConfig } from '../config.site'
</script>

<template>
  <section class="py-4 md:py-5">
    <div class="container-shell">
      <div class="cta-card">
        <div class="cta-card__left">
          <p class="cta-eyebrow">Готово к старту</p>
          <h2 class="cta-title">Создай аккаунт и переходи к игре</h2>
          <p class="cta-desc">Регистрация, письмо, лаунчер и запуск — один короткий понятный путь.</p>
        </div>
        <div class="cta-card__actions">
          <RouterLink to="/register" class="btn btn-primary">Создать аккаунт</RouterLink>
          <RouterLink to="/download-launcher" class="btn btn-light">Лаунчер</RouterLink>
          <a :href="siteConfig.discordUrl" target="_blank" rel="noreferrer" class="btn btn-outline cta-discord">Discord</a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cta-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 20px;
  background: radial-gradient(ellipse at top left, rgba(139,92,246,.32) 0%, transparent 44%),
    linear-gradient(135deg, rgba(22,28,52,.98), rgba(12,16,30,1));
  padding: 1.5rem 1.75rem;
}

.cta-eyebrow {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: rgba(255,255,255,.45);
  margin: 0 0 .4rem;
}

.cta-title {
  font-size: clamp(1.2rem, 3vw, 1.65rem);
  font-weight: 900;
  color: #fff;
  letter-spacing: -.03em;
  margin: 0 0 .35rem;
}

.cta-desc {
  font-size: .85rem;
  color: rgba(255,255,255,.5);
  margin: 0;
}

.cta-card__actions {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .cta-card__actions {
    width: 100%;
  }
}

.cta-discord {
  border-color: rgba(255,255,255,.16) !important;
  background: rgba(255,255,255,.06) !important;
  color: rgba(255,255,255,.8) !important;
}
</style>
