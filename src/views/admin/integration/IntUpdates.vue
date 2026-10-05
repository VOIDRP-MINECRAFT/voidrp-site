<script setup>
// «Обновления»: автообновление наших плагинов, обновление командой, уведомления в Telegram,
// состояние секрета после плавной смены.
import { computed, ref } from 'vue'
import { toastError, toastSuccess } from '../../../services/toast'
import { saveIntegrationSettings, saveNotifyPrefs, testDiscord } from '../../../services/integrationApi'
import { copyText, fmtDateTime } from './util'

const props = defineProps({
  data: { type: Object, required: true },
  notify: { type: Object, default: null },
  canConfig: { type: Boolean, default: false },
})
const emit = defineEmits(['reload', 'notify'])

const settings = computed(() => props.data.settings || {})
const perms = computed(() => (props.data.reports || []).find((r) => r.plugin === 'VoidRpPerms'))
const permsSupports = computed(() => {
  const v = (perms.value?.version || '0').split('.').map((x) => parseInt(x, 10) || 0)
  return v[0] > 0 || v[1] >= 6
})
const secret = computed(() => props.data.secret || {})
const webhook = ref(props.data.settings?.discord_webhook || '')
const rw = ref({ ...(props.data.settings?.restart_window || { enabled: false, from: '04:00', to: '06:00' }) })
async function saveWebhook() {
  busy.value = 'hook'
  try { await saveIntegrationSettings({ ...settings.value, discord_webhook: webhook.value.trim() || null }); emit('reload'); toastSuccess(webhook.value.trim() ? 'Вебхук сохранён' : 'Вебхук убран') } catch (e) { toastError(e?.message || 'Не удалось сохранить') } finally { busy.value = '' }
}
async function testWebhook() {
  busy.value = 'hooktest'
  try { await testDiscord(webhook.value.trim()); toastSuccess('Сообщение ушло — посмотрите канал') } catch (e) { toastError(e?.message || 'Discord не принял сообщение') } finally { busy.value = '' }
}
async function saveWindow(patch) {
  rw.value = { ...rw.value, ...patch }
  busy.value = 'rw'
  try { await saveIntegrationSettings({ ...settings.value, restart_window: rw.value }); emit('reload'); toastSuccess('Сохранено') } catch (e) { toastError(e?.message || 'Не удалось сохранить') } finally { busy.value = '' }
}

const busy = ref('')
async function setAuto(patch) {
  busy.value = 'auto'
  try {
    await saveIntegrationSettings({ ...settings.value, ...patch })
    emit('reload')
    toastSuccess(patch.auto_update === false ? 'Автообновление выключено' : 'Сохранено')
  } catch (e) { toastError(e?.message || 'Не удалось сохранить') } finally { busy.value = '' }
}
async function setNotify(patch) {
  if (!props.notify) return
  busy.value = 'notify'
  try {
    const res = await saveNotifyPrefs({ ...props.notify.prefs, ...patch })
    emit('notify', { ...props.notify, ...res })
    toastSuccess('Сохранено')
  } catch (e) { toastError(e?.message || 'Не удалось сохранить') } finally { busy.value = '' }
}
</script>

