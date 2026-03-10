/**
 * Polyfill de window.storage para desarrollo local fuera de Claude.ai
 * Importa este archivo en src/index.js ANTES de App cuando corras localmente:
 *   import './storage-polyfill';
 */
if (!window.storage) {
  const _store = {};
  window.storage = {
    get:    async (k)        => { if(_store[k]===undefined) throw new Error("Key not found: "+k); return {key:k,value:_store[k]}; },
    set:    async (k,v)      => { _store[k]=v; return {key:k,value:v}; },
    delete: async (k)        => { delete _store[k]; return {key:k,deleted:true}; },
    list:   async (prefix="")=> ({ keys: Object.keys(_store).filter(k=>k.startsWith(prefix)) }),
  };
}
