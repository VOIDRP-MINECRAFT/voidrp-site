<script setup>
// «Моды и плагины» of the selected server: which sections show depends on the server —
// mods (client pack and/or server mods/) and plugins (plugins/). The queue of jar
// changes (ServerChangesBar) is shared by both.
import { computed, onMounted, ref } from 'vue'
import { hasPermission, authState } from '../../stores/authStore'
import { activeServer } from '../../stores/serverStore'
import { getMods } from '../../services/adminModsApi'
import { getPlugins } from '../../services/pluginsAdminApi'
import AdminModsView from './AdminModsView.vue'
import AdminPluginsPanel from '../../components/admin/AdminPluginsPanel.vue'
import ServerChangesBar from '../../components/admin/ServerChangesBar.vue'

const serverName = computed(() => activeServer.value?.name || 'сервер')
const hasMods = ref(false)
const hasPlugins = ref(false)
const ready = ref(false)
const tab = ref(null)
const bar = ref(null)
const plugins = ref(null)

onMounted(async () => {
  const token = authState.accessToken
  const [mods, plug] = await Promise.all([
    hasPermission('mods.view') ? getMods(token).catch(() => null) : null,
    hasPermission('plugins.view') ? getPlugins(token).catch(() => null) : null,
  ])
  // Mods: the server has a client pack or a server mods/ folder.
  hasMods.value = !!(mods && ((mods.mods || []).length || mods.client_dir || mods.server_dir))
  hasPlugins.value = !!plug?.available
  tab.value = hasPlugins.value && !hasMods.value ? 'plugins' : hasMods.value ? 'mods' : 'plugins'
  ready.value = true
})

function refreshBar() { bar.value?.load() }
function onApplied() { plugins.value?.load() }
</script>

<template>
  <div class="adm-page">
    <div class="adm-head">
      <div>
        <h1 class="adm-title">Моды и плагины</h1>
        <p class="adm-sub">Сервер «{{ serverName }}» · jar никогда не меняются под работающим сервером — изменения ждут в очереди и применяются при перезапуске</p>
      </div>
      <div v-if="hasMods && hasPlugins" class="adm-tabs">
        <button class="adm-tab" :class="{ 'adm-tab--active': tab === 'mods' }" @click="tab = 'mods'">Моды</button>
        <button class="adm-tab" :class="{ 'adm-tab--active': tab === 'plugins' }" @click="tab = 'plugins'">Плагины</button>
      </div>
    </div>

    <ServerChangesBar ref="bar" @applied="onApplied" />

    <div v-if="!ready" class="adm-skel" style="height: 260px" />
    <div v-else-if="!hasMods && !hasPlugins" class="adm-empty">
      <div class="adm-empty__title">У этого сервера нет ни модов, ни плагинов</div>
      <div class="adm-empty__sub">Или нет прав на эти разделы, или у сервера не задана папка на этой машине.</div>
    </div>
    <AdminModsView v-else-if="tab === 'mods'" embedded @changed="refreshBar" />
    <AdminPluginsPanel v-else ref="plugins" @changed="refreshBar" />
  </div>
</template>
