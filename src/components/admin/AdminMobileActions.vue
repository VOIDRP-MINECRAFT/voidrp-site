<script setup>
// Быстрые действия с телефона: круглая кнопка внизу справа открывает шторку с главным —
// техработы, перезапуск, консоль, наказание — по выбранному в шапке серверу.
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authState, hasPermission } from '../../stores/authStore'
import { activeServer, fetchServers } from '../../stores/serverStore'
import { confirmDialog } from '../../composables/useConfirm'
import { toastError, toastSuccess } from '../../services/toast'
import { updateServer } from '../../services/adminServersApi'
import { serverPowerAction } from '../../services/adminServerOpsApi'

const router = useRouter()
const emit = defineEmits(['feed'])
const open = ref(false)
const busy = ref('')
const srv = computed(() => activeServer.value)
const canMaint = computed(() => hasPermission('servers.manage'))
const canPower = computed(() => hasPermission('monitoring.restart') && srv.value && !srv.value.is_external)

const LINKS = computed(() => [
  { label: 'Консоль и лог', to: '/admin/monitoring', perm: 'monitoring.view' },
  { label: 'Выдать наказание', to: '/admin/punishments', perm: 'punishments.view' },
  { label: 'Игроки', to: '/admin/players', perm: 'players.view' },
  { label: 'Обращения', to: '/admin/feedback', perm: 'feedback.view' },
].filter((l) => hasPermission(l.perm)))

async function toggleMaintenance() {
  if (!srv.value) return
  const on = !srv.value.maintenance
  if (on && !(await confirmDialog({ title: 'Включить техработы?', message: `Игроки не смогут зайти на «${srv.value.name}», пока техработы не выключат. Админы заходят.`, confirmLabel: 'Включить' }))) return
  busy.value = 'maint'
  try {
    await updateServer(authState.accessToken, srv.value.id, { maintenance: on })
    await fetchServers({ force: true })
    toastSuccess(on ? 'Техработы включены' : 'Техработы выключены')
  } catch (e) { toastError(e?.message || 'Не удалось переключить') } finally { busy.value = '' }
}
async function restart() {
  if (!(await confirmDialog({ title: 'Перезапустить сервер?', message: `«${srv.value.name}» сохранит мир, предупредит игроков в чате и перезапустится через 10 секунд.`, confirmLabel: 'Перезапустить', danger: true }))) return
  busy.value = 'restart'
  try {
    await serverPowerAction(authState.accessToken, 'restart', 10)
    toastSuccess('Перезапуск начат — сервер вернётся через пару минут')
  } catch (e) { toastError(e?.message || 'Не удалось перезапустить') } finally { busy.value = '' }
}
function go(to) { open.value = false; router.push(to) }
</script>

<template>
  <div class="mqa">
    <button type="button" class="mqa__fab" aria-label="Быстрые действия" :aria-expanded="open" @click="open = true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
    </button>
    <Transition name="mqa-fade"><div v-if="open" class="mqa__backdrop" @click="open = false" /></Transition>
    <Transition name="mqa-up">
      <div v-if="open" class="mqa__sheet" role="dialog" aria-label="Быстрые действия">
        <div class="mqa__grip" />
        <div class="mqa__head">
          <span class="adm-dot" :class="srv?.status?.online ? 'adm-dot--ok' : 'adm-dot--err'" />
          <b>{{ srv?.name || 'Сервер' }}</b>
          <span class="mqa__meta">{{ srv?.maintenance ? 'техработы' : srv?.status?.online ? `${srv.status.players_online} онлайн` : 'офлайн' }}</span>
        </div>
        <div class="mqa__big">
          <button v-if="canMaint" type="button" class="mqa__act" :class="{ 'mqa__act--on': srv?.maintenance }" :disabled="busy === 'maint'" @click="toggleMaintenance">
            <span class="mqa__act-title">{{ srv?.maintenance ? 'Выключить техработы' : 'Включить техработы' }}</span>
            <span class="mqa__act-sub">{{ srv?.maintenance ? 'пустить игроков' : 'закрыть вход игрокам' }}</span>
          </button>
          <button v-if="canPower" type="button" class="mqa__act mqa__act--danger" :disabled="busy === 'restart'" @click="restart">
            <span class="mqa__act-title">{{ busy === 'restart' ? 'Перезапускаю…' : 'Перезапустить' }}</span>
            <span class="mqa__act-sub">с сохранением мира</span>
          </button>
        </div>
        <div class="mqa__links">
          <button v-for="l in LINKS" :key="l.to" type="button" class="mqa__link" @click="go(l.to)">{{ l.label }}<span>›</span></button>
          <button type="button" class="mqa__link" @click="open = false; emit('feed')">Лента событий<span>›</span></button>
        </div>
        <button type="button" class="adm-btn mqa__close" @click="open = false">Закрыть</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mqa { display: none; }
