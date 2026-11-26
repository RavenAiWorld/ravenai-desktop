import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNovaTask, type CreateNovaTaskInput } from '../ccode-task-client';
import { studioContext } from '@/raven/host';

vi.mock('@/raven/host', () => ({ studioContext: vi.fn() }));

const input: CreateNovaTaskInput = {
  apiKey: 'session', baseUrl: 'https://raven-session.invalid/groups/15',
  protocol: 'openai', mode: 'text-to-image', prompt: 'test', model: 'gpt-image-2.5-flare',
  outputSize: '4K', customSize: '3073x2049', aspectRatio: '3:2',
  temperature: 1, parallelCount: 2, images: [],
};

describe('website task pricing', () => {
  beforeEach(() => {
    vi.mocked(studioContext).mockReturnValue({
      userId: 1, balance: 100, theme: 'dark', locale: 'en', textModels: [],
      catalog: { max_images: 4, max_references: 2, groups: [
        { id: 15, name: 'test', models: [input.model], prices: { '1K': 0.03, '2K': 0.07, '4K': 0.11 } },
      ] },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ taskId: 'test-task' }), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses the selected group and size price for the whole batch', async () => {
    expect(await createNovaTask(input)).toBe('test-task');
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.expectedPrice).toBe(0.22);
    expect(body.customSize).toBe('3073x2049');
    expect(body.requestID).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails before submission when the group or tier is absent', async () => {
    await expect(createNovaTask({ ...input, baseUrl: 'https://raven-session.invalid/groups/999' })).rejects.toThrow();
    await expect(createNovaTask({ ...input, outputSize: 'auto' })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not repeat paid requests on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Network unavailable'));
    await expect(createNovaTask(input)).rejects.toThrow('Network unavailable');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
