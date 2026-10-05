// In an iframe on a partner's site (the status widget) the browser may block storage, and then
// merely touching window.localStorage throws — the whole app would fail to start. Swap in a
// memory store for that page so everything that reads or writes it keeps working.
function memoryStorage() {
  const data = new Map()
  return {
    get length() { return data.size },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => (data.has(String(k)) ? data.get(String(k)) : null),
    setItem: (k, v) => { data.set(String(k), String(v)) },
    removeItem: (k) => { data.delete(String(k)) },
    clear: () => data.clear(),
  }
}

for (const name of ['localStorage', 'sessionStorage']) {
  try {
    const s = window[name]
    s.setItem('__probe', '1')
    s.removeItem('__probe')
  } catch {
    try { Object.defineProperty(window, name, { value: memoryStorage(), configurable: true }) } catch { /* nothing more to do */ }
  }
}
