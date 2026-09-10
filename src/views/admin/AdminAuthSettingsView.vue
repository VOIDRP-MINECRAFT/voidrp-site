<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { authState } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { getAuthSettings, updateAuthSettings } from '../../services/adminServersApi'
import { toastError, toastSuccess } from '../../services/toast'

// Every field here used to live somewhere that required a deploy to change:
// the ticket TTL in the backend .env, the rest as -Dvoidrp.auth.* JVM flags in
// youer.service. They are now per-server rows the auth-bridge mod polls, so a
// change applies within seconds without restarting anything.
const FIELDS = [
  {
    key: 'play_ticket_expire_minutes',
    label: 'Срок жизни тикета лаунчера',
    unit: 'мин',
    hint: 'Сколько живёт пропуск, который лаунчер выдаёт на вход. Истёк — игрок жмёт «Играть» заново.',
    applies: 'Действует сразу — на все новые тикеты.',
  },
  {
    key: 'auth_grace_seconds',
    label: 'Время на авторизацию',
    unit: 'сек',
    hint: 'Сколько игрок может стоять на сервере неавторизованным, прежде чем его кикнет.',
    applies: 'Действует сразу — в том числе на тех, кто уже ждёт.',
    zeroMeans: 'Безлимитный вход — не кикать вообще',
  },
  {
    key: 'request_timeout_ms',
    label: 'Таймаут запроса к бэкенду',
    unit: 'мс',
    hint: 'Сколько мод ждёт ответа от сайта при проверке аккаунта. Мало — кики на лагах сети, много — долгий вход при недоступном бэкенде.',
    applies: 'Действует со следующего запроса.',
  },
  {
    key: 'reconnect_grant_minutes',
    label: 'Окно переподключения',
    unit: 'мин',
    hint: 'Сколько после вылета можно вернуться без повторного входа через лаунчер. Важно при крашах и зависаниях сохранения.',
    applies: 'Действует сразу — на все новые вылеты.',
  },
]

const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const form = ref({})
const saved = ref({})
const defaults = ref({})
const bounds = ref({})

const serverId = computed(() => activeServer.value?.id || null)
const serverName = computed(() => activeServer.value?.name || 'сервер')

const dirty = computed(() =>
  FIELDS.some((f) => Number(form.value[f.key]) !== Number(saved.value[f.key])),
)

const isDefault = computed(() =>
  FIELDS.every((f) => Number(form.value[f.key]) === Number(defaults.value[f.key])),
)

function boundsFor(key) {
  const b = bounds.value[key]
  return { min: b?.[0] ?? 0, max: b?.[1] ?? 999999 }
}

function fieldError(key) {
  const raw = form.value[key]
  if (raw === '' || raw === null || raw === undefined) return 'Укажи значение'
  const value = Number(raw)
  if (!Number.isFinite(value) || !Number.isInteger(value)) return 'Только целое число'
  const { min, max } = boundsFor(key)
  if (value < min || value > max) return `Допустимо от ${min} до ${max}`
  return ''
}

const hasErrors = computed(() => FIELDS.some((f) => fieldError(f.key)))

async function load() {
  if (!serverId.value) return
  loading.value = true
  loadError.value = ''
  try {
    const data = await getAuthSettings(authState.accessToken, serverId.value)
    saved.value = { ...data.settings }
    form.value = { ...data.settings }
    defaults.value = { ...data.defaults }
    bounds.value = { ...data.bounds }
  } catch (e) {
    loadError.value = e?.message || 'Не удалось загрузить настройки'
  } finally {
    loading.value = false
  }
}

async function save() {
  if (hasErrors.value || !serverId.value) return
  saving.value = true
  try {
    const payload = {}
    FIELDS.forEach((f) => {
      payload[f.key] = Number(form.value[f.key])
    })
    const data = await updateAuthSettings(authState.accessToken, serverId.value, payload)
    saved.value = { ...data.settings }
    form.value = { ...data.settings }
    toastSuccess('Настройки применены — сервер подхватит их в течение 10 секунд')
  } catch (e) {
    toastError(e?.message || 'Не удалось сохранить')
  } finally {
    saving.value = false
  }
}

