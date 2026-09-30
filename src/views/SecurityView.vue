<script setup>
// «Безопасность»: двухфакторная защита и активные входы — как в Telegram.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { authState } from '../stores/authStore'
import { confirmDialog } from '../composables/useConfirm'
import { toastError, toastSuccess } from '../services/toast'
import { disableMfa, endDevice, endOtherDevices, getMfaStatus, listDevices, newBackupCodes } from '../services/securityApi'
import MfaSetup from '../components/security/MfaSetup.vue'
import BackupCodes from '../components/security/BackupCodes.vue'
import { deletePasskey, renamePasskey } from '../services/securityApi'
import { passkeysSupported, registerPasskey } from '../services/passkeys'

const { t, locale } = useI18n()
const token = () => authState.accessToken
const status = ref(null)
const devices = ref([])
const loading = ref(true)
const setup = ref(null)        // null | 'totp' | 'telegram'
const codes = ref(null)

const current = computed(() => devices.value.find((d) => d.current))
const others = computed(() => devices.value.filter((d) => !d.current))

async function load() {
  loading.value = !status.value
  try {
    const [st, dv] = await Promise.all([getMfaStatus(token()), listDevices(token())])
    status.value = st
    devices.value = dv.items || []
  } finally {
    loading.value = false
  }
}
onMounted(load)

