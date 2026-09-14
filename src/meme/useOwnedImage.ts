import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoadedImage } from './image';

/**
 * The editor's current image, released when it is replaced, cleared or unmounted.
 *
 * Releasing happens in the setters, not in effect cleanups keyed on the image:
 * StrictMode runs an extra cleanup in development, which would release the
 * image that is still on screen.
 */
export function useOwnedImage() {
  const [image, setImageState] = useState<LoadedImage | null>(null);
  const held = useRef<LoadedImage | null>(null);

  const setImage = useCallback((next: LoadedImage | null) => {
    const previous = held.current;
    held.current = next;
    setImageState(next);
    if (previous && previous !== next) previous.dispose();
  }, []);

  const clearImage = useCallback(() => setImage(null), [setImage]);

  // StrictMode's extra cleanup runs at mount, while nothing is held yet.
  useEffect(() => () => held.current?.dispose(), []);

  return { image, setImage, clearImage };
}
