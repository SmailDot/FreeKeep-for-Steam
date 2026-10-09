// Injected into the real popup (built by `npm run build`) to replace the extension APIs with an
// in-memory fake that record.mjs drives through window.__demo. Used only to render the README demo.
(() => {
  if (!location.pathname.endsWith('/popup.html')) return;
  const messages = window.__DEMO_MESSAGES__;
  const store = structuredClone(window.__DEMO_SEED__ ?? {});
  const listeners = [];

  function getMessage(key, subs = []) {
    const entry = messages[key];
    if (!entry) return '';
    const args = Array.isArray(subs) ? subs : [subs];
    return entry.message.replace(/\$([A-Za-z_]+)\$/g, (_, name) => {
      const ref = entry.placeholders?.[name.toLowerCase()]?.content ?? '';
      return args[Number(ref.replace('$', '')) - 1] ?? '';
    });
  }

  const event = (list) => ({ addListener: (fn) => list.push(fn), removeListener() {} });

  window.chrome = {
    runtime: {
      id: 'demo',
      getManifest: () => ({ version: '0.1.0' }),
      getURL: (p) => p,
      openOptionsPage() {},
      sendMessage: async (command) => {
        window.__demo.onCommand?.(command);
        return { ok: true };
      },
    },
    i18n: { getMessage, getUILanguage: () => window.__DEMO_LANG__ },
    storage: {
      local: {
        async get(keys) {
          const list = keys == null ? Object.keys(store) : Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
        },
        async set(patch) {
          const changes = {};
          for (const [k, v] of Object.entries(patch)) {
            changes[k] = { oldValue: store[k], newValue: v };
            store[k] = structuredClone(v);
          }
          listeners.forEach((fn) => fn(changes, 'local'));
        },
      },
      onChanged: event(listeners),
    },
  };

  window.__demo = {
    set: (patch) => window.chrome.storage.local.set(patch),
    get: () => structuredClone(store),
    onCommand: null,
  };
})();
