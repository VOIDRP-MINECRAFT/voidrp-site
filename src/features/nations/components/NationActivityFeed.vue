<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  title: { type: String, default: 'Активность' },
  subtitle: { type: String, default: '' },
  cardStyle: { type: Object, default: () => ({}) },
  compact: { type: Boolean, default: false },
})

const EVENT_ICONS = {
  nation_created: '🏛',
  nation_updated: '✏️',
  nation_disbanded: '💀',
  join_requested: '📩',
  join_approved: '✅',
  join_rejected: '✖',
  member_joined: '👤',
  member_left: '🚪',
  member_removed: '⛔',
  member_role_updated: '🔖',
  leadership_transferred: '👑',
  asset_updated: '🖼',
  asset_deleted: '🗑',
}

function formatActor(entry, key = 'actor') {
  const value = entry?.[key]
  if (!value) return 'Система'
  return value.minecraft_nickname || value.site_login || 'Игрок'
}

function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function buildMessage(entry) {
  const actor = formatActor(entry, 'actor')
  const target = formatActor(entry, 'target')
  switch (entry?.event_type) {
    case 'nation_created': return `${actor} основал государство`
    case 'nation_updated': return `${actor} обновил настройки`
    case 'nation_disbanded': return `${actor} расформировал государство`
    case 'join_requested': return `${actor} подал заявку`
    case 'join_approved': return `${actor} принял ${target}`
    case 'join_rejected': return `${actor} отклонил заявку ${target}`
    case 'member_joined': return `${target} вступил`
    case 'member_left': return `${target} покинул государство`
    case 'member_removed': return `${actor} исключил ${target}`
    case 'member_role_updated': return `${actor} изменил роль ${target}`
    case 'leadership_transferred': return `Лидерство передано ${target}`
    case 'asset_updated': return `${actor} обновил оформление`
    case 'asset_deleted': return `${actor} удалил элемент`
    default: return entry?.message || 'Событие'
  }
}

const normalizedItems = computed(() =>
  props.items.map((entry) => ({
    ...entry,
    icon: EVENT_ICONS[entry?.event_type] || '·',
    message: entry?.message || buildMessage(entry),
    time: formatTime(entry?.created_at),
  })),
)
</script>

<template>
  <section class="surface-card naf" :style="cardStyle">
    <h2 class="naf__title">{{ title }}</h2>

    <div v-if="loading" class="naf__skeletons">
      <div v-for="i in 5" :key="i" class="skeleton" style="height:30px;border-radius:8px"></div>
    </div>

    <div v-else-if="!normalizedItems.length" class="naf__empty">
      Событий пока нет
    </div>

    <ul v-else class="naf__list">
      <li v-for="item in normalizedItems" :key="item.id">
        <span class="naf__icon">{{ item.icon }}</span>
        <div class="naf__body">
          <span class="naf__msg">{{ item.message }}</span>
          <small class="naf__time">{{ item.time }}</small>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.naf {
  padding: 1rem;
}

.naf__title {
  font-size: .92rem;
  font-weight: 800;
  color: rgb(203 213 225);
  margin: 0 0 .75rem;
}

.naf__skeletons {
  display: grid;
  gap: .35rem;
}

.naf__empty {
  font-size: .85rem;
  color: rgb(100 116 139);
  padding: .25rem 0;
}

.naf__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.naf__list li {
  display: flex;
  align-items: flex-start;
  gap: .6rem;
  padding: .4rem 0;
  border-bottom: 1px solid rgba(255,255,255,.05);
}

.naf__list li:last-child {
  border-bottom: none;
}

.naf__icon {
  font-size: .85rem;
  flex-shrink: 0;
  width: 1.4rem;
  text-align: center;
  line-height: 1.4;
  margin-top: .05rem;
}

.naf__body {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: .25rem .65rem;
  min-width: 0;
}

.naf__msg {
  font-size: .84rem;
  color: rgb(203 213 225);
  font-weight: 500;
}

.naf__time {
  font-size: .75rem;
  color: rgb(71 85 105);
  white-space: nowrap;
}
</style>
