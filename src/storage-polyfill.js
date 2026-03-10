// Polyfill para window.storage cuando se corre fuera de Claude.ai
if (!window.storage) {
  const store = {};
  window.storage = {
    get: async (key) => store[key] ? { key, value: store[key] } : (() => { throw new Error("Key not found") })(),
    set: async (key, value) => { store[key] = value; return { key, value }; },
    delete: async (key) => { delete store[key]; return { key, deleted: true }; },
    list: async (prefix = "") => ({ keys: Object.keys(store).filter(k => k.startsWith(prefix)) }),
  };
}
