import { addImageAsset } from '@/lib/asset-store';
import { loadLegacyStudioImages } from './host';

interface LegacyImage {
  id: string;
  prompt: string;
  model: string;
  tier: string;
  ratio: string;
  blob: Blob;
}

export async function migrateLegacyGallery() {
  const marker = 'raven-legacy-gallery-migrated-v1';
  if (localStorage.getItem(marker)) return;
  let after: string | undefined;
  for (;;) {
    const images = await loadLegacyStudioImages(after) as LegacyImage[];
    for (const image of images) {
      if (!(image.blob instanceof Blob)) throw new Error('旧版作品数据读取失败');
      await addImageAsset({
        blob: image.blob,
        name: image.prompt.slice(0, 60) || '旧版生图作品',
        prompt: image.prompt,
        sourceKind: 'manual',
        sourceLabel: '旧版生图工作台',
        sourceRef: `raven-legacy:${image.id}`,
        tags: ['旧版作品', image.tier],
        note: `${image.model} · ${image.tier} · ${image.ratio}`,
      });
      after = image.id;
    }
    if (images.length) window.dispatchEvent(new Event('raven-legacy-assets-imported'));
    if (images.length < 4) break;
  }
  localStorage.setItem(marker, 'true');
}
