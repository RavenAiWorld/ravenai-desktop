export interface StudioBootstrap {
  userId: number;
  balance: number;
  theme: 'light' | 'dark';
  locale: string;
  catalog: {
    groups: Array<{ id: number; name: string; models: string[]; prices: Record<string, number> }>;
    max_images: number;
    max_references: number;
  };
  textModels: Array<{ groupId: number; groupName: string; model: string; protocol: 'openai-responses' | 'openai-chat-completions' }>;
}

interface DesktopBridge {
  userId: number;
  request(input: { path: string; method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }): Promise<Response>;
  theme(): string;
  navigate(page: string): void;
  save(name: string, data: string): Promise<boolean>;
  ready(tools: number, width: number, height: number): void;
  failed(message: string): void;
}

let context: StudioBootstrap | undefined;

export function desktopBridge(): DesktopBridge {
  if (window.parent === window) throw new Error('请从 Ravenai 客户端打开生图平台。');
  const bridge = (window.parent as unknown as { ravenStudio?: DesktopBridge }).ravenStudio;
  if (!bridge || (context && bridge.userId !== context.userId)) throw new Error('账户已切换，请重新打开生图平台。');
  return bridge;
}

export function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}

export async function authenticatedStudioFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/v1/')) throw new Error('无效的工作台请求。');
  const headers: Record<string, string> = {};
  for (const name of ['content-type', 'x-nova-base-url', 'x-nova-expected-price']) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  try { return await desktopBridge().request({
    path: url.pathname.slice('/api/v1'.length), method: request.method, headers,
    body: request.method === 'GET' ? undefined : encodeBytes(new Uint8Array(await request.arrayBuffer())),
    signal: request.signal,
  }); } catch (error) {
    throw new Error(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error));
  }
}

async function websiteData<T>(path: string): Promise<T> {
  const response = await authenticatedStudioFetch(new URL(`/api/v1${path}`, location.origin));
  const payload = await response.json();
  if (!response.ok || payload.code !== 0) throw new Error(payload.message || '工作台连接失败，请重试。');
  return payload.data as T;
}

export async function refreshStudioBalance() {
  const user = await websiteData<{ id: number; balance: number }>('/auth/me');
  if (!context || user.id !== context.userId) throw new Error('账户已切换。');
  context.balance = user.balance;
  return user.balance;
}

export async function loadLegacyStudioImages(_after?: string): Promise<unknown[]> { return []; }

export async function initializeStudio() {
  const bridge = desktopBridge();
  const user = await websiteData<{ id: number; balance: number }>('/auth/me');
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || user.id !== bridge.userId) throw new Error('请重新登录 Ravenai。');
  type Channel = { platforms: Array<{ platform: string; groups: Array<{ id: number; name: string }>; supported_models: Array<{ name: string }> }> };
  const [catalog, channels] = await Promise.all([
    websiteData<StudioBootstrap['catalog']>('/image-studio/catalog'),
    websiteData<Channel[]>('/channels/available'),
  ]);
  const textModels = new Map<string, StudioBootstrap['textModels'][number]>();
  for (const channel of channels) for (const section of channel.platforms) {
    if (!['openai', 'composite'].includes(section.platform)) continue;
    for (const group of section.groups) for (const model of section.supported_models) {
      if (/image|dall-e|tts|whisper|embedding|sora|video/i.test(model.name)) continue;
      const protocol = /gpt-[5-9]|codex|o[134](?:-|$)/i.test(model.name) ? 'openai-responses' : 'openai-chat-completions';
      textModels.set(`${group.id}:${model.name}`, { groupId: group.id, groupName: group.name, model: model.name, protocol });
    }
  }
  context = { userId: user.id, balance: user.balance, catalog, textModels: [...textModels.values()], locale: 'zh', theme: bridge.theme() === 'dark' ? 'dark' : 'light' };
  return context;
}

export function studioContext() { return context; }
export function studioAsset(path: string) { return `/assets/studio${path}`; }
export function studioModelId(group: number, model: string) { return `raven-group-${group}::${model}`; }
export function studioGroupUrl(group: number) { return `https://raven-session.invalid/groups/${group}`; }
