import { authenticatedStudioFetch, desktopBridge, encodeBytes, studioContext } from './host';

// Install before importing any Nova module: even module-level stores and
// backup/import code see only the current user's virtual storage namespace.
export function installStudioRuntime() {
  const context = studioContext();
  if (!context) throw new Error('工作台尚未连接');
  const { userId, theme } = context;
  const prefix = `raven-nova-user-${userId}:`;
  const rawStorage = window.localStorage;
  const scopedStorage: Storage = {
    get length() { return Object.keys(rawStorage).filter(key => key.startsWith(prefix)).length; },
    key(index) { return Object.keys(rawStorage).filter(key => key.startsWith(prefix))[index]?.slice(prefix.length) ?? null; },
    getItem(key) { return rawStorage.getItem(prefix + key); },
    setItem(key, value) { rawStorage.setItem(prefix + key, String(value)); },
    removeItem(key) { rawStorage.removeItem(prefix + key); },
    clear() { for (const key of Object.keys(rawStorage)) if (key.startsWith(prefix)) rawStorage.removeItem(key); },
  };
  Object.defineProperty(window, 'localStorage', { value: scopedStorage });
  const rawIDB = window.indexedDB;
  const scopedIDB = new Proxy(rawIDB, {
    get(target, property) {
      if (property === 'open') return (name: string, version?: number) => target.open(prefix + name, version);
      if (property === 'deleteDatabase') return (name: string) => target.deleteDatabase(prefix + name);
      if (property === 'databases') return async () => (await target.databases())
        .filter(db => db.name?.startsWith(prefix)).map(db => ({ ...db, name: db.name!.slice(prefix.length) }));
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  Object.defineProperty(window, 'indexedDB', { value: scopedIDB });

  const apiPrefix = '/api/v1/image-studio/nova';
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    const imagePath = /^\/api\/v1\/image-studio\/nova\/images\/[a-zA-Z0-9-]+\/[0-9]+$/;
    if ((url.origin === location.origin || url.origin === 'https://ravenaiworld.org') && imagePath.test(url.pathname)) {
      return authenticatedStudioFetch(new URL(url.pathname, location.origin), init);
    }
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/nova/')) return originalFetch(input, init);
    url.pathname = apiPrefix + url.pathname.slice('/api/nova'.length);
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    const options = { ...init, headers, cache: 'no-store' as RequestCache };
    return authenticatedStudioFetch(input instanceof Request ? new Request(url, input) : url, options);
  };
  // Use Nova's authenticated HTTP progress transport. Session tokens never enter JS.
  Object.defineProperty(window, 'WebSocket', { value: undefined });
  const originalClick = HTMLAnchorElement.prototype.click;
  const download = async (anchor: HTMLAnchorElement) => {
    const response = await fetch(anchor.href);
    if (!response.ok) throw new Error('无法读取导出文件。');
    await desktopBridge().save(anchor.download || 'ravenai-image.png', encodeBytes(new Uint8Array(await response.arrayBuffer())));
  };
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download')) { void download(this).catch(error => alert(error instanceof Error ? error.message : String(error))); return; }
    originalClick.call(this);
  };
  document.addEventListener('click', event => {
    const anchor = (event.target as Element | null)?.closest('a');
    if (anchor?.hasAttribute('download')) { event.preventDefault(); void download(anchor).catch(error => alert(String(error))); }
  });
  const themeListener = (event: Event) => {
    const theme = (event as CustomEvent<string>).detail;
    if (!['light', 'dark'].includes(theme)) return;
    scopedStorage.setItem('theme', theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.dispatchEvent(new CustomEvent('raven-desktop-theme', { detail: theme }));
  };
  window.parent.addEventListener('raven-theme', themeListener);
  window.addEventListener('pagehide', () => window.parent.removeEventListener('raven-theme', themeListener), { once: true });
  if (!scopedStorage.getItem('nova-wide-mode') && innerWidth >= 1280) {
    scopedStorage.setItem('nova-wide-mode', 'enabled');
  }
  scopedStorage.setItem('theme', theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}