<template>
  <div class="up">
    <section v-if="secret.previous_until" class="adm-card up-secret">
      <div class="adm-card__head"><div class="adm-card__title">Секрет сервера сменён</div></div>
      <div class="up-pad">
        <p>Старый секрет действует до <b>{{ fmtDateTime(secret.previous_until) }}</b>. VoidRpPerms 0.6.2+ сам вписывает новый в конфиги плагинов VoidRP.</p>
        <p v-if="secret.old_secret_plugins?.length" class="up-warn">Ещё на старом: <b>{{ secret.old_secret_plugins.join(', ') }}</b> — перезапустите сервер до этого времени.</p>
        <p v-else class="up-okline">Все плагины уже на новом секрете.</p>
      </div>
    </section>

    <section class="adm-card">
      <div class="adm-card__head"><div class="adm-card__title">Автообновление</div></div>
      <div class="up-pad">
        <p class="up-muted">VoidRpPerms сам скачивает новые сборки наших плагинов (и проверенные нами версии LuckPerms, GrimAC и других) в <code>plugins/update/</code> и проверяет контрольные суммы. Новая версия встаёт при следующем перезапуске сервера — на ходу ничего не перезагружается.</p>
        <p v-if="perms && !permsSupports" class="up-warn">На сервере VoidRpPerms {{ perms.version }} — автообновление умеет 0.6.0 и новее. Первый раз обновите его вручную или командой ниже.</p>
        <template v-if="canConfig">
          <label class="up-switch">
            <input type="checkbox" :checked="settings.auto_update" :disabled="busy === 'auto'" @change="setAuto({ auto_update: $event.target.checked })" />
            <span class="up-switch__track"><span class="up-switch__thumb" /></span>
            <span><b>Обновлять плагины VoidRP сами</b><br /><span class="up-muted">{{ settings.auto_update ? 'Включено' : 'Выключено' }}</span></span>
          </label>
          <label v-if="settings.auto_update" class="adm-check"><input type="checkbox" :checked="settings.beta" :disabled="busy === 'auto'" @change="setAuto({ beta: $event.target.checked })" /> Брать и бета-сборки</label>
          <div v-if="settings.auto_update" class="up-window">
            <label class="adm-check"><input type="checkbox" :checked="rw.enabled" :disabled="busy === 'rw'" @change="saveWindow({ enabled: $event.target.checked })" /> Перезапускать сервер, чтобы обновления встали сами</label>
            <div v-if="rw.enabled" class="up-window__row">
              <span>когда никого нет, с</span>
              <input class="adm-input up-time" type="time" :value="rw.from" @change="saveWindow({ from: $event.target.value })" />
              <span>до</span>
              <input class="adm-input up-time" type="time" :value="rw.to" @change="saveWindow({ to: $event.target.value })" />
              <span class="up-muted">МСК</span>
            </div>
            <p class="up-muted">Только если хостинг сам запускает остановленный сервер (у большинства панелей так и есть). VoidRpPerms 0.7.0+; не раньше чем через 10 минут после запуска.</p>
          </div>
        </template>
        <p v-else class="up-muted">Включает тот, у кого есть право «Интеграция: скачивать готовые конфиги».</p>
      </div>
    </section>

    <section class="adm-card">
      <div class="adm-card__head"><div class="adm-card__title">Обновить командой</div></div>
      <div class="up-pad">
        <p class="up-muted">Берёт секрет из конфига плагина — ссылка не нужна, можно поставить в cron. Добавьте <code>-s -- --dry-run</code>, чтобы только посмотреть, что обновится.</p>
        <div class="up-cmd"><code>{{ data.scripts?.update }}</code><button class="adm-btn adm-btn--sm" @click="copyText(data.scripts?.update)">Копировать</button></div>
      </div>
    </section>

    <section class="adm-card">
      <div class="adm-card__head"><div class="adm-card__title">Discord</div></div>
      <div class="up-pad">
        <p class="up-muted">Вебхук канала вашего Discord: туда придут новые версии плагинов VoidRP, сбои и восстановление сервера, смена секрета. Создаётся в настройках канала → «Интеграция» → «Вебхуки».</p>
        <template v-if="canConfig">
          <input v-model="webhook" class="adm-input" placeholder="https://discord.com/api/webhooks/…" />
          <div class="up-row">
            <button class="adm-btn adm-btn--sm adm-btn--acc" :disabled="busy === 'hook'" @click="saveWebhook">Сохранить</button>
            <button class="adm-btn adm-btn--sm" :disabled="!webhook.trim() || busy === 'hooktest'" @click="testWebhook">Проверить</button>
            <span v-if="settings.discord_webhook" class="up-okline up-small">подключён</span>
          </div>
        </template>
        <p v-else class="up-muted">Настраивает тот, у кого есть право «Интеграция: скачивать готовые конфиги».</p>
      </div>
    </section>

    <section v-if="notify" class="adm-card">
      <div class="adm-card__head"><div class="adm-card__title">Уведомления в Telegram</div></div>
      <div class="up-pad">
        <p v-if="notify.platform_admin" class="up-muted">Вы админ платформы и видите все серверы — вам приходит плашка в админке, а сообщения в Telegram получают те, кто ведёт этот сервер.</p>
        <template v-else>
          <p v-if="notify.telegram_linked" class="up-okline">Telegram привязан<template v-if="notify.telegram_username"> (@{{ notify.telegram_username }})</template>. @voidrp_bot напишет о новых версиях наших плагинов для этого сервера и о том, что сервер перестал отвечать.</p>
          <p v-else class="up-warn">Telegram не привязан. Напишите <a href="https://t.me/voidrp_bot" target="_blank" rel="noopener">@voidrp_bot</a> команду /start и откройте ссылку из ответа — уведомления начнут приходить сами.</p>
          <div class="up-row">
            <span class="up-label">О новых версиях</span>
            <div class="adm-tabs">
              <button v-for="o in [['all', 'все'], ['important', 'только важные'], ['none', 'не присылать']]" :key="o[0]" class="adm-tab" :class="{ 'adm-tab--active': notify.prefs.releases === o[0] }" :disabled="busy === 'notify'" @click="setNotify({ releases: o[0] })">{{ o[1] }}</button>
            </div>
          </div>
          <label class="adm-check"><input type="checkbox" :checked="notify.prefs.beta" :disabled="busy === 'notify'" @change="setNotify({ beta: $event.target.checked })" /> О бета-сборках тоже</label>
          <label class="adm-check"><input type="checkbox" :checked="notify.prefs.health" :disabled="busy === 'notify'" @change="setNotify({ health: $event.target.checked })" /> Когда вход или мониторинг перестали отвечать (и когда снова заработали)</label>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.up { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); gap: 1rem; align-items: start; }