function ago(iso) {
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

async function end(d) {
  await endDevice(token(), d.id)
  toastSuccess(t('security.devices.ended'))
  await load()
}
async function endOthers() {
  const ok = await confirmDialog({ title: t('security.devices.endOthers'), message: t('security.devices.endOthersConfirm'), confirmLabel: t('security.devices.endOthers'), danger: true })
  if (!ok) return
  const res = await endOtherDevices(token())
  toastSuccess(t('security.devices.endedMany', { n: res.ended }))
  await load()
}
async function turnOff(method) {
  try {
    status.value = await disableMfa(token(), method)
    toastSuccess(t('security.mfa.disabled'))
  } catch { /* toast / password dialog shown already */ }
}
async function regenerate() {
  try {
    const res = await newBackupCodes(token())
    codes.value = res.backup_codes
  } catch { /* shown already */ }
}
const canPasskey = passkeysSupported()
const keyBusy = ref(false)
async function addKey() {
  keyBusy.value = true
  try {
    const res = await registerPasskey()
    if (!res) return
    toastSuccess(t('security.mfa.passkeyAdded'))
    if (res.backup_codes?.length) codes.value = res.backup_codes
    await load()
  } catch (e) {
    if (!e?.securityCode) toastError(e?.message || 'Error')
  } finally {
    keyBusy.value = false
  }
}
const renaming = ref(null)   // { id, name }
async function saveName() {
  const r = renaming.value
  renaming.value = null
  if (!r || !r.name.trim()) return
  try { status.value = await renamePasskey(token(), r.id, r.name.trim()) } catch { /* shown already */ }
}
async function removeKey(k) {
  try {
    status.value = await deletePasskey(token(), k.id)
    toastSuccess(t('security.mfa.passkeyDeleted'))
  } catch { /* shown already */ }
}

function onSetupDone() {
  setup.value = null
  load()
}
</script>

<template>
  <div class="sec-page">
    <header class="sec-head">
      <RouterLink to="/profile" class="sec-back">← {{ t('profile.hello') }}</RouterLink>
      <h1>{{ t('security.title') }}</h1>
      <p>{{ t('security.sub') }}</p>
    </header>

    <div v-if="loading" class="sec-skel" />

    <template v-else-if="status">
      <!-- 2FA -->
      <section class="sec-card">
        <div class="sec-card__head">
          <div>
            <h2>{{ t('security.mfa.title') }}</h2>
            <p>{{ t('security.mfa.desc') }}</p>
          </div>
          <span class="sec-state" :class="status.enabled ? 'sec-state--on' : 'sec-state--off'">
            {{ status.enabled ? t('security.mfa.on') : t('security.mfa.off') }}
          </span>
        </div>
        <p v-if="status.required && !status.enabled" class="sec-warn">{{ t('security.mfa.requiredStaff') }}</p>

        <div v-if="setup" class="sec-setup">
          <MfaSetup :only="setup" @done="onSetupDone" />
          <button type="button" class="sec-link" @click="setup = null">{{ t('security.mfa.cancel') }}</button>
        </div>
        <div v-else-if="codes" class="sec-setup">
          <BackupCodes :codes="codes" @done="codes = null; load()" />
        </div>
        <ul v-else class="sec-methods">
          <li class="sec-m--keys">
            <span class="sec-m__ico sec-m__ico--key"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 11c0 3-1 6-3 8M8 5.5A7 7 0 0 1 19 11c0 1.3-.1 2.6-.4 3.8M5 9.5A7 7 0 0 0 5 12c0 2-.5 3.8-1.4 5.3"/><path d="M15.5 12.5c0 2.8-.7 5.3-2 7.5M12 8a3 3 0 0 0-3 3c0 1.9-.3 3.6-1 5.2"/></svg></span>
            <span class="sec-m__txt">
              <b>{{ t('security.mfa.passkeys') }}</b>
              <small>{{ canPasskey ? t('security.mfa.passkeyDesc') : t('security.mfa.passkeyUnsupported') }}</small>
              <span v-for="k in status.passkeys" :key="k.id" class="sec-key">
                <input
                  v-if="renaming?.id === k.id" v-model="renaming.name" class="sec-key__input" maxlength="80" autofocus
                  @keydown.enter.prevent="saveName" @keydown.esc="renaming = null" @blur="saveName"
                />
                <button v-else type="button" class="sec-key__name" :title="t('security.mfa.rename')" @click="renaming = { id: k.id, name: k.name }">
                  {{ k.name }}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/></svg>
                </button>
                <span class="sec-key__meta">{{ k.last_used_at ? t('security.mfa.passkeyUsed', { when: ago(k.last_used_at) }) : t('security.mfa.passkeyCreated', { when: ago(k.created_at) }) }}<template v-if="k.synced"> · {{ t('security.mfa.passkeySynced') }}</template></span>
                <button type="button" class="sec-link sec-key__rm" @click="removeKey(k)">{{ t('security.mfa.remove') }}</button>
              </span>
            </span>
            <button type="button" class="sec-btn" :disabled="!canPasskey || keyBusy" @click="addKey">{{ t('security.mfa.passkeyAdd') }}</button>
          </li>
          <li>
            <span class="sec-m__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg></span>
            <span class="sec-m__txt"><b>{{ t('security.mfa.app') }}</b><small>{{ t('security.mfa.appDesc') }}</small></span>
            <button v-if="!status.totp" type="button" class="sec-btn" @click="setup = 'totp'">{{ t('security.mfa.enable') }}</button>
            <button v-else type="button" class="sec-btn sec-btn--ghost" @click="turnOff('totp')">{{ t('security.mfa.disable') }}</button>
          </li>
          <li>
            <span class="sec-m__ico sec-m__ico--tg"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.3 2.9 11.5c-1 .4-1 1.8.1 2.1l4.6 1.4 1.7 5.4c.2.7 1.1.9 1.6.4l2.6-2.4 4.7 3.4c.6.4 1.4.1 1.6-.6L22.9 5.6c.2-.9-.6-1.6-1.4-1.3Z"/></svg></span>
            <span class="sec-m__txt"><b>{{ t('security.mfa.telegram') }}</b><small>{{ status.telegram_linked ? t('security.mfa.telegramDesc') : t('security.mfa.telegramNotLinked') }}</small></span>
            <button v-if="!status.telegram" type="button" class="sec-btn" :disabled="!status.telegram_linked" @click="setup = 'telegram'">{{ t('security.mfa.enable') }}</button>
            <button v-else type="button" class="sec-btn sec-btn--ghost" @click="turnOff('telegram')">{{ t('security.mfa.disable') }}</button>
          </li>
          <li v-if="status.enabled">
            <span class="sec-m__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7M17 6l2.5 2.5M14.5 8.5 16 10"/></svg></span>
            <span class="sec-m__txt"><b>{{ t('security.mfa.backup') }}</b><small>{{ t('security.mfa.backupDesc') }} · {{ t('security.mfa.backupLeft', { n: status.backup_left }) }}</small></span>
            <button type="button" class="sec-btn sec-btn--ghost" @click="regenerate">{{ t('security.mfa.regenerate') }}</button>
          </li>
        </ul>
      </section>

      <!-- Активные входы -->
      <section class="sec-card">
        <div class="sec-card__head">
          <div>
            <h2>{{ t('security.devices.title') }}</h2>
            <p>{{ t('security.devices.sub') }}</p>
          </div>
          <button v-if="others.length" type="button" class="sec-btn sec-btn--danger" @click="endOthers">{{ t('security.devices.endOthers') }}</button>
        </div>
        <ul class="sec-devices">
          <li v-for="d in [current, ...others].filter(Boolean)" :key="d.id" class="sec-dev" :class="{ 'sec-dev--current': d.current }">
            <span class="sec-dev__ico" :data-kind="d.kind" aria-hidden="true">
              <svg v-if="d.kind === 'mobile' || d.kind === 'tablet'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>
              <svg v-else-if="d.kind === 'app'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m3 7 9 5 9-5M12 12v10"/></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </span>
            <span class="sec-dev__main">
              <b>{{ d.title }}</b>
              <span class="sec-dev__meta">
                {{ d.location || t('security.devices.unknownPlace') }}<template v-if="d.ip"> · {{ d.ip }}</template>
              </span>
              <span class="sec-dev__meta">
                <template v-if="d.current">{{ t('security.devices.current') }}</template>
                <template v-else>{{ t('security.devices.lastSeen', { when: ago(d.last_seen_at) }) }}</template>
                · {{ t('security.devices.signedIn', { when: ago(d.created_at) }) }}
                <template v-if="d.first_location && d.first_location !== d.location"> · {{ t('security.devices.firstFrom', { place: d.first_location }) }}</template>
                <span v-if="d.mfa" class="sec-dev__tag">{{ t('security.devices.admin') }}</span>
              </span>
            </span>
            <button v-if="!d.current" type="button" class="sec-btn sec-btn--ghost" @click="end(d)">{{ t('security.devices.end') }}</button>
          </li>
        </ul>
        <p v-if="!others.length" class="sec-none">{{ t('security.devices.none') }}</p>
        <p class="sec-geo">{{ t('security.devices.geo') }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.sec-page { max-width: 760px; margin: 0 auto; padding: 2rem 16px 4rem; display: flex; flex-direction: column; gap: 1.1rem; color: #e8ecf4; }
.sec-head h1 { margin: 0.4rem 0 0.3rem; font-size: 1.7rem; font-weight: 900; }
.sec-head p { margin: 0; color: #94a0b8; font-size: 0.9rem; }
.sec-back { color: #94a0b8; font-size: 0.82rem; text-decoration: none; }
.sec-back:hover { color: #e8ecf4; }
.sec-skel { height: 320px; border-radius: 18px; background: linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06), rgba(255,255,255,0.03)); }
.sec-card { padding: 1.3rem 1.3rem 1.1rem; border-radius: 18px; background: rgba(12, 16, 30, 0.8); border: 1px solid rgba(148, 163, 184, 0.14); }
.sec-card__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.sec-card h2 { margin: 0 0 0.25rem; font-size: 1.08rem; font-weight: 800; }
.sec-card__head p { margin: 0; font-size: 0.82rem; color: #94a0b8; line-height: 1.5; max-width: 34rem; }
.sec-state { font-size: 0.74rem; font-weight: 800; padding: 0.25rem 0.65rem; border-radius: 999px; white-space: nowrap; }
.sec-state--on { color: #34d399; background: rgba(52, 211, 153, 0.12); }
.sec-state--off { color: #fbbf24; background: rgba(251, 191, 36, 0.12); }
.sec-warn { margin: 0 0 0.9rem; padding: 0.6rem 0.8rem; border-radius: 10px; font-size: 0.8rem; color: #fcd34d; background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); }
.sec-methods { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.sec-methods li { display: flex; align-items: center; gap: 0.8rem; padding: 0.75rem 0; border-top: 1px solid rgba(148, 163, 184, 0.08); }
.sec-m__ico { width: 2.2rem; height: 2.2rem; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(124, 58, 237, 0.14); color: #a78bfa; }
.sec-m__ico svg { width: 1.1rem; height: 1.1rem; }
.sec-m__ico--key { background: rgba(52, 211, 153, 0.14); color: #34d399; }
.sec-methods li.sec-m--keys { align-items: flex-start; }
.sec-key { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.35rem; padding: 0.35rem 0.55rem; border-radius: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(148, 163, 184, 0.1); }
.sec-key__name { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0; border: none; background: none; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #e8ecf4; }
.sec-key__name svg { width: 0.7rem; height: 0.7rem; opacity: 0.4; }
.sec-key__name:hover svg { opacity: 0.9; }
.sec-key__input { font-size: 0.8rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 6px; border: 1px solid #7c3aed; background: rgba(0, 0, 0, 0.35); color: #e8ecf4; min-width: 10rem; }
.sec-key__meta { font-size: 0.7rem; color: #7d879c; flex: 1; }
.sec-key__rm { font-size: 0.72rem; color: #fca5a5; }
.sec-m__ico--tg { background: rgba(42, 171, 238, 0.14); color: #2aabee; }
.sec-m__txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.sec-m__txt b { font-size: 0.9rem; }
.sec-m__txt small { font-size: 0.74rem; color: #7d879c; line-height: 1.4; }
.sec-setup { display: flex; flex-direction: column; gap: 0.8rem; padding-top: 0.4rem; }
.sec-btn { padding: 0.5rem 0.9rem; border-radius: 9px; border: none; background: #7c3aed; color: #fff; font-weight: 700; font-size: 0.8rem; cursor: pointer; white-space: nowrap; }
.sec-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.sec-btn--ghost { background: transparent; color: #cbd2e0; border: 1px solid rgba(148, 163, 184, 0.25); }
.sec-btn--danger { background: rgba(248, 113, 113, 0.1); color: #fca5a5; border: 1px solid rgba(248, 113, 113, 0.35); }
.sec-link { align-self: flex-start; background: none; border: none; color: #94a0b8; font-size: 0.8rem; cursor: pointer; padding: 0; }
.sec-devices { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.sec-dev { display: flex; align-items: center; gap: 0.85rem; padding: 0.8rem 0.9rem; border-radius: 13px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(148, 163, 184, 0.1); }
.sec-dev--current { border-color: rgba(124, 58, 237, 0.4); background: rgba(124, 58, 237, 0.07); }
.sec-dev__ico { width: 2.5rem; height: 2.5rem; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(148, 163, 184, 0.1); color: #cbd2e0; }
.sec-dev__ico[data-kind="app"] { background: rgba(124, 58, 237, 0.16); color: #a78bfa; }
.sec-dev__ico svg { width: 1.25rem; height: 1.25rem; }
.sec-dev__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.12rem; }
.sec-dev__main b { font-size: 0.9rem; }
.sec-dev__meta { font-size: 0.76rem; color: #8a94aa; overflow-wrap: anywhere; }
.sec-dev--current .sec-dev__meta:last-child { color: #c4b5fd; }
.sec-dev__tag { display: inline-block; margin-left: 0.35rem; padding: 0 0.4rem; border-radius: 999px; font-size: 0.66rem; font-weight: 700; color: #34d399; background: rgba(52, 211, 153, 0.12); }
.sec-none { margin: 0.6rem 0 0; font-size: 0.8rem; color: #7d879c; }
.sec-geo { margin: 0.9rem 0 0; font-size: 0.68rem; color: #55617a; }
@media (max-width: 520px) { .sec-dev { flex-wrap: wrap; } .sec-dev .sec-btn { margin-left: 3.35rem; } }
</style>
