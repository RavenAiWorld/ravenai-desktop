export default {
  imageStudio: {
    canvas: 'Canvas', canvasQueueFull: 'Four canvas tasks are already running. Wait for them to finish.', canvasSessionChanged: 'Your account changed. Reopen the canvas.',
    title: 'Image Studio', description: 'Every image starts with an idea.', studio: 'Create', gallery: 'My images', inspiration: 'Inspiration',
    badge: 'IMAGE STUDIO', headline: 'Bring the picture in your mind to life', subtitle: 'Describe an idea or upload a reference. See where it takes you.',
    balance: 'Balance', recharge: 'Add credits', localGallery: 'Images are saved in this browser. Download anything you want to keep.',
    prompt: 'Image description', placeholder: 'Describe the scene, style, lighting and details you have in mind…', reference: 'Reference', addReference: 'Add reference', removeReference: 'Remove reference',
    referenceHint: 'PNG, JPG, WebP · Up to 10 MB each · 2 images maximum', referenceError: 'Choose up to 2 PNG, JPG or WebP images, at most 10 MB each.',
    model: 'Model', group: 'Channel', size: 'Size', ratio: 'Ratio', quality: 'Quality', count: 'Count',
    qualityAuto: 'Auto', qualityLow: 'Standard', qualityMedium: 'Detailed', qualityHigh: 'High detail',
    generate: 'Generate', generating: 'Creating', estimated: 'Estimated', perImage: '/ image', images: '{count} images',
    priceNote: 'Billed per image, independently of text model rates. Output dimensions depend on the model.',
    busyTitle: 'Your idea is taking shape', busyHint: 'This can take a few minutes. Keep this page open.', elapsed: '{seconds} seconds elapsed',
    emptyGallery: 'Your first image starts here', emptyGalleryHint: 'Your generated images will appear here.', startCreating: 'Start creating',
    tryPrompt: 'Use this idea', download: 'Download image', reuse: 'Reuse prompt', useReference: 'Use as reference', delete: 'Delete image',
    deleteConfirm: 'Delete this image from this browser? Downloaded files will be kept.', close: 'Close preview', preview: 'Preview image',
    noGroups: 'No image generation channel is available for this account.', loadFailed: 'Could not load the image settings. Please try again.', retry: 'Reload',
    insufficient: 'Insufficient balance. Add credits to continue.', failed: 'Generation did not finish. Check usage before submitting again.',
    interrupted: 'The connection was interrupted or timed out. Your request may still be processing. Check usage before submitting again.',
    priceChanged: 'The price has changed. Review the updated price before generating.', duplicate: 'This request was already submitted. Check your images and usage first.',
    noImage: 'The request succeeded but returned no displayable image. Please check usage.', storageFailed: 'Could not save images in this browser. Download your new images now.',
    historyFailed: 'Local images could not be loaded. You can still generate and download images.', leaveConfirm: 'An image is still generating. Leaving may lose the result, and charges may already apply. Leave this page?',
    usage: 'View usage', created: 'Created', back: 'Back to studio', referenceMode: 'Reference edit', textMode: 'Text to image',
    presets: {
      landscape: { title: 'Somewhere, at sunset', category: 'Landscape · Film', prompt: 'Distant mountains and a still lake beneath a peach sunset, a tiny boat at the center, 35mm film photography, subtle grain, minimalist composition, quiet and poetic.' },
      product: { title: 'An ordinary kind of light', category: 'Product · Still life', prompt: 'A handmade cream ceramic vase holding an olive branch on a warm stone plinth, afternoon sunlight and diagonal window shadows, elegant product photography, natural texture, cream background.' },
      illustration: { title: 'A little world of wonder', category: 'Illustration · Imagination', prompt: 'A tiny garden floating among clouds, a domed cottage, lush trees and winding paths, warm pastel colors, detailed 3D clay illustration, soft lighting, playful and whimsical.' },
      poster: { title: 'Give words a little character', category: 'Design · Poster', prompt: 'A modernist art exhibition poster, cream background, an orange-red circle and deep blue geometric shapes, generous whitespace and grid typography, text reads MAKE SOMETHING NEW, clean graphic design.' }
    }
  }
}
