// Состояние меню админки в этом браузере: свёрнутые группы, избранные разделы и время,
// когда раздел открывали последний раз (для счётчиков «новое»).
import { reactive, watch } from 'vue'

const KEY = 'voidrp_admin_nav_v1'
function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
const saved = read()
export const navPrefs = reactive({
  collapsed: Array.isArray(saved.collapsed) ? saved.collapsed : [],
  pins: Array.isArray(saved.pins) ? saved.pins : [],
  seen: saved.seen && typeof saved.seen === 'object' ? saved.seen : {},
})
watch(navPrefs, (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* private mode: keeps working for this tab */ }
}, { deep: true })

export function toggleGroup(key) {
  const i = navPrefs.collapsed.indexOf(key)
  if (i >= 0) navPrefs.collapsed.splice(i, 1)
  else navPrefs.collapsed.push(key)
}
export function togglePin(path) {
  const i = navPrefs.pins.indexOf(path)
  if (i >= 0) navPrefs.pins.splice(i, 1)
  else navPrefs.pins.push(path)
}
export function markSeen(key) {
  navPrefs.seen[key] = new Date().toISOString()
}
