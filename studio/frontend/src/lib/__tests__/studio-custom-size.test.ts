import { describe, expect, it } from 'vitest';
import { getCustomSizeTier, normalizeCustomImageSize, normalizeModelCustomSize, supportsCustomSize } from '../model-capabilities';

const model = 'raven-group-15::gpt-image-2.5-flare';

describe('website output geometry', () => {
  it('preserves exact output pixels, including small and non-aligned sizes', () => {
    for (const size of ['1920x1080', '999x777', '16x16', '4096x4096']) expect(normalizeModelCustomSize(model, size)).toBe(size);
    for (const size of ['0x0', '15x100', '4097x1000', '123.4x1000', '1000x1000junk']) expect(normalizeModelCustomSize(model, size)).toBeUndefined();
  });
  it('classifies the exact dimensions for pricing', () => {
    expect(getCustomSizeTier('1024x1024')).toBe('1K');
    expect(getCustomSizeTier('1025x16')).toBe('2K');
    expect(getCustomSizeTier('1920x1080')).toBe('2K');
    expect(getCustomSizeTier('2048x2049')).toBe('4K');
  });
  it('keeps native-model normalization separate from exact output sizing', () => {
    expect(normalizeCustomImageSize('1920x1080', 3840)).toBe('1920x1088');
    expect(supportsCustomSize(model)).toBe(false);
  });
});
