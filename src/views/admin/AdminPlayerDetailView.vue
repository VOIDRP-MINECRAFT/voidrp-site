<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { getPlayerOverview } from '../../services/adminSecurityApi'
import { toastError } from '../../services/toast'

const token = () => authState.accessToken
const route = useRoute()
const router = useRouter()

const data = ref(null)
const loading = ref(false)
const nickname = ref(route.params.nickname)

async function load() {
  loading.value = true
  try {
    data.value = await getPlayerOverview(token(), nickname.value)
  } catch (e) {
    toastError('Не удалось загрузить карточку игрока')
    data.value = null
  } finally {
    loading.value = false
  }
}

watch(() => route.params.nickname, (n) => { if (n) { nickname.value = n; load() } })
watch(() => activeServer.value?.slug, () => load())
onMounted(load)

function fmtDate(iso) { return iso ? new Date(iso).toLocaleString('ru', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' }
const TYPE_LABELS = { ban: 'Бан', tempban: 'Врем. бан', mute: 'Мут', tempmute: 'Врем. мут', kick: 'Кик', warn: 'Предупр.' }
const sevClass = (s) => ({ HIGH: 'is-high', MEDIUM: 'is-med', LOW: '' }[s] || '')
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div class="p360-head-l">
        <button class="adm-btn adm-btn--sm adm-btn--ghost" @click="router.back()">←</button>
        <span class="adm-avatar p360-ava">{{ (nickname || '?').charAt(0).toUpperCase() }}</span>
        <div>
          <h1 class="adm-title">{{ nickname }}</h1>
          <p class="adm-sub">Сводка на сервере «{{ data?.server_name || activeServer?.name }}»</p>
        </div>
      </div>
      <div class="adm-head-actions">
        <button class="adm-btn" :disabled="loading" @click="load">Обновить</button>
      </div>
    </div>

    <div v-if="loading && !data" class="adm-card adm-card--pad p360-loading">Загрузка…</div>

    <div v-else-if="data" class="p360-grid">
      <!-- Account -->
      <div class="adm-card">
        <div class="adm-card__head"><h3 class="adm-card__title">Аккаунт</h3></div>
        <div class="adm-card--pad">
          <div v-if="data.account" class="p360-kv">
            <div><span>Ник</span><b class="adm-mono">{{ data.account.nickname }}</b></div>
            <div><span>Логин на сайте</span><b>{{ data.account.site_login || '—' }}</b></div>
            <div><span>Email</span><b>{{ data.account.email || '—' }}</b></div>
            <div><span>Роль</span>
              <b><span class="adm-badge" :class="data.account.is_admin ? 'adm-badge--acc' : data.account.is_moderator ? 'adm-badge--info' : ''">
                {{ data.account.is_admin ? 'Админ' : data.account.is_moderator ? 'Модератор' : 'Игрок' }}</span></b></div>
            <div><span>Legacy-вход</span><b>{{ data.account.legacy_auth_enabled ? 'Вкл' : 'Выкл' }}</b></div>
            <div><span>Регистрация</span><b>{{ fmtDate(data.account.created_at) }}</b></div>
          </div>
          <p v-else class="p360-none">Аккаунт на сайте не найден (возможно, только игровой).</p>
        </div>
      </div>

      <!-- Nations -->
      <div class="adm-card">
        <div class="adm-card__head"><h3 class="adm-card__title">Государства</h3></div>
        <div class="adm-card--pad">
          <div v-if="data.nations?.length" class="p360-nations">
            <div v-for="n in data.nations" :key="n.slug" class="p360-nation">
              <b>{{ n.name }}<span v-if="n.tag" class="p360-tag">[{{ n.tag }}]</span></b>
              <span class="adm-badge" :class="n.role === 'leader' ? 'adm-badge--acc' : ''">{{ n.role === 'leader' ? 'Лидер' : n.role }}</span>
            </div>
          </div>
          <p v-else class="p360-none">Не состоит в государствах на этом сервере.</p>
        </div>
      </div>

      <!-- Anticheat -->
      <div class="adm-card">
        <div class="adm-card__head">
          <h3 class="adm-card__title">Античит</h3>
          <RouterLink v-if="data.anticheat?.player_uuid" class="adm-btn adm-btn--sm"
                      :to="`/admin/anticheat/${data.anticheat.player_uuid}`">Подробнее</RouterLink>
        </div>
        <div class="adm-card--pad">
          <div class="p360-stats">
            <div class="p360-stat"><b>{{ data.anticheat.total_violations }}</b><span>нарушений</span></div>
            <div class="p360-stat"><b>{{ data.anticheat.total_vl }}</b><span>сумма VL</span></div>
            <div class="p360-stat" :class="{ 'is-warn': data.anticheat.unreviewed }"><b>{{ data.anticheat.unreviewed }}</b><span>непросм.</span></div>
            <div class="p360-stat" :class="{ 'is-danger': data.anticheat.injection_reports }"><b>{{ data.anticheat.injection_reports }}</b><span>инъекций</span></div>
          </div>
          <div v-if="data.anticheat.recent?.length" class="p360-viol">
            <div v-for="(v, i) in data.anticheat.recent" :key="i" class="p360-viol__row" :class="sevClass(v.severity)">
              <span class="adm-mono">{{ v.check_type }}</span>
              <span class="p360-vl">VL {{ v.vl }}</span>
              <span class="p360-dim">{{ fmtDate(v.created_at) }}</span>
              <span v-if="v.reviewed" class="p360-rev" title="Просмотрено">✓</span>
            </div>
          </div>
          <p v-else class="p360-none">Нарушений нет.</p>
        </div>
      </div>

      <!-- Punishments -->
      <div class="adm-card">
        <div class="adm-card__head">
          <h3 class="adm-card__title">Наказания
            <span v-if="data.active_punishments" class="adm-badge adm-badge--err">{{ data.active_punishments }} активн.</span></h3>
          <RouterLink class="adm-btn adm-btn--sm" to="/admin/punishments">Все</RouterLink>
        </div>
        <div class="adm-card--pad">
          <div v-if="data.punishments?.length" class="p360-pun">
            <div v-for="p in data.punishments" :key="p.id" class="p360-pun__row" :class="{ 'is-active': p.effective }">
              <span class="adm-badge" :class="p.type.includes('ban') ? 'adm-badge--err' : p.type.includes('mute') ? 'adm-badge--warn' : ''">{{ TYPE_LABELS[p.type] || p.type }}</span>
              <span class="p360-pun__reason">{{ p.reason || '—' }}</span>
              <span class="p360-dim">{{ p.issued_by_name }}</span>
              <span class="p360-dim">{{ fmtDate(p.created_at) }}</span>
            </div>
          </div>
          <p v-else class="p360-none">Наказаний нет.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.p360-head-l { display: flex; align-items: center; gap: 0.8rem; }
.p360-ava { width: 2.6rem; height: 2.6rem; font-size: 1.1rem; }
.p360-loading { color: var(--adm-dim); text-align: center; }
.p360-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.4rem; }
@media (max-width: 860px) { .p360-grid { grid-template-columns: 1fr; } }
.p360-none { color: var(--adm-dim); font-size: 0.82rem; }

.p360-kv { display: flex; flex-direction: column; }
.p360-kv > div { display: flex; justify-content: space-between; align-items: center; gap: 1rem; font-size: 0.82rem; padding: 0.5rem 0; border-bottom: 1px solid var(--adm-line); }
.p360-kv > div:last-child { border-bottom: none; }
.p360-kv span { color: var(--adm-dim); }
.p360-kv b { color: var(--adm-text); font-weight: 600; text-align: right; }

.p360-nations { display: flex; flex-direction: column; gap: 0.5rem; }
.p360-nation { display: flex; justify-content: space-between; align-items: center; padding: 0.55rem 0.75rem; background: var(--adm-card-2); border: 1px solid var(--adm-line); border-radius: var(--adm-r-sm); }
.p360-nation b { font-weight: 700; }
.p360-tag { color: var(--adm-dim); font-weight: 600; margin-left: 0.35rem; font-size: 0.8rem; }

.p360-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; }
.p360-stat { text-align: center; padding: 0.65rem 0.4rem; background: var(--adm-card-2); border: 1px solid var(--adm-line); border-radius: var(--adm-r-sm); }
.p360-stat b { display: block; font-family: var(--adm-mono); font-size: 1.15rem; font-weight: 700; color: var(--adm-text); }
.p360-stat span { font-size: 0.66rem; color: var(--adm-dim); }
.p360-stat.is-warn b { color: var(--adm-warn); }
.p360-stat.is-danger b { color: var(--adm-err); }

.p360-viol { margin-top: 0.85rem; display: flex; flex-direction: column; gap: 0.3rem; }
.p360-viol__row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 0.6rem; align-items: baseline; font-size: 0.76rem; padding: 0.35rem 0.5rem; border-radius: var(--adm-r-sm); border-left: 2px solid transparent; background: rgba(148, 163, 184, 0.03); }
.p360-viol__row.is-high { border-left-color: var(--adm-err); }
.p360-viol__row.is-med { border-left-color: var(--adm-warn); }
.p360-vl { color: var(--adm-mut); font-weight: 600; }
.p360-dim { color: var(--adm-dim); font-size: 0.72rem; }
.p360-rev { color: var(--adm-ok); font-weight: 700; }

.p360-pun { display: flex; flex-direction: column; gap: 0.35rem; }
.p360-pun__row { display: grid; grid-template-columns: auto 1fr auto auto; gap: 0.6rem; align-items: baseline; font-size: 0.78rem; padding: 0.4rem 0.5rem; border-radius: var(--adm-r-sm); background: rgba(148, 163, 184, 0.03); }
.p360-pun__row.is-active { background: rgba(248, 113, 113, 0.08); }
.p360-pun__reason { color: var(--adm-mut); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
