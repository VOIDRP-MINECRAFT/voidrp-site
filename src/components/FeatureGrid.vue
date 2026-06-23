<script setup>
import { siteConfig } from '../config.site'
</script>

<template>
  <section class="py-2 md:py-3">
    <div class="container-shell">
      <div class="fg-grid">
        <article v-for="feature in siteConfig.features" :key="feature.title" class="fg-card">
          <span class="fg-icon">{{ feature.icon }}</span>
          <div>
            <h3 class="fg-title">{{ feature.title }}</h3>
            <p class="fg-desc">{{ feature.description }}</p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: .5rem;
}

.fg-card {
  display: flex;
  align-items: flex-start;
  gap: .75rem;
  border: 1px solid rgba(148,163,184,.1);
  border-radius: 16px;
  background: rgba(255,255,255,.025);
  padding: .85rem;
  transition: border-color .15s;
}

.fg-card:hover { border-color: rgba(148,163,184,.18); }

.fg-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(139,92,246,.1);
  border: 1px solid rgba(139,92,246,.15);
}

.fg-title {
  font-size: .88rem;
  font-weight: 800;
  color: rgb(226 232 240);
  margin: 0 0 .25rem;
}

.fg-desc {
  font-size: .78rem;
  line-height: 1.55;
  color: rgb(100 116 139);
  margin: 0;
}
</style>
