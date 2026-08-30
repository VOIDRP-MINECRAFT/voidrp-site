import { reactive } from 'vue'

// Shared, reactive currency balances for the in-game WebGUI topbar. Any page that
// changes a balance (e.g. the upgrader spending Void Coins) pushes the new value here,
// so the navbar updates instantly instead of waiting for a remount.
export const currency = reactive({
  voidCoins: null,   // null = not loaded yet (fall back to the topbar's own fetch)
  balance: null,
})

export function setVoidCoins(v) {
  if (typeof v === 'number' && !Number.isNaN(v)) currency.voidCoins = v
}
export function setBalance(v) {
  if (typeof v === 'number' && !Number.isNaN(v)) currency.balance = v
}
