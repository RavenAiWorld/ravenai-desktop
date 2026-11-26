import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { studioContext } from '@/raven/host';
import { loadRegistry } from '../nova-models';

vi.mock('@/raven/host', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/raven/host')>(),
  studioContext: vi.fn(),
}));

const flare = 'raven-group-15::gpt-image-2.6-flare';
const sunburst = 'raven-group-15::gpt-image-2.6-sunburst';

describe('website image model catalog', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(studioContext).mockReturnValue({
      userId: 1, balance: 100, theme: 'dark', locale: 'en', textModels: [],
      catalog: { max_images: 4, max_references: 2, groups: [
        { id: 15, name: 'GPT-Pro', models: ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'],
          prices: { '1K': 0.05, '2K': 0.05, '4K': 0.05 } },
      ] },
    });
  });
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('uses the current server models for generation and editing', () => {
    const registry = loadRegistry();
    expect(registry.imageModels.map(model => model.modelId)).toEqual([
      'gpt-image-2.6-flare', 'gpt-image-2.6-sunburst',
    ]);
    expect(registry.defaults).toMatchObject({ textToImage: flare, imageToImage: flare, sliceImageEdit: flare });
    expect(registry.imageModels[0]).toMatchObject({
      baseUrl: 'https://raven-session.invalid/groups/15', maxRefImages: 2, maxOutputSize: '4K',
    });
  });

  it('migrates retired 2.5 defaults without changing the selected variant or group', () => {
    localStorage.setItem('nova-model-registry', JSON.stringify({ defaults: {
      textToImage: 'raven-group-15::gpt-image-2.5-flare',
      imageToImage: 'raven-group-15::gpt-image-2.5-sunburst',
      sliceImageEdit: 'raven-group-15::gpt-image-2.5-sunburst',
    } }));
    expect(loadRegistry().defaults).toMatchObject({
      textToImage: flare, imageToImage: sunburst, sliceImageEdit: sunburst,
    });
  });

  it('preserves an available current selection and rejects a stale group', () => {
    localStorage.setItem('nova-model-registry', JSON.stringify({ defaults: {
      textToImage: sunburst, imageToImage: 'raven-group-99::gpt-image-2.5-sunburst',
    } }));
    expect(loadRegistry().defaults).toMatchObject({ textToImage: sunburst, imageToImage: flare });
  });

  it('does not restore an unavailable model from local storage', () => {
    vi.mocked(studioContext).mockReturnValue({
      userId: 1, balance: 100, theme: 'dark', locale: 'en', textModels: [],
      catalog: { max_images: 4, max_references: 2, groups: [] },
    });
    localStorage.setItem('nova-model-registry', JSON.stringify({ defaults: { textToImage: sunburst } }));
    const registry = loadRegistry();
    expect(registry.imageModels).toEqual([]);
    expect(registry.defaults).toMatchObject({ textToImage: '', imageToImage: '', sliceImageEdit: '' });
  });
});
