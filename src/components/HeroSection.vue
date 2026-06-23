<script setup>
import { siteConfig } from '../config.site'
</script>

<template>
  <section class="hs py-5 md:py-7">
    <div class="container-shell">
      <div class="hs-grid">
        <!-- left -->
        <div class="hs-left">
          <p class="hs-eyebrow">{{ siteConfig.hero.badge }}</p>
          <h1 class="hs-title">
            Заходи в VoidRP
            <span class="hs-title__gradient">через официальный сайт</span>
          </h1>
          <p class="hs-desc">{{ siteConfig.hero.description }}</p>

          <div class="hs-actions">
            <RouterLink to="/register" class="btn btn-primary">Создать аккаунт</RouterLink>
            <RouterLink to="/download-launcher" class="btn btn-outline">Скачать лаунчер</RouterLink>
            <a :href="siteConfig.discordUrl" target="_blank" rel="noreferrer" class="btn btn-ghost">Discord</a>
          </div>

          <div class="hs-chips">
            <span class="hs-chip">{{ siteConfig.serverIp }}</span>
            <span class="hs-chip">{{ siteConfig.serverVersion }}</span>

          </div>
        </div>

        <!-- right panel -->
        <div class="hs-panel">
          <div class="hs-panel__header">
            <span class="hs-panel__label">Как начать</span>
            <span class="hs-panel__sub">Три шага до входа</span>
          </div>

          <div class="hs-steps">
            <div class="hs-step">
              <span class="hs-step__num">1</span>
              <div>
                <strong>Аккаунт</strong>
                <small>Регистрируешься и подтверждаешь почту</small>
              </div>
            </div>
            <div class="hs-step">
              <span class="hs-step__num">2</span>
              <div>
                <strong>Лаунчер</strong>
                <small>Скачиваешь и входишь под тем же аккаунтом</small>
              </div>
            </div>
            <div class="hs-step">
              <span class="hs-step__num">3</span>
              <div>
                <strong>Играть</strong>
                <small>Нажимаешь «Играть» без ручной настройки</small>
              </div>
            </div>
          </div>

          <div class="hs-panel__reasons">
            <div class="hs-reason">
              <span class="hs-reason__dot sky"></span>
              <span>Не нужно искать модпак и инструкции</span>
            </div>
            <div class="hs-reason">
              <span class="hs-reason__dot green"></span>
              <span>Кабинет, карта, профиль — всё в одном месте</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hs-grid {
  display: grid;
  gap: 1.5rem;
  align-items: center;
}

@media (min-width: 1100px) {
  .hs-grid { grid-template-columns: 1fr 420px; gap: 2rem; }
}

.hs-eyebrow {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: rgb(139 92 246);
  margin: 0 0 .85rem;
}

.hs-title {
  font-size: clamp(2rem, 5vw, 3.2rem);
  font-weight: 900;
  letter-spacing: -.05em;
  line-height: .97;
  color: #f8fbff;
  margin: 0 0 .85rem;
}

.hs-title__gradient {
  display: block;
  margin-top: .2rem;
  background: linear-gradient(90deg, #fff 0%, #d7cbff 40%, #7dd3fc 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hs-desc {
  font-size: .95rem;
  line-height: 1.7;
  color: rgb(148 163 184);
  max-width: 480px;
  margin: 0 0 1.25rem;
}

.hs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-bottom: 1rem;
}

.hs-chips {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
}

.hs-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(255,255,255,.04);
  padding: .3rem .7rem;
  font-size: .75rem;
  font-weight: 700;
  color: rgb(148 163 184);
}

/* panel */
.hs-panel {
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 22px;
  background: radial-gradient(ellipse at top left, rgba(139,92,246,.28) 0%, transparent 40%),
    linear-gradient(135deg, rgba(20,26,50,.98), rgba(12,17,32,1));
  padding: 1.25rem;
}

.hs-panel__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.hs-panel__label {
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: rgba(255,255,255,.5);
}

.hs-panel__sub {
  font-size: .82rem;
  font-weight: 700;
  color: #fff;
}

.hs-steps {
  display: flex;
  flex-direction: column;
  gap: .5rem;
  margin-bottom: 1rem;
}

.hs-step {
  display: flex;
  align-items: center;
  gap: .75rem;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  background: rgba(255,255,255,.04);
  padding: .7rem .85rem;
}

.hs-step__num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(134,239,172,.2);
  background: rgba(134,239,172,.08);
  font-size: .78rem;
  font-weight: 900;
  color: rgb(134 239 172);
  flex-shrink: 0;
}

.hs-step strong {
  display: block;
  font-size: .88rem;
  font-weight: 800;
  color: #f0f4ff;
}

.hs-step small {
  display: block;
  font-size: .75rem;
  color: rgba(255,255,255,.5);
  margin-top: .1rem;
}

.hs-panel__reasons {
  border-top: 1px solid rgba(255,255,255,.07);
  padding-top: .85rem;
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.hs-reason {
  display: flex;
  align-items: center;
  gap: .5rem;
  font-size: .82rem;
  color: rgba(255,255,255,.62);
}

.hs-reason__dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}

.hs-reason__dot.sky   { background: rgb(125 211 252); box-shadow: 0 0 6px rgba(125,211,252,.5); }
.hs-reason__dot.green { background: rgb(134 239 172); box-shadow: 0 0 6px rgba(134,239,172,.5); }
</style>
