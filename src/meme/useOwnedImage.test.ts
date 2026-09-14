import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { LoadedImage } from './image';
import { useOwnedImage } from './useOwnedImage';

function fakeImage(name: string) {
  const dispose = vi.fn();
  const image: LoadedImage = { source: {} as CanvasImageSource, width: 10, height: 10, name, dispose };
  return { image, dispose };
}

describe('useOwnedImage', () => {
  it('releases the previous image when a new one replaces it', () => {
    const first = fakeImage('first.png');
    const second = fakeImage('second.png');
    const { result } = renderHook(() => useOwnedImage());

    act(() => result.current.setImage(first.image));
    act(() => result.current.setImage(second.image));

    expect(result.current.image).toBe(second.image);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).not.toHaveBeenCalled();
  });

  it('does not release an image that is set again as itself', () => {
    const only = fakeImage('only.png');
    const { result } = renderHook(() => useOwnedImage());

    act(() => result.current.setImage(only.image));
    act(() => result.current.setImage(only.image));

    expect(only.dispose).not.toHaveBeenCalled();
  });

  it('releases the current image when cleared ("Make another")', () => {
    const current = fakeImage('current.png');
    const { result } = renderHook(() => useOwnedImage());

    act(() => result.current.setImage(current.image));
    act(() => result.current.clearImage());

    expect(result.current.image).toBeNull();
    expect(current.dispose).toHaveBeenCalledTimes(1);
  });

  it('releases the image it holds when unmounted', () => {
    const current = fakeImage('current.png');
    const { result, unmount } = renderHook(() => useOwnedImage());

    act(() => result.current.setImage(current.image));
    unmount();

    expect(current.dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps the image on screen through StrictMode's extra effect run", () => {
    const current = fakeImage('current.png');
    const { result, rerender } = renderHook(() => useOwnedImage(), { wrapper: StrictMode });

    act(() => result.current.setImage(current.image));
    rerender();

    expect(result.current.image).toBe(current.image);
    expect(current.dispose).not.toHaveBeenCalled();
  });
});
