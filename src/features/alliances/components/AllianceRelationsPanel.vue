<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  alliance: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
})

function allianceTypeLabel(value) {
  switch (String(value || '').toLowerCase()) {
    case 'nato':
      return t('allianceHub.typeNato')
    case 'economic':
      return t('allianceHub.typeEconomic')
    case 'un':
      return t('allianceHub.typeUn')
    default:
      return t('allianceHub.typeDefault')
  }
}

function memberRoleLabel(value) {
  return String(value || '').toLowerCase() === 'founder'
    ? t('allianceRelations.roleFounder')
    : t('allianceRelations.roleMember')
}

const overviewItems = computed(() => {
  const alliance = props.alliance || {}
  return [
    { label: t('allianceRelations.statType'), value: allianceTypeLabel(alliance.alliance_type) },
    { label: t('allianceRelations.statMembers'), value: String(alliance.members_count ?? alliance.members?.length ?? 0) },
    { label: t('allianceRelations.statTreasury'), value: String(alliance.treasury_balance ?? 0) },
    { label: t('allianceRelations.statThreshold'), value: String(alliance.min_power_required ?? 0) },
  ]
})

const publicRules = computed(() => {
  const alliance = props.alliance || {}
  return [
    {
      title: t('allianceRelations.transfersTitle'),
      value: alliance.allow_internal_transfers ? t('allianceRelations.transfersOn') : t('allianceRelations.transfersOff'),
      description: alliance.allow_internal_transfers
        ? t('allianceRelations.transfersDescOn')
        : t('allianceRelations.transfersDescOff'),
    },
    {
      title: t('allianceRelations.defenseTitle'),
      value: alliance.allow_joint_defense ? t('allianceRelations.defenseOn') : t('allianceRelations.defenseOff'),
      description: alliance.allow_joint_defense
        ? t('allianceRelations.defenseDescOn')
        : t('allianceRelations.defenseDescOff'),
    },
    {
      title: t('allianceRelations.tradeTitle'),
      value: alliance.allow_trade_bonus ? t('allianceRelations.tradeOn') : t('allianceRelations.tradeOff'),
      description: alliance.allow_trade_bonus
        ? t('allianceRelations.tradeDescOn')
        : t('allianceRelations.tradeDescOff'),
    },
    {
      title: t('allianceRelations.pvpTitle'),
      value: alliance.allow_pvp_protection ? t('allianceRelations.pvpOn') : t('allianceRelations.pvpOff'),
      description: alliance.allow_pvp_protection
        ? t('allianceRelations.pvpDescOn')
        : t('allianceRelations.pvpDescOff'),
    },
  ]
})

const managementRules = computed(() => {
  const alliance = props.alliance || {}
  return [
    { label: t('allianceRelations.feeLabel'), value: `${alliance.transfer_fee_percent ?? 0}%` },
    { label: 'Slug', value: alliance.slug || '—' },
    { label: t('allianceRelations.founderIdLabel'), value: alliance.founder_nation_id || '—' },
  ]
})
</script>

<template>
  <section class="surface-card p-4 md:p-5">
    <div class="section-kicker !mb-2">{{ t('allianceRelations.headerKicker') }}</div>
    <h2 class="text-xl font-black tracking-tight text-slate-50 md:text-2xl">
      {{ editable ? t('allianceRelations.headerEditable') : t('allianceRelations.headerReadonly') }}
    </h2>

    <div v-if="loading" class="mt-5 space-y-3">
      <div class="skeleton h-24 rounded-[24px]"></div>
      <div class="skeleton h-24 rounded-[24px]"></div>
    </div>

    <div v-else-if="!alliance" class="action-card mt-5 text-sm text-slate-400">
      {{ t('allianceRelations.notSelected') }}
    </div>

    <div v-else class="mt-5 space-y-5">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="item in overviewItems" :key="item.label" class="metric-card">
          <p class="metric-label">{{ item.label }}</p>
          <p class="mt-3 text-sm font-semibold text-slate-100">{{ item.value }}</p>
        </div>
      </div>

      <div>
        <div class="section-kicker !mb-2">{{ t('allianceRelations.benefitsKicker') }}</div>
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
        <div class="section-kicker !mb-2">{{ t('allianceRelations.membersKicker') }}</div>
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
        <div class="section-kicker !mb-2">{{ t('allianceRelations.serviceKicker') }}</div>
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