@media (max-width: 899px) { .mqa { display: block; } }
.mqa__fab { position: fixed; right: 1rem; bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); z-index: 44; width: 3.3rem; height: 3.3rem; border-radius: 50%; border: 0; background: var(--adm-acc); color: #fff; display: grid; place-items: center; box-shadow: 0 10px 28px rgba(var(--adm-acc-rgb), 0.45); cursor: pointer; }
.mqa__backdrop { position: fixed; inset: 0; z-index: 70; background: rgba(2, 4, 9, 0.6); }
.mqa__sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 71; padding: 0.6rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px)); border-radius: 18px 18px 0 0; background: var(--adm-card-2); border-top: 1px solid var(--adm-line-strong); display: flex; flex-direction: column; gap: 0.8rem; max-height: 85vh; overflow-y: auto; }
.mqa__grip { width: 2.6rem; height: 4px; border-radius: 4px; background: var(--adm-line-strong); align-self: center; }
.mqa__head { display: flex; align-items: center; gap: 0.5rem; color: var(--adm-text); }
.mqa__meta { margin-left: auto; font-size: 0.78rem; color: var(--adm-dim); }
.mqa__big { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.mqa__act { display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-start; padding: 0.9rem; border-radius: 14px; border: 1px solid var(--adm-line-strong); background: var(--adm-card); color: var(--adm-text); font: inherit; text-align: left; cursor: pointer; min-height: 4.6rem; }
.mqa__act:only-child { grid-column: 1 / -1; }
.mqa__act-title { font-weight: 800; font-size: 0.92rem; }
.mqa__act-sub { font-size: 0.74rem; color: var(--adm-dim); }
.mqa__act--on { border-color: rgba(251, 191, 36, 0.5); background: rgba(251, 191, 36, 0.08); }
.mqa__act--danger .mqa__act-title { color: #fca5a5; }
.mqa__act:disabled { opacity: 0.6; }
.mqa__links { display: flex; flex-direction: column; border-radius: 14px; border: 1px solid var(--adm-line); overflow: hidden; }
.mqa__link { display: flex; justify-content: space-between; padding: 0.85rem 0.95rem; border: 0; border-bottom: 1px solid var(--adm-line); background: var(--adm-card); color: var(--adm-text); font: inherit; font-size: 0.88rem; font-weight: 600; text-align: left; cursor: pointer; }
.mqa__link:last-child { border-bottom: 0; }
.mqa__link span { color: var(--adm-dim); }
.mqa__close { align-self: stretch; justify-content: center; }
.mqa-fade-enter-active, .mqa-fade-leave-active { transition: opacity 0.2s; }
.mqa-fade-enter-from, .mqa-fade-leave-to { opacity: 0; }
.mqa-up-enter-active, .mqa-up-leave-active { transition: transform 0.22s ease; }
.mqa-up-enter-from, .mqa-up-leave-to { transform: translateY(100%); }
@media (prefers-reduced-motion: reduce) { .mqa-up-enter-active, .mqa-up-leave-active, .mqa-fade-enter-active, .mqa-fade-leave-active { transition: none; } }
</style>
