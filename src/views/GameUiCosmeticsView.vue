<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../assets/gui-premium.css'
import { getCosmetics, promoteCosmetic, equipCosmetic, unequipCosmetic, deleteCosmetic, setWebguiToken } from '../services/gameUiApi.js'
import { toastSuccess, toastError } from '../services/toast'
import { useWebGuiToken } from '../composables/useWebGui.js'
import GameUiSidebar from '../components/GameUiSidebar.vue'
import GameUiStarfield from '../components/GameUiStarfield.vue'
import GameUiTopBar from '../components/GameUiTopBar.vue'
import GuiIcon from '../components/GuiIcon.vue'

const { t } = useI18n()
setWebguiToken(useWebGuiToken())

const loading = ref(true)
const error = ref(null)
const cosmetics = ref([])
const myAvatars = ref([])
const equipped = ref([])
const busy = ref('')
const promoteName = ref({})   // avatarId -> name input

function isEquipped(id) { return equipped.value.includes(id) }

async function load() {
  loading.value = true
  try {
    const d = await getCosmetics()
    cosmetics.value = d.cosmetics || []
    myAvatars.value = d.my_avatars || []
    equipped.value = d.equipped || []
    error.value = null
  } catch (e) { error.value = e?.message || 'error' } finally { loading.value = false }
}
async function doEquip(c) {
  if (busy.value) return
  busy.value = c.id
  try { await equipCosmetic(c.id); equipped.value = [c.id]; toastSuccess(t('gameUiCosmetics.equipped', { n: c.name })) }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
async function doUnequip() {
  if (busy.value) return
  busy.value = 'unequip'
  try { await unequipCosmetic(); equipped.value = []; toastSuccess(t('gameUiCosmetics.unequipped')) }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
async function doPromote(a) {
  const name = (promoteName.value[a.id] || '').trim()
  if (!name) { toastError(t('gameUiCosmetics.needName')); return }
  if (busy.value) return
  busy.value = a.id
  try { await promoteCosmetic(a.id, name); promoteName.value[a.id] = ''; toastSuccess(t('gameUiCosmetics.promoted', { n: name })); await load() }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
async function doDelete(c) {
  if (busy.value) return
  busy.value = c.id
  try { await deleteCosmetic(c.id); cosmetics.value = cosmetics.value.filter((x) => x.id !== c.id); equipped.value = equipped.value.filter((x) => x !== c.id) }
  catch (e) { toastError(e?.message || 'Ошибка') } finally { busy.value = '' }
}
function kb(n) { return `${Math.max(1, Math.round(n / 1024))} KB` }

onMounted(load)
</script>

<template>
  <section class="gp-shell">
    <GameUiStarfield />
    <GameUiSidebar current="cosmetics" />
    <GameUiTopBar :title="t('gameUiCosmetics.title')" />

    <div class="gp-wrap gp-wrap--app">
      <div v-if="loading" class="gp-center"><span class="gp-spinner"></span></div>
      <div v-else-if="error" class="gp-center"><div class="gp-card gp-state"><span class="gp-state-ico"><GuiIcon name="alert" :size="30" /></span><span class="gp-state-text">{{ error }}</span></div></div>

      <template v-else>
        <div class="gp-panel co-intro">
          <span class="co-badge">ADMIN</span>
          <span class="co-intro-tx">{{ t('gameUiCosmetics.intro') }}</span>
        </div>

        <!-- cosmetics catalog -->
        <div class="gp-panel">
          <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="star" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiCosmetics.catalog') }}</span><span class="gp-phead-sp"></span><span class="co-count">{{ cosmetics.length }}</span></div>
          <div v-if="!cosmetics.length" class="co-empty">{{ t('gameUiCosmetics.emptyCatalog') }}</div>
          <div v-else class="co-grid">
            <div v-for="c in cosmetics" :key="c.id" class="co-card" :class="{ on: isEquipped(c.id) }">
              <div class="co-card-ic"><GuiIcon name="user" :size="26" /></div>
              <div class="co-card-info">
                <div class="co-card-name">{{ c.name }}</div>
                <div class="co-card-sub">{{ kb(c.size_bytes) }}</div>
              </div>
              <div class="co-card-btns">
                <button v-if="!isEquipped(c.id)" class="co-eq" :disabled="busy === c.id" @click="doEquip(c)">{{ t('gameUiCosmetics.equip') }}</button>
                <button v-else class="co-uneq" :disabled="busy === 'unequip'" @click="doUnequip">{{ t('gameUiCosmetics.unequip') }}</button>
                <button class="co-del" :disabled="busy === c.id" :title="t('gameUiCosmetics.delete')" @click="doDelete(c)">✕</button>
              </div>
            </div>
          </div>
        </div>

        <!-- my figura avatars → promote to cosmetic -->
        <div class="gp-panel">
          <div class="gp-phead"><span class="gp-phead-ic"><GuiIcon name="package" :size="16" /></span><span class="gp-phead-tt">{{ t('gameUiCosmetics.mine') }}</span></div>
          <p class="co-hint">{{ t('gameUiCosmetics.mineHint') }}</p>
          <div v-if="!myAvatars.length" class="co-empty">{{ t('gameUiCosmetics.emptyMine') }}</div>
          <div v-else class="co-mine">
            <div v-for="a in myAvatars" :key="a.id" class="co-mine-row">
              <div class="co-mine-ic"><GuiIcon name="user" :size="22" /></div>
              <div class="co-mine-name">{{ a.id }} <span class="co-mine-sub">{{ kb(a.size_bytes) }}</span></div>
              <input v-model="promoteName[a.id]" class="co-mine-in" :placeholder="t('gameUiCosmetics.namePh')" maxlength="48" @keyup.enter="doPromote(a)" />
              <button class="co-promote" :disabled="busy === a.id" @click="doPromote(a)"><GuiIcon name="plus" :size="13" />{{ t('gameUiCosmetics.promote') }}</button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.gp-wrap--app { display: flex; flex-direction: column; gap: 16px; }
.co-intro { display: flex; align-items: center; gap: 12px; }
.co-badge { font-size: 0.62rem; font-weight: 900; letter-spacing: 0.08em; color: #fbbf24; background: rgba(251,191,36,0.14); border: 1px solid rgba(251,191,36,0.4); padding: 3px 8px; border-radius: 7px; }
.co-intro-tx { font-size: 0.82rem; color: #aeb9d6; }
.co-count { font-size: 0.72rem; font-weight: 800; color: #c4b5fd; }
.co-empty { padding: 20px; text-align: center; font-size: 0.82rem; color: #8a90a8; }
.co-hint { font-size: 0.74rem; color: #9aa3bf; margin: 8px 0 4px; line-height: 1.4; }

.co-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 10px; }
.co-card { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--gp-line); }
.co-card.on { border-color: rgba(52,211,153,0.5); background: rgba(52,211,153,0.06); }
.co-card-ic { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; background: rgba(139,123,255,0.12); color: #c4b5fd; flex-shrink: 0; }
.co-card-info { flex: 1; min-width: 0; }
.co-card-name { font-size: 0.86rem; font-weight: 800; color: #eef2ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.co-card-sub { font-size: 0.66rem; color: #8a90a8; margin-top: 1px; }
.co-card-btns { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.co-eq { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(139,123,255,0.5); background: rgba(139,123,255,0.14); color: #d8ccff; font-weight: 800; font-size: 0.74rem; cursor: pointer; }
.co-uneq { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(52,211,153,0.45); background: rgba(52,211,153,0.12); color: #6ee7b7; font-weight: 800; font-size: 0.74rem; cursor: pointer; }
.co-del { width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--gp-line); background: rgba(255,255,255,0.03); color: #aeb9d6; cursor: pointer; font-weight: 800; }
.co-del:hover { background: rgba(251,113,133,0.14); color: #fb7185; }
.co-eq:disabled, .co-uneq:disabled, .co-del:disabled, .co-promote:disabled { opacity: 0.5; cursor: default; }

.co-mine { display: flex; flex-direction: column; gap: 7px; margin-top: 8px; }
.co-mine-row { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--gp-line); }
.co-mine-ic { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; background: rgba(0,0,0,0.3); color: #aeb9d6; flex-shrink: 0; }
.co-mine-name { flex: 1; min-width: 0; font-size: 0.82rem; font-weight: 700; color: #d5dcf0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.co-mine-sub { font-size: 0.64rem; color: #8a90a8; font-weight: 500; }
.co-mine-in { width: 150px; padding: 7px 10px; border-radius: 9px; background: rgba(0,0,0,0.32); border: 1px solid rgba(167,139,250,0.35); color: #eef2ff; font-size: 0.8rem; outline: none; flex-shrink: 0; }
.co-mine-in:focus { border-color: rgba(167,139,250,0.7); }
.co-promote { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border-radius: 9px; border: none; background: linear-gradient(135deg, #6d5cf0, #b45cf0); color: #fff; font-weight: 800; font-size: 0.76rem; cursor: pointer; flex-shrink: 0; }
</style>
