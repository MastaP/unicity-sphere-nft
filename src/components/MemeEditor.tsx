import { ImagePlus, LoaderCircle, Move, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { clampPoint, hitTestCaptions, type CaptionSlot } from '../meme/captions';
import { loadCaptionFont } from '../meme/export';
import {
  ACCEPT_ATTRIBUTE,
  firstImageFile,
  ImageInputError,
  loadImage,
  MAX_INPUT_BYTES,
  outputSize,
  type LoadedImage,
} from '../meme/image';
import { captionFont, drawMeme, layoutMeme, type MemeSettings } from '../meme/render';
import { CaptionControls } from './CaptionControls';
import { focusRing, panel, secondaryButton } from './ui';

/** The largest file `loadImage` accepts, for the dropzone hint. */
const MAX_INPUT_MB = Math.round(MAX_INPUT_BYTES / (1024 * 1024));

interface MemeEditorProps {
  image: LoadedImage | null;
  onImage: (image: LoadedImage) => void;
  settings: MemeSettings;
  onSettingsChange: (update: (previous: MemeSettings) => MemeSettings) => void;
  /** Freeze every input, e.g. while this meme is being minted. */
  disabled?: boolean;
}

interface Drag {
  slot: CaptionSlot;
  pointerId: number;
  /** Pointer offset from the caption centre, in canvas px. */
  dx: number;
  dy: number;
}

function fontReady(sample: string): boolean {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  return !fonts || typeof fonts.check !== 'function' || fonts.check(captionFont(64), sample || 'A');
}

export function MemeEditor({ image, onImage, settings, onSettingsChange, disabled = false }: MemeEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [measureContext] = useState(() => document.createElement('canvas').getContext('2d'));
  const [fontVersion, setFontVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [dragging, setDragging] = useState<CaptionSlot | null>(null);

  const size = image ? outputSize(image.width, image.height) : null;
  const placed = image && size && measureContext ? layoutMeme(measureContext, settings, size.width, size.height) : [];
  const overflow = {
    top: placed.some((c) => c.slot === 'top' && c.overflow),
    bottom: placed.some((c) => c.slot === 'bottom' && c.overflow),
  };

  // Canvas text measured before Anton arrives would use the fallback face; redraw once it has.
  const sample = `${settings.top.text} ${settings.bottom.text}`;
  useEffect(() => {
    if (fontReady(sample)) return;
    let cancelled = false;
    void loadCaptionFont(sample).then(() => {
      if (!cancelled) setFontVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [sample]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !image || !size) return;
    drawMeme(ctx, image.source, size.width, size.height, settings);
    // size is derived from image; fontVersion forces a redraw once the font loads.
  }, [image, settings, size?.width, size?.height, fontVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only the newest pick may land. A slower earlier decode is released and dropped,
  // and only the newest request may end the loading state or report an error.
  const requestRef = useRef(0);
  useEffect(
    () => () => {
      requestRef.current += 1; // a decode finishing after unmount is released, not applied
    },
    [],
  );

  const accept = useCallback(
    async (file: File | null) => {
      if (!file) {
        setError('Use a PNG, JPEG, WebP or GIF image.');
        return;
      }
      const request = ++requestRef.current;
      setError(null);
      setLoading(true);
      try {
        const loaded = await loadImage(file);
        if (request !== requestRef.current) {
          loaded.dispose();
          return;
        }
        onImage(loaded);
      } catch (err) {
        if (request !== requestRef.current) return;
        setError(err instanceof ImageInputError ? err.message : "That image couldn't be read. Try another file.");
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [onImage],
  );

  // Paste an image anywhere on the page. Text pastes are left alone.
  useEffect(() => {
    if (disabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = firstImageFile(event.clipboardData?.items, event.clipboardData?.files);
      if (!file) return;
      event.preventDefault();
      void accept(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [accept, disabled]);

  const onDragOver = (event: DragEvent) => {
    if (disabled || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropping(true);
  };
  const onDragLeave = (event: DragEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
  };
  const onDrop = (event: DragEvent) => {
    if (disabled) return;
    event.preventDefault();
    setDropping(false);
    void accept(firstImageFile(event.dataTransfer.items, event.dataTransfer.files));
  };

  const toCanvas = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !size) return;
    const point = toCanvas(event);
    if (!point) return;
    const slot = hitTestCaptions(placed, point.x, point.y);
    const caption = placed.find((c) => c.slot === slot);
    if (!slot || !caption) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { slot, pointerId: event.pointerId, dx: point.x - caption.centerX, dy: point.y - caption.centerY };
    setDragging(slot);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!size) return;
    const point = toCanvas(event);
    if (!point) return;
    const drag = dragRef.current;
    if (!drag) {
      event.currentTarget.style.cursor = !disabled && hitTestCaptions(placed, point.x, point.y) ? 'grab' : '';
      return;
    }
    if (drag.pointerId !== event.pointerId) return;
    const position = clampPoint({ x: (point.x - drag.dx) / size.width, y: (point.y - drag.dy) / size.height });
    onSettingsChange((s) => ({ ...s, [drag.slot]: { ...s[drag.slot], position } }));
  };

  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const openPicker = () => fileInputRef.current?.click();
  const captionSummary = [settings.top.text.trim(), settings.bottom.text.trim()].filter(Boolean).join(' / ');

  return (
    <section
      aria-labelledby="editor-heading"
      className={`${panel} transition-shadow ${dropping ? 'ring-2 ring-orange-500' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="editor-heading" className="text-lg font-semibold text-neutral-50">
          Your meme
        </h2>
        {image && (
          <button type="button" className={secondaryButton} onClick={openPicker} disabled={disabled}>
            <Upload aria-hidden className="h-4 w-4" />
            Replace image
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        aria-label="Choose image"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = '';
          if (file) void accept(file);
        }}
      />

      {image && size ? (
        <div className="mt-3">
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={size.width}
              height={size.height}
              role="img"
              aria-label={captionSummary ? `Meme preview: ${captionSummary}` : 'Meme preview'}
              className={`block h-auto max-w-full touch-none select-none rounded-xl bg-neutral-950 ${dragging ? 'cursor-grabbing' : ''}`}
              style={{ width: `min(100%, calc(70vh * ${size.width} / ${size.height}))` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
            <Move aria-hidden className="h-3.5 w-3.5" />
            Drag the captions on the image to move them.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-neutral-700 px-4 py-8 text-center">
          <ImagePlus aria-hidden className="h-10 w-10 text-orange-500" />
          <p className="font-medium text-neutral-100">Add an image to start</p>
          <ul className="space-y-1 text-sm text-neutral-400">
            <li>
              <button type="button" onClick={openPicker} disabled={disabled} className={`font-medium text-orange-400 underline-offset-4 hover:underline ${focusRing} rounded`}>
                Choose a file
              </button>
            </li>
            <li>or drag and drop it here</li>
            <li>or paste it with Ctrl+V / ⌘V</li>
          </ul>
          <div className="text-xs text-neutral-500">
            <p>PNG, JPEG, WebP or GIF (first frame) · up to {MAX_INPUT_MB} MB</p>
            <p className="mt-0.5">Large images are resized and compressed to fit inside the NFT.</p>
          </div>
        </div>
      )}

      {loading && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
          <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
          Loading image…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <fieldset disabled={disabled} className="mt-4 min-w-0">
        <legend className="sr-only">Captions</legend>
        <CaptionControls settings={settings} onChange={onSettingsChange} overflow={overflow} />
      </fieldset>
    </section>
  );
}
