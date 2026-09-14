/**
 * Export-size search: find the best encoding of the meme that fits the NFT's
 * inline-media budget.
 *
 * The wallet caps the whole encoded NFT payload at 1 MiB (signature wrapper
 * included), and the mint_nft contract asks dApps to keep inline media at or
 * below ~900 KB. Quality goes down first because it is the cheaper loss;
 * only when the lowest quality still does not fit does the image shrink.
 */

export const MAX_IMAGE_BYTES = 900_000;
export const QUALITY_STEPS: readonly number[] = [0.92, 0.85, 0.78, 0.71, 0.64, 0.57, 0.5];
export const DOWNSCALE_FACTOR = 0.85;
/** Give up once the long edge would drop below this many px: the result would be unusable. */
export const MIN_LONG_EDGE = 64;

export type ImageMediaType = 'image/webp' | 'image/jpeg';

/** Draw the meme at `width` x `height` and encode it (in the browser: `canvas.toBlob`). */
export type EncodeImage = (
  width: number,
  height: number,
  type: ImageMediaType,
  quality: number,
) => Promise<Blob | null>;

export interface CompressedImage {
  blob: Blob;
  mediaType: ImageMediaType;
  quality: number;
  width: number;
  height: number;
}

export class CompressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompressionError';
  }
}

export async function compressImage(
  width: number,
  height: number,
  encode: EncodeImage,
  maxBytes: number = MAX_IMAGE_BYTES,
): Promise<CompressedImage> {
  let mediaType: ImageMediaType = 'image/webp';
  let formatChecked = false;

  for (let scale = 1; ; scale *= DOWNSCALE_FACTOR) {
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    if (scale < 1 && Math.max(w, h) < MIN_LONG_EDGE) {
      throw new CompressionError(`Could not get the image under ${Math.round(maxBytes / 1000)} KB.`);
    }

    for (const quality of QUALITY_STEPS) {
      let blob = await encode(w, h, mediaType, quality);
      if (!formatChecked) {
        formatChecked = true;
        // A browser that cannot encode WebP silently hands back a PNG instead
        // (or nothing), so the only reliable probe is the type of the result.
        if (!blob || blob.type !== 'image/webp') {
          mediaType = 'image/jpeg';
          blob = await encode(w, h, mediaType, quality);
        }
      }
      if (!blob) throw new CompressionError('The browser could not encode the image.');
      if (blob.size <= maxBytes) return { blob, mediaType, quality, width: w, height: h };
    }
  }
}