.up-secret { grid-column: 1 / -1; border-color: color-mix(in srgb, var(--adm-warn) 45%, var(--adm-line)); }
.up-pad { padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.up-pad p { margin: 0; font-size: 0.86rem; color: var(--adm-text); line-height: 1.5; }
.up-muted { color: var(--adm-dim) !important; font-size: 0.82rem !important; }
.up-warn { color: var(--adm-warn) !important; }
.up-okline { color: var(--adm-ok) !important; }
.up a { color: var(--adm-acc-text); }
.up code { font-family: var(--adm-mono); font-size: 0.8em; background: var(--adm-card-2); padding: 0.05rem 0.3rem; border-radius: 4px; }
.up-cmd { display: flex; gap: 0.5rem; align-items: center; }
.up-cmd code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; padding: 0.5rem 0.65rem; border: 1px solid var(--adm-line); border-radius: var(--adm-r-sm); color: var(--adm-text); }
.up-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.up-label { font-size: 0.86rem; color: var(--adm-text); }

.up-window { display: flex; flex-direction: column; gap: 0.45rem; padding-left: 0.2rem; }
.up-window__row { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; font-size: 0.84rem; color: var(--adm-text); }
.up-time { width: 7rem; }
.up-small { font-size: 0.78rem !important; }
.up-switch { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; font-size: 0.88rem; color: var(--adm-text); }
.up-switch input { position: absolute; opacity: 0; pointer-events: none; }
.up-switch__track { flex-shrink: 0; width: 2.6rem; height: 1.45rem; border-radius: 999px; background: var(--adm-card-2); border: 1px solid var(--adm-line-strong); position: relative; transition: background 0.15s; }
.up-switch__thumb { position: absolute; top: 2px; left: 2px; width: calc(1.45rem - 6px); height: calc(1.45rem - 6px); border-radius: 999px; background: var(--adm-dim); transition: transform 0.15s, background 0.15s; }
.up-switch input:checked + .up-switch__track { background: var(--adm-acc-soft); border-color: var(--adm-acc-line); }
.up-switch input:checked + .up-switch__track .up-switch__thumb { transform: translateX(1.15rem); background: var(--adm-acc); }
.up-switch input:disabled + .up-switch__track { opacity: 0.6; }
</style>
