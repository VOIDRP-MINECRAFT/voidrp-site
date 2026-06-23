<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getNationRankings } from '../services/nationStatsApi'
import { usePageMeta } from '../composables/usePageMeta.js'

usePageMeta({
  title: 'Рейтинг государств',
  description: 'Рейтинг государств сервера VoidRP по богатству, активности и размеру. Кто сильнейший на этой неделе?',
  url: 'https://void-rp.ru/nations/rankings',
  breadcrumbs: [
    { name: 'Главная', url: '/' },
    { name: 'Государства', url: '/nations' },
    { name: 'Рейтинг' },
  ],
})
import { useAuthStore } from '../stores/authStore'
import { formatCompactHoursFromMinutes, formatNumber } from '../utils/formatters'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const rankings = ref([])

const podium = computed(() => rankings.value.slice(0, 3))
const rest = computed(() => rankings.value.slice(3))

async function loadRankings() {
  loading.value = true
  error.value = ''
  try {
    const payload = await getNationRankings(auth.accessToken || null)
    rankings.value = payload?.items || []
  } catch (err) {
    error.value = err.message || t('nationRankings.loadError')
  } finally {
    loading.value = false
  }
}

function iconUrl(item) {
  return item.icon_url || item.icon_preview_url || ''
}

function podiumMedal(index) {
  return ['🥇', '🥈', '🥉'][index] || ''
}

function podiumClass(index) {
  return ['podium-gold', 'podium-silver', 'podium-bronze'][index] || ''
}

function goToNation(slug) {
  router.push(`/nation/${slug}`)
}

onMounted(loadRankings)
</script>

