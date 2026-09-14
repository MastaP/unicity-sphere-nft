import { describe, expect, it, vi } from 'vitest';
import {
  compressImage,
  CompressionError,
  DOWNSCALE_FACTOR,
  MIN_LONG_EDGE,
  QUALITY_STEPS,
  type EncodeImage,
  type ImageMediaType,
} from './compress';

const blobOf = (size: number, type: string) => new Blob([new Uint8Array(size)], { type });

interface Call {
  width: number;
  height: number;
  type: ImageMediaType;
  quality: number;
}

/** An encoder whose output size is `bytes(width, height, quality)`, recording every call. */
function encoder(bytes: (call: Call) => number, opts: { webp?: 'ok' | 'png' | 'null' } = {}) {
  const calls: Call[] = [];
  const encode: EncodeImage = vi.fn(async (width, height, type, quality) => {
    const call = { width, height, type, quality };
    calls.push(call);
    if (type === 'image/webp' && opts.webp === 'png') return blobOf(10, 'image/png');
    if (type === 'image/webp' && opts.webp === 'null') return null;
    return blobOf(bytes(call), type);
  });
  return { encode, calls };
}

describe('compressImage', () => {
  it('keeps WebP at 0.92 and full size when that already fits', async () => {
    const { encode, calls } = encoder(() => 500);
    const result = await compressImage(800, 600, encode, 1000);

    expect(result).toMatchObject({ mediaType: 'image/webp', quality: 0.92, width: 800, height: 600 });
    expect(result.blob.size).toBe(500);
    expect(calls).toHaveLength(1);
  });

  it('accepts a result exactly at the limit', async () => {
    const { encode } = encoder(() => 1000);
    expect((await compressImage(100, 100, encode, 1000)).quality).toBe(0.92);
  });

  it('steps quality down from 0.92 to the first quality that fits', async () => {
    const { encode, calls } = encoder(({ quality }) => (quality <= 0.71 ? 900 : 1500));
    const result = await compressImage(800, 600, encode, 1000);

    expect(result.quality).toBe(0.71);
    expect(calls.map((c) => c.quality)).toEqual([0.92, 0.85, 0.78, 0.71]);
    expect(calls.every((c) => c.width === 800 && c.height === 600)).toBe(true);
  });

  it('searches the full range from 0.92 down to 0.5', () => {
    expect(QUALITY_STEPS[0]).toBe(0.92);
    expect(QUALITY_STEPS[QUALITY_STEPS.length - 1]).toBe(0.5);
    expect([...QUALITY_STEPS].sort((a, b) => b - a)).toEqual(QUALITY_STEPS);
  });

  it('falls back to JPEG when the browser hands back PNG for WebP', async () => {
    const { encode, calls } = encoder(({ quality }) => (quality <= 0.85 ? 100 : 5000), { webp: 'png' });
    const result = await compressImage(640, 480, encode, 1000);

    expect(result.mediaType).toBe('image/jpeg');
    expect(result.blob.type).toBe('image/jpeg');
    expect(result.quality).toBe(0.85);
    expect(calls.map((c) => [c.type, c.quality])).toEqual([
      ['image/webp', 0.92],
      ['image/jpeg', 0.92],
      ['image/jpeg', 0.85],
    ]);
  });

  it('falls back to JPEG when WebP encoding yields nothing', async () => {
    const { encode } = encoder(() => 10, { webp: 'null' });
    expect((await compressImage(64, 64, encode, 1000)).mediaType).toBe('image/jpeg');
  });

  it('downscales by 0.85 once the lowest quality still does not fit, restarting at 0.92', async () => {
    const { encode, calls } = encoder(({ width, height, quality }) => width * height * quality);
    // Limit 360 000. Full size bottoms out at 1000x800x0.5 = 400 000, so it downscales;
    // at 850x680 the search restarts at 0.92 and first fits at 0.57 (329 460).
    const result = await compressImage(1000, 800, encode, 360_000);

    const sizes = [...new Set(calls.map((c) => `${c.width}x${c.height}`))];
    expect(sizes).toEqual(['1000x800', `${1000 * DOWNSCALE_FACTOR}x${800 * DOWNSCALE_FACTOR}`]);
    expect(calls.filter((c) => c.width === 1000).map((c) => c.quality)).toEqual(QUALITY_STEPS);
    expect(calls.filter((c) => c.width === 850).map((c) => c.quality)).toEqual([0.92, 0.85, 0.78, 0.71, 0.64, 0.57]);
    expect(result).toMatchObject({ width: 850, height: 680, quality: 0.57, mediaType: 'image/webp' });
  });

  it('gives up with a CompressionError before the long edge drops below the minimum', async () => {
    const { encode, calls } = encoder(() => 10_000);
    await expect(compressImage(1024, 768, encode, 1000)).rejects.toBeInstanceOf(CompressionError);

    const smallestTried = Math.min(...calls.map((c) => Math.max(c.width, c.height)));
    expect(smallestTried).toBeGreaterThanOrEqual(MIN_LONG_EDGE);
    expect(Math.round(smallestTried * DOWNSCALE_FACTOR)).toBeLessThan(MIN_LONG_EDGE);
  });

  it('encodes a source smaller than the minimum edge as-is', async () => {
    const { encode } = encoder(() => 10);
    expect(await compressImage(40, 30, encode, 1000)).toMatchObject({ width: 40, height: 30 });
  });

  it('throws when even JPEG encoding yields nothing', async () => {
    const encode: EncodeImage = async () => null;
    await expect(compressImage(100, 100, encode, 1000)).rejects.toBeInstanceOf(CompressionError);
  });
});
