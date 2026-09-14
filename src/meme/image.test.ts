import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadImage } from './image';

const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'meme.png', { type: 'image/png' });

const restores: Array<() => void> = [];

/** Define a property jsdom lacks (or replace one it has) until the test ends. */
function stubProperty(target: object, key: string, value: unknown): void {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  restores.push(() => {
    if (original) Object.defineProperty(target, key, original);
    else delete (target as Record<string, unknown>)[key];
  });
}

afterEach(() => {
  while (restores.length > 0) restores.pop()?.();
  vi.unstubAllGlobals();
});

describe('LoadedImage.dispose', () => {
  it('closes the decoded ImageBitmap, exactly once', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4, height: 3, close })));

    const image = await loadImage(png());
    expect(close).not.toHaveBeenCalled();

    image.dispose();
    image.dispose();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('revokes the object URL behind the <img> fallback, exactly once', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const revoke = vi.fn();
    stubProperty(URL, 'createObjectURL', vi.fn(() => 'blob:meme'));
    stubProperty(URL, 'revokeObjectURL', revoke);
    stubProperty(HTMLImageElement.prototype, 'decode', () => Promise.resolve());

    const image = await loadImage(png());
    expect(revoke).not.toHaveBeenCalled();

    image.dispose();
    image.dispose();
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:meme');
  });
});