<template>
  <section class="nr py-3 md:py-4 auth-page">
    <div class="container-shell max-w-[1380px] space-y-3 page-entry">

      <!-- header -->
      <header class="nr-header">
        <div>
          <p class="nr-eyebrow">{{ t('nationRankings.eyebrow') }}</p>
          <h1 class="nr-h1">{{ t('nationRankings.title') }}</h1>
        </div>
        <RouterLink to="/nations" class="nr-back-btn">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
          {{ t('nationRankings.backBtn') }}
        </RouterLink>
      </header>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <!-- loading -->
      <template v-if="loading">
        <div class="nr-podium-skeleton">
          <div v-for="i in 3" :key="i" class="skeleton" style="height:160px;border-radius:16px"></div>
        </div>
        <div class="surface-card" style="padding:1rem">
          <div class="nr-skeletons">
            <div v-for="i in 6" :key="i" class="skeleton" style="height:44px;border-radius:8px"></div>
          </div>
        </div>
      </template>

      <template v-else-if="!rankings.length">
        <div class="surface-card nr-empty">
          <h2>{{ t('nationRankings.emptyTitle') }}</h2>
          <p>{{ t('nationRankings.emptyDesc') }}</p>
        </div>
      </template>

      <template v-else>

        <!-- ─── PODIUM ─── -->
        <div class="nr-podium">
          <RouterLink
            v-for="(item, index) in podium"
            :key="item.nation_id || item.slug"
            :to="`/nation/${item.slug}`"
            class="nr-podium-card"
            :class="podiumClass(index)"
          >
            <div class="nr-podium-card__top">
              <span class="nr-medal">{{ podiumMedal(index) }}</span>
              <span class="nr-rank-num">#{{ index + 1 }}</span>
            </div>
            <div class="nr-podium-card__identity">
              <div class="nr-podium-icon">
                <img v-if="iconUrl(item)" :src="iconUrl(item)" :alt="item.tag" />
                <span v-else>{{ item.tag?.slice(0,2).toUpperCase() }}</span>
              </div>
              <div class="nr-podium-card__name-block">
                <strong>{{ item.title }}</strong>
                <small>[{{ item.tag }}]</small>
              </div>
            </div>
            <div class="nr-podium-card__stats">
              <div>
                <span>{{ t('nationRankings.score') }}</span>
                <strong>{{ formatNumber(item.score ?? 0) }}</strong>
              </div>
              <div>
                <span>{{ t('nationRankings.members') }}</span>
                <strong>{{ formatNumber(item.members_count ?? 0) }}</strong>
              </div>
              <div>
                <span>{{ t('nationRankings.balance') }}</span>
                <strong>{{ formatNumber(item.treasury_balance ?? 0) }}</strong>
              </div>
            </div>
          </RouterLink>
        </div>

        <!-- ─── RANKING TABLE ─── -->
        <div class="surface-card nr-table-card">
          <div class="nr-table-header">
            <h2 class="nr-section-title">{{ t('nationRankings.fullTable') }}</h2>
            <span class="nr-count">{{ t('nationRankings.nationCount', { n: rankings.length }) }}</span>
          </div>

          <!-- desktop table -->
          <div class="nr-table-wrap nr-desktop">
            <table class="nr-table">
              <thead>
                <tr>
                  <th class="nr-th-rank">#</th>
                  <th>{{ t('nationRankings.colNation') }}</th>
                  <th class="num">{{ t('nationRankings.colMembers') }}</th>
                  <th class="num">{{ t('nationRankings.colBalance') }}</th>
                  <th class="num">{{ t('nationRankings.colTerritory') }}</th>
                  <th class="num">{{ t('nationRankings.colOnline') }}</th>
                  <th class="num">{{ t('nationRankings.colScore') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in rankings"
                  :key="item.nation_id || item.slug"
                  class="nr-row"
                  :class="index < 3 ? `nr-row--${['gold','silver','bronze'][index]}` : ''"
                  @click="goToNation(item.slug)"
                >
                  <td class="nr-td-rank">
                    <span class="nr-pos" :class="index < 3 ? `nr-pos--${['gold','silver','bronze'][index]}` : ''">{{ index + 1 }}</span>
                  </td>
                  <td class="nr-td-nation">
                    <div class="nr-nation-cell">
                      <div class="nr-table-icon">
                        <img v-if="iconUrl(item)" :src="iconUrl(item)" :alt="item.tag" />
                        <span v-else>{{ item.tag?.slice(0,2).toUpperCase() }}</span>
                      </div>
                      <div>
                        <span class="nr-nation-name">{{ item.title }}</span>
                        <span class="nr-nation-tag">[{{ item.tag }}]</span>
                      </div>
                    </div>
                  </td>
                  <td class="num">{{ formatNumber(item.members_count ?? 0) }}</td>
                  <td class="num">{{ formatNumber(item.treasury_balance ?? 0) }}</td>
                  <td class="num">{{ formatNumber(item.territory_points ?? 0) }}</td>
                  <td class="num">{{ formatCompactHoursFromMinutes(item.total_playtime_minutes ?? 0) }}</td>
                  <td class="num nr-score">{{ formatNumber(item.score ?? 0) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- mobile list -->
          <div class="nr-mobile">
            <div
              v-for="(item, index) in rankings"
              :key="item.nation_id || item.slug"
              class="nr-mitem"
              :class="index < 3 ? `nr-mitem--${['gold','silver','bronze'][index]}` : ''"
              @click="goToNation(item.slug)"
            >
              <span class="nr-mpos" :class="index < 3 ? `nr-pos--${['gold','silver','bronze'][index]}` : ''">{{ index + 1 }}</span>
              <div class="nr-table-icon">
                <img v-if="iconUrl(item)" :src="iconUrl(item)" :alt="item.tag" />
                <span v-else>{{ item.tag?.slice(0,2).toUpperCase() }}</span>
              </div>
              <div class="nr-mitem__info">
                <strong>{{ item.title }}</strong>
                <small>[{{ item.tag }}] · {{ formatNumber(item.members_count ?? 0) }} · {{ formatNumber(item.score ?? 0) }} pts</small>
              </div>
              <svg class="nr-mitem__arrow" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
            </div>
          </div>
        </div>

      </template>
    </div>
  </section>
</template>

<style scoped>
/* ─── Header ─── */
.nr-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.nr-eyebrow {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  margin: 0 0 .15rem;
}

.nr-h1 {
  font-size: 1.5rem;
  font-weight: 900;
  color: #f8fbff;
  margin: 0;
  letter-spacing: -.03em;
}

.nr-back-btn {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  min-height: 2.35rem;
  padding: 0 .9rem;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(6,10,19,.7);
  color: rgb(148 163 184);
  font-size: .875rem;
  font-weight: 700;
  transition: border-color .15s, color .15s;
}

.nr-back-btn:hover { border-color: rgba(148,163,184,.28); color: #fff; }

.nr-back-btn svg { width: .9rem; height: .9rem; }

/* ─── Empty / Loading ─── */
.nr-podium-skeleton {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: .65rem;
}

.nr-skeletons { display: grid; gap: .35rem; }

.nr-empty {
  padding: 2rem;
  text-align: center;
}

.nr-empty h2 { font-size: 1.1rem; font-weight: 800; color: rgb(203 213 225); margin: 0 0 .5rem; }
.nr-empty p  { font-size: .88rem; color: rgb(100 116 139); margin: 0; }

/* ─── Podium ─── */
.nr-podium {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: .65rem;
}

.nr-podium-card {
  display: flex;
  flex-direction: column;
  gap: .85rem;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px;
  background: rgba(13,19,36,.85);
  padding: 1rem;
  transition: border-color .15s, transform .15s;
  cursor: pointer;
}

.nr-podium-card:hover { transform: translateY(-2px); }

.podium-gold   { border-color: rgba(234,179,8,.24); background: rgba(234,179,8,.04); }
.podium-silver { border-color: rgba(148,163,184,.2); background: rgba(148,163,184,.03); }
.podium-bronze { border-color: rgba(180,83,9,.2); background: rgba(180,83,9,.04); }

.nr-podium-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nr-medal { font-size: 1.4rem; line-height: 1; }

.nr-rank-num {
  font-size: .75rem;
  font-weight: 900;
  letter-spacing: .12em;
  color: rgb(100 116 139);
}

.nr-podium-card__identity {
  display: flex;
  align-items: center;
  gap: .65rem;
  min-width: 0;
}

.nr-podium-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(10,15,30,.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .85rem;
  font-weight: 900;
  color: #f8fbff;
  overflow: hidden;
  flex-shrink: 0;
}

.nr-podium-icon img { width: 100%; height: 100%; object-fit: cover; }

.nr-podium-card__name-block { min-width: 0; }

.nr-podium-card__name-block strong {
  display: block;
  font-size: .97rem;
  font-weight: 800;
  color: #f0f4ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-podium-card__name-block small {
  display: block;
  font-size: .75rem;
  color: rgb(100 116 139);
  margin-top: .1rem;
}

.nr-podium-card__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: .4rem;
  border-top: 1px solid rgba(255,255,255,.06);
  padding-top: .75rem;
}

.nr-podium-card__stats div {
  display: flex;
  flex-direction: column;
  gap: .15rem;
}

.nr-podium-card__stats span {
  font-size: .6rem;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: rgb(100 116 139);
}

.nr-podium-card__stats strong {
  font-size: .88rem;
  font-weight: 800;
  color: rgb(226 232 240);
}

/* ─── Table Card ─── */
.nr-table-card { padding: 1rem; }

.nr-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: .85rem;
}

.nr-section-title {
  font-size: .92rem;
  font-weight: 800;
  color: rgb(203 213 225);
  margin: 0;
}

.nr-count {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .1em;
  color: rgb(100 116 139);
}

/* ─── Desktop Table ─── */
.nr-table-wrap {
  overflow-x: auto;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
}

.nr-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 660px;
}

.nr-table th {
  background: rgba(255,255,255,.03);
  border-bottom: 1px solid rgba(255,255,255,.07);
  padding: .42rem .75rem;
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgb(100 116 139);
  white-space: nowrap;
  text-align: left;
}

.nr-table th.num,
.nr-table td.num { text-align: right; }

.nr-th-rank { width: 48px; text-align: center !important; }

.nr-table td {
  border-bottom: 1px solid rgba(255,255,255,.05);
  padding: .5rem .75rem;
  font-size: .875rem;
  color: rgb(203 213 225);
}

.nr-row {
  cursor: pointer;
  transition: background .1s;
}

.nr-row:last-child td { border-bottom: none; }
.nr-row:hover td { background: rgba(255,255,255,.03); }

.nr-row--gold td   { background: rgba(234,179,8,.03); }
.nr-row--silver td { background: rgba(148,163,184,.02); }
.nr-row--bronze td { background: rgba(180,83,9,.025); }

.nr-row--gold:hover td   { background: rgba(234,179,8,.06); }
.nr-row--silver:hover td { background: rgba(148,163,184,.04); }
.nr-row--bronze:hover td { background: rgba(180,83,9,.05); }

/* rank cell */
.nr-td-rank { text-align: center; }

.nr-pos {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  font-size: .8rem;
  font-weight: 900;
  background: rgba(255,255,255,.05);
  color: rgb(100 116 139);
}

.nr-pos--gold   { background: rgba(234,179,8,.15); color: rgb(234 179 8); }
.nr-pos--silver { background: rgba(148,163,184,.12); color: rgb(203 213 225); }
.nr-pos--bronze { background: rgba(180,83,9,.15); color: rgb(251 146 60); }

/* nation cell */
.nr-nation-cell {
  display: flex;
  align-items: center;
  gap: .6rem;
}

.nr-table-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(10,15,30,.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .75rem;
  font-weight: 900;
  color: #f8fbff;
  overflow: hidden;
  flex-shrink: 0;
}

.nr-table-icon img { width: 100%; height: 100%; object-fit: cover; }

.nr-nation-name {
  display: block;
  font-weight: 700;
  color: #f0f4ff;
  font-size: .875rem;
}

.nr-nation-tag {
  display: block;
  font-size: .75rem;
  color: rgb(100 116 139);
  margin-top: .05rem;
}

.nr-score {
  font-weight: 800;
  color: rgb(196 181 253) !important;
}

/* ─── Mobile list ─── */
.nr-desktop { display: none; }
.nr-mobile  { display: flex; flex-direction: column; gap: 0; }

@media (min-width: 640px) {
  .nr-desktop { display: block; }
  .nr-mobile  { display: none; }
}

.nr-mitem {
  display: flex;
  align-items: center;
  gap: .7rem;
  padding: .55rem .25rem;
  border-bottom: 1px solid rgba(255,255,255,.05);
  cursor: pointer;
  transition: background .1s;
  border-radius: 8px;
}

.nr-mitem:last-child { border-bottom: none; }
.nr-mitem:hover { background: rgba(255,255,255,.03); }

.nr-mitem--gold   { background: rgba(234,179,8,.03); }
.nr-mitem--silver { background: rgba(148,163,184,.02); }
.nr-mitem--bronze { background: rgba(180,83,9,.025); }

.nr-mpos {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  font-size: .75rem;
  font-weight: 900;
  background: rgba(255,255,255,.05);
  color: rgb(100 116 139);
  flex-shrink: 0;
}

.nr-mitem__info { min-width: 0; flex: 1; }

.nr-mitem__info strong {
  display: block;
  font-size: .88rem;
  font-weight: 700;
  color: #f0f4ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-mitem__info small {
  display: block;
  font-size: .75rem;
  color: rgb(100 116 139);
  margin-top: .05rem;
}

.nr-mitem__arrow {
  width: .9rem;
  height: .9rem;
  color: rgb(71 85 105);
  flex-shrink: 0;
}

/* ─── Responsive ─── */
@media (max-width: 640px) {
  .nr-podium { grid-template-columns: 1fr; }
  .nr-podium-skeleton { grid-template-columns: 1fr; }
  .nr-podium-card__stats { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 641px) and (max-width: 900px) {
  .nr-podium { grid-template-columns: repeat(3, 1fr); }
}
</style>
