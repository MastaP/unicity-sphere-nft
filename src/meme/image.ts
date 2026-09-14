/** Reading an image the user dropped, pasted or picked. */

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',');
/** Decoding is done in memory; refuse files large enough to stall a phone. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const MAX_OUTPUT_EDGE = 1024;

export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  name: string;
  /** Free the decoded pixels (ImageBitmap.close / URL.revokeObjectURL). Safe to call more than once. */
  dispose(): void;
}

function once(release: () => void): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    release();
  };
}

export class ImageInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageInputError';
  }
}

export function isAcceptedImage(file: { type: string }): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

/** The output canvas size: the source aspect ratio with the long edge at most `maxEdge`. */
export function outputSize(width: number, height: number, maxEdge: number = MAX_OUTPUT_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The first image file in a drop or paste, if any. */
export function firstImageFile(items: DataTransferItemList | null | undefined, files?: FileList | null): File | null {
  if (items) {
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  if (files) {
    for (const file of Array.from(files)) if (file.type.startsWith('image/')) return file;
  }
  return null;
}

/**
 * Decode `file`. For an animated GIF both paths yield the first frame:
 * createImageBitmap decodes it, and canvas drawing of an <img> uses it.
 */
export async function loadImage(file: File): Promise<LoadedImage> {
  if (!isAcceptedImage(file)) {
    throw new ImageInputError('Use a PNG, JPEG, WebP or GIF image.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageInputError('That image is too large. Use one under 25 MB.');
  }

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        name: file.name,
        dispose: once(() => bitmap.close()),
      };
    } catch {
      // Fall through to <img>, which some browsers decode more formats with.
    }
  }

  // The URL stays alive with the <img>: some engines re-read it when drawing.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      name: file.name,
      dispose: once(() => URL.revokeObjectURL(url)),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageInputError("That image couldn't be read. Try another file.");
  }
}
