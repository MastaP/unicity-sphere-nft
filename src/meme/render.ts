/**
 * Drawing the meme onto a 2D canvas. All sizes are relative to the canvas, so
 * the preview and every export resolution produce the same composition.
 */
import {
  captionMargin,
  fitCaption,
  LINE_HEIGHT,
  normalizeCaption,
  placeCaption,
  strokeWidth,
  type CaptionSlot,
  type MeasureText,
  type PlacedCaption,
  type Point,
} from './captions';

export interface CaptionState {
  text: string;
  /** Centre as canvas fractions, or null for the automatic top/bottom position. */
  position: Point | null;
}

export interface MemeSettings {
  top: CaptionState;
  bottom: CaptionState;
  uppercase: boolean;
  /** Caption size as a percentage of the image's shorter edge. */
  sizePercent: number;
  autoFit: boolean;
}

export const MIN_SIZE_PERCENT = 4;
export const MAX_SIZE_PERCENT = 20;

export const DEFAULT_SETTINGS: MemeSettings = {
  top: { text: '', position: null },
  bottom: { text: '', position: null },
  uppercase: true,
  sizePercent: 11,
  autoFit: true,
};

export const CAPTION_SLOTS: readonly CaptionSlot[] = ['top', 'bottom'];

const FONT_FAMILY = "Anton, Impact, 'Arial Narrow', sans-serif";

export function captionFont(fontSize: number): string {
  return `400 ${fontSize}px ${FONT_FAMILY}`;
}

function measurer(ctx: CanvasRenderingContext2D): MeasureText {
  return (text, fontSize) => {
    ctx.font = captionFont(fontSize);
    return ctx.measureText(text).width;
  };
}

/** Lay out both captions for a `width` x `height` canvas. Empty captions are left out. */
export function layoutMeme(
  ctx: CanvasRenderingContext2D,
  settings: MemeSettings,
  width: number,
  height: number,
): PlacedCaption[] {
  const measure = measurer(ctx);
  const shortEdge = Math.min(width, height);
  const drawn = CAPTION_SLOTS.map((slot) => ({
    slot,
    text: normalizeCaption(settings[slot].text, settings.uppercase),
  })).filter((entry) => entry.text !== '');

  // Two AUTO-placed captions hang from opposite margins, so each may claim only half
  // the band between them; budgeting them independently lets the pair cover more than
  // the canvas and silently overlap. A dragged caption hangs from no margin, so it
  // neither takes a share nor forces the other to halve — any overlap there is the
  // user's own doing, and `placeCaption` honours the position they chose.
  const band = height - 2 * captionMargin(width, height);
  const autoPlaced = drawn.filter(({ slot }) => settings[slot].position === null).length;
  const maxHeight = band / (autoPlaced > 1 ? 2 : 1);

  const placed: PlacedCaption[] = [];
  for (const { slot, text } of drawn) {
    const layout = fitCaption(text, {
      maxWidth: width * 0.92,
      maxHeight,
      fontSize: (shortEdge * settings.sizePercent) / 100,
      minFontSize: Math.max(8, shortEdge * 0.025),
      autoFit: settings.autoFit,
      measure,
    });
    placed.push(placeCaption(layout, slot, settings[slot].position, width, height, measure));
  }
  return placed;
}

/** Draw the image and captions at `width` x `height`. Returns the caption layout used. */
export function drawMeme(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
  settings: MemeSettings,
): PlacedCaption[] {
  // Transparent pixels would turn black in a JPEG export; give them a fixed ground.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  const placed = layoutMeme(ctx, settings, width, height);
  for (const caption of placed) {
    ctx.font = captionFont(caption.fontSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    // The stroke straddles the glyph outline and the fill covers its inner half.
    ctx.lineWidth = strokeWidth(caption.fontSize) * 2;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#ffffff';
    const lineHeight = caption.fontSize * LINE_HEIGHT;
    caption.lines.forEach((line, i) => {
      const y = caption.centerY - caption.height / 2 + lineHeight * (i + 0.5);
      ctx.strokeText(line, caption.centerX, y);
      ctx.fillText(line, caption.centerX, y);
    });
  }
  return placed;
}
