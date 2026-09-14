import { compressImage, type CompressedImage, type EncodeImage } from './compress';
import { outputSize, type LoadedImage } from './image';
import { captionFont, drawMeme, type MemeSettings } from './render';

export interface ExportedMeme extends CompressedImage {
  bytes: Uint8Array;
}

/** Make sure the caption font is ready, so a canvas never draws the fallback face. */
export async function loadCaptionFont(sample: string): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts || typeof fonts.load !== 'function') return;
  try {
    await fonts.load(captionFont(64), sample || 'A');
  } catch {
    // Drawing with the fallback face beats not drawing at all.
  }
}

/** Render the meme at output resolution and encode it within the NFT media budget. */
export async function exportMeme(image: LoadedImage, settings: MemeSettings): Promise<ExportedMeme> {
  await loadCaptionFont(`${settings.top.text} ${settings.bottom.text}`);

  const { width, height } = outputSize(image.width, image.height);
  const canvas = document.createElement('canvas');
  let drawnAt = '';

  const encode: EncodeImage = (w, h, type, quality) => {
    if (drawnAt !== `${w}x${h}`) {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return Promise.resolve(null);
      drawMeme(ctx, image.source, w, h, settings);
      drawnAt = `${w}x${h}`;
    }
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  };

  const result = await compressImage(width, height, encode);
  return { ...result, bytes: new Uint8Array(await result.blob.arrayBuffer()) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  return `${Math.round(bytes / 1000)} KB`;
}
