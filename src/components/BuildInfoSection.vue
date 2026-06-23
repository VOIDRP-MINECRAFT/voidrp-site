<script setup>
import { siteConfig } from '../config.site'
</script>

<template>
  <section class="py-2 md:py-3">
    <div class="container-shell">
      <div class="bi-grid">
        <div class="bi-strip">
          <div class="bi-item">
            <span>Версия</span>
            <strong>{{ siteConfig.serverVersion }}</strong>
          </div>
          <div class="bi-sep"></div>
          <div class="bi-item">
            <span>Адрес</span>
            <strong>{{ siteConfig.serverIp }}</strong>
          </div>
          <div class="bi-sep"></div>
          <div class="bi-item">
            <span>Карта</span>
            <strong>В браузере</strong>
          </div>
        </div>

        <div class="bi-panel">
          <h3 class="bi-panel__title">Интерфейс не мешает игроку</h3>
          <ul class="bi-list">
            <li>
              <span class="bi-num">01</span>
              <div>
                <strong>Один вход</strong>
                <small>Один аккаунт для сайта и лаунчера.</small>
              </div>
            </li>
            <li>
              <span class="bi-num">02</span>
              <div>
                <strong>Живые страницы</strong>
                <small>Профиль и государства — не технопанель.</small>
              </div>
            </li>
            <li>
              <span class="bi-num">03</span>
              <div>
                <strong>Быстрые переходы</strong>
                <small>Лаунчер, карта и Discord в 1–2 клика.</small>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bi-grid {
  display: grid;
  gap: .5rem;
}

@media (min-width: 860px) {
  .bi-grid { grid-template-columns: 1fr 1fr; }
}

.bi-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .5rem;
  border: 1px solid rgba(148,163,184,.1);
  border-radius: 16px;
  background: rgba(255,255,255,.025);
  padding: 1rem 1.1rem;
}

.bi-item {
  display: flex;
  flex-direction: column;
  gap: .2rem;
  flex: 1;
  min-width: 90px;
}

.bi-item span {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgb(100 116 139);
}

.bi-item strong {
  font-size: .92rem;
  font-weight: 800;
  color: rgb(226 232 240);
}

.bi-sep {
  width: 1px;
  height: 36px;
  background: rgba(255,255,255,.08);
  flex-shrink: 0;
}

.bi-panel {
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 16px;
  background: radial-gradient(ellipse at top left, rgba(139,92,246,.22) 0%, transparent 50%),
    linear-gradient(135deg, rgba(20,26,50,.98), rgba(12,17,32,1));
  padding: 1rem 1.1rem;
}

.bi-panel__title {
  font-size: .88rem;
  font-weight: 800;
  color: #fff;
  margin: 0 0 .75rem;
}

.bi-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.bi-list li {
  display: flex;
  align-items: flex-start;
  gap: .6rem;
}

.bi-num {
  font-size: .75rem;
  font-weight: 900;
  color: rgba(255,255,255,.4);
  flex-shrink: 0;
  padding-top: .1rem;
}

.bi-list strong {
  display: block;
  font-size: .83rem;
  font-weight: 700;
  color: rgba(255,255,255,.85);
}

.bi-list small {
  display: block;
  font-size: .75rem;
  color: rgba(255,255,255,.45);
  margin-top: .05rem;
}
</style>