function reset() {
  form.value = { ...saved.value }
}

function applyDefaults() {
  form.value = { ...defaults.value }
}

onMounted(load)
watch(serverId, load)
</script>

<template>
  <div class="adm-page">
    <div class="adm-page__head">
      <div>
        <h1 class="adm-title">Авторизация</h1>
        <p class="adm-sub">Таймауты входа для «{{ serverName }}». Применяются на лету, без перезапуска.</p>
      </div>
      <div class="adm-head-actions">
        <button class="adm-btn adm-btn--ghost" :disabled="loading || saving" @click="load">Обновить</button>
        <button class="adm-btn adm-btn--ghost" :disabled="loading || saving || isDefault" @click="applyDefaults">
          Вернуть стандартные
        </button>
      </div>
    </div>

    <div v-if="loadError" class="adm-card adm-card--pad auth-error">
      {{ loadError }}
    </div>

    <div v-else-if="loading && !Object.keys(saved).length" class="adm-skel auth-skel" />

    <template v-else>
      <div class="auth-grid">
        <div v-for="f in FIELDS" :key="f.key" class="adm-card adm-card--pad auth-field">
          <label class="adm-label" :for="`auth-${f.key}`">{{ f.label }}</label>
          <p class="auth-hint">{{ f.hint }}</p>

          <div class="auth-input-row">
            <input
              :id="`auth-${f.key}`"
              v-model="form[f.key]"
              class="adm-input auth-input"
              type="number"
              inputmode="numeric"
              :min="boundsFor(f.key).min"
              :max="boundsFor(f.key).max"
            />
            <span class="auth-unit">{{ f.unit }}</span>
          </div>

          <p v-if="fieldError(f.key)" class="auth-err">{{ fieldError(f.key) }}</p>
          <p v-else-if="f.zeroMeans && Number(form[f.key]) === 0" class="auth-zero">
            {{ f.zeroMeans }}
          </p>
          <p v-else class="auth-applies">{{ f.applies }}</p>

          <p class="auth-meta">
            Стандартно: {{ defaults[f.key] }} {{ f.unit }} · допустимо
            {{ boundsFor(f.key).min }}–{{ boundsFor(f.key).max }}
          </p>
        </div>
      </div>

      <div class="auth-bar" :class="{ 'auth-bar--dirty': dirty }">
        <span v-if="dirty" class="auth-bar__note">Есть несохранённые изменения</span>
        <span v-else class="auth-bar__note auth-bar__note--calm">Всё сохранено</span>
        <div class="auth-bar__actions">
          <button class="adm-btn adm-btn--ghost" :disabled="!dirty || saving" @click="reset">Отменить</button>
          <button class="adm-btn adm-btn--acc" :disabled="!dirty || saving || hasErrors" @click="save">
            {{ saving ? 'Сохраняю…' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.auth-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-hint {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--adm-dim);
}

.auth-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.auth-input {
  max-width: 140px;
}

.auth-unit {
  font-size: 13px;
  color: var(--adm-dim);
}

.auth-err {
  margin: 0;
  font-size: 12.5px;
  color: #f87171;
}

.auth-zero {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: #fbbf24;
}

.auth-applies {
  margin: 0;
  font-size: 12.5px;
  color: var(--adm-dim);
}

.auth-meta {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--adm-dim);
  opacity: 0.75;
}

.auth-bar {
  position: sticky;
  bottom: 12px;
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--adm-line);
  border-radius: var(--adm-r);
  background: var(--adm-card);
}

.auth-bar--dirty {
  border-color: var(--adm-acc-line);
}

.auth-bar__note {
  font-size: 13px;
  color: #fbbf24;
}

.auth-bar__note--calm {
  color: var(--adm-dim);
}

.auth-bar__actions {
  display: flex;
  gap: 8px;
}

.auth-error {
  color: #f87171;
}

.auth-skel {
  height: 220px;
}
</style>
