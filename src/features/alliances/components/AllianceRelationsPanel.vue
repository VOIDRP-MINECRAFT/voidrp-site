<script setup>
import { computed } from 'vue'

const props = defineProps({
  alliance: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
})

function allianceTypeLabel(value) {
  switch (String(value || '').toLowerCase()) {
    case 'nato':
      return 'Военный союз'
    case 'economic':
      return 'Экономический союз'
    case 'un':
      return 'Политический союз'
    default:
      return 'Союз государств'
  }
}

function memberRoleLabel(value) {
  switch (String(value || '').toLowerCase()) {
    case 'founder':
      return 'Основатель'
    case 'member':
      return 'Участник'
    default:
      return 'Участник'
  }
}

const overviewItems = computed(() => {
  const alliance = props.alliance || {}
  return [
    { label: 'Тип союза', value: allianceTypeLabel(alliance.alliance_type) },
    { label: 'Государств в составе', value: String(alliance.members_count ?? alliance.members?.length ?? 0) },
    { label: 'Казна союза', value: String(alliance.treasury_balance ?? 0) },
    { label: 'Порог для создания', value: String(alliance.min_power_required ?? 0) },
  ]
})

const publicRules = computed(() => {
  const alliance = props.alliance || {}
  return [
    {
      title: 'Переводы между союзниками',
      value: alliance.allow_internal_transfers ? 'Разрешены' : 'Отключены',
      description: alliance.allow_internal_transfers
        ? 'Государства внутри союза могут переводить средства друг другу.'
        : 'Переводы между государствами внутри союза сейчас отключены.',
    },
    {
      title: 'Совместная оборона',
      value: alliance.allow_joint_defense ? 'Включена' : 'Отключена',
      description: alliance.allow_joint_defense
        ? 'Союз рассчитан на взаимную поддержку участников.'
        : 'Сейчас это больше нейтральный союз без общей оборонной логики.',
    },
    {
      title: 'Торговые бонусы',
      value: alliance.allow_trade_bonus ? 'Работают' : 'Не используются',
      description: alliance.allow_trade_bonus
        ? 'Союз ориентирован на торговлю и совместную выгоду.'
        : 'Торговые послабления для участников пока не включены.',
    },
    {
      title: 'PvP защита',
      value: alliance.allow_pvp_protection ? 'Есть защита' : 'Нет защиты',
      description: alliance.allow_pvp_protection
        ? 'Для союзников действуют дополнительные ограничения на внутренний PvP.'
        : 'Внутренние PvP-ограничения сейчас не включены.',
    },
  ]
})

const managementRules = computed(() => {
  const alliance = props.alliance || {}
  return [
    { label: 'Комиссия перевода', value: `${alliance.transfer_fee_percent ?? 0}%` },
    { label: 'Slug', value: alliance.slug || '—' },
    { label: 'ID основателя', value: alliance.founder_nation_id || '—' },
  ]
})
</script>

<template>
  <section class="surface-card p-4 md:p-5">
    <div class="section-kicker !mb-2">Альянс</div>
    <h2 class="text-xl font-black tracking-tight text-slate-50 md:text-2xl">
      {{ editable ? 'Обзор и параметры союза' : 'О союзе' }}
    </h2>

    <div v-if="loading" class="mt-5 space-y-3">
      <div class="skeleton h-24 rounded-[24px]"></div>
      <div class="skeleton h-24 rounded-[24px]"></div>
    </div>

    <div v-else-if="!alliance" class="action-card mt-5 text-sm text-slate-400">
      Альянс пока не выбран.
    </div>

    <div v-else class="mt-5 space-y-5">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="item in overviewItems" :key="item.label" class="metric-card">
          <p class="metric-label">{{ item.label }}</p>
          <p class="mt-3 text-sm font-semibold text-slate-100">{{ item.value }}</p>
        </div>
      </div>

      <div>
        <div class="section-kicker !mb-2">Что даёт союз</div>
        <div class="grid gap-3 md:grid-cols-2">
          <div v-for="item in publicRules" :key="item.title" class="action-card">
            <div class="flex items-start justify-between gap-3">
              <p class="font-semibold text-slate-100">{{ item.title }}</p>
              <span class="footer-chip">{{ item.value }}</span>
            </div>
            <p class="mt-3 text-sm leading-6 text-slate-400">{{ item.description }}</p>
          </div>
        </div>
      </div>

      <div>
        <div class="section-kicker !mb-2">Государства в составе</div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="member in alliance.members || []" :key="member.id" class="action-card">
            <p class="font-semibold text-slate-100">{{ member.nation?.title || member.nation?.slug }}</p>
            <p class="mt-2 text-sm leading-6 text-slate-400">[{{ member.nation?.tag }}]</p>
            <p class="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {{ memberRoleLabel(member.role) }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="editable">
        <div class="section-kicker !mb-2">Служебные параметры</div>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div v-for="item in managementRules" :key="item.label" class="metric-card">
            <p class="metric-label">{{ item.label }}</p>
            <p class="mt-3 break-all text-sm font-semibold text-slate-100">{{ item.value }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
