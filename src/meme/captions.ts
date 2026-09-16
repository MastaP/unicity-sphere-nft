/**
 * Caption layout: pure functions, no canvas.
 *
 * Text width comes from an injected `measure`, so the fit and wrap rules are
 * testable without a 2D context and identical at every output resolution.
 */

/** Width in px of `text` rendered in the caption font at `fontSize` px. */
export type MeasureText = (text: string, fontSize: number) => number;

/** Auto-fit wraps a caption to at most this many lines; line breaks the user typed raise the cap. */
export const MAX_CAPTION_LINES = 3;
/** Line advance as a multiple of the font size. */
export const LINE_HEIGHT = 1.1;
/** Outline width as a fraction of the font size. */
export const STROKE_RATIO = 0.08;

/** A caption's centre as fractions of the canvas size (0..1 on both axes). */
export interface Point {
  x: number;
  y: number;
}

export type CaptionSlot = 'top' | 'bottom';

export interface FitOptions {
  /** Widest a line may be, in px. */
  maxWidth: number;
  /**
   * Tallest the whole caption block may be, in px. The line cap alone cannot bound
   * height once typed breaks raise it, so this is what keeps a caption on the image.
   */
  maxHeight: number;
  /** The size the user picked, in px. Auto-fit never grows past it. */
  fontSize: number;
  /** Auto-fit never shrinks below this, in px. */
  minFontSize: number;
  /** Shrink to fit the width, the height and at most `maxLines`; otherwise wrap at `fontSize` as-is. */
  autoFit: boolean;
  maxLines?: number;
  measure: MeasureText;
}

export interface CaptionLayout {
  lines: string[];
  fontSize: number;
  /**
   * The text could not be fitted: a line is wider than `maxWidth`, the block is
   * taller than `maxHeight`, or the line cap was exceeded.
   */
  overflow: boolean;
}

export interface PlacedCaption extends CaptionLayout {
  slot: CaptionSlot;
  /** Centre of the text block, in canvas px. */
  centerX: number;
  centerY: number;
  /** Widest line, in canvas px. */
  width: number;
  /** All lines, in canvas px. */
  height: number;
}

/**
 * Collapse the spaces within each line, drop blank lines, and apply the
 * uppercase toggle. A line break the user typed survives as a hard break for
 * `wrapWords`; blank lines do not, so a stray trailing Enter cannot add
 * invisible height to the caption block.
 */
export function normalizeCaption(text: string, uppercase: boolean): string {
  const collapsed = text
    .split(/\r\n?|\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
  return uppercase ? collapsed.toUpperCase() : collapsed;
}

export function strokeWidth(fontSize: number): number {
  return fontSize * STROKE_RATIO;
}

/**
 * Greedy word wrap that honours the line breaks already in `text`: each break
 * starts a new line and the segments wrap independently, so a break the user
 * typed is always kept. A single word wider than `maxWidth` still gets a line of
 * its own: breaking inside a word would change the joke, so shrinking is left to
 * the caller.
 */
export function wrapWords(
  text: string,
  maxWidth: number,
  fontSize: number,
  measure: MeasureText,
): string[] {
  const lines: string[] = [];
  for (const segment of text.split('\n')) {
    let line = '';
    for (const word of segment.split(' ')) {
      if (!word) continue;
      const candidate = line ? `${line} ${word}` : word;
      if (!line || measure(candidate, fontSize) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function allLinesFit(lines: string[], maxWidth: number, fontSize: number, measure: MeasureText) {
  return lines.every((line) => measure(line, fontSize) <= maxWidth);
}

/**
 * Height of a laid-out caption block, in px. `fitCaption` measures against this
 * and `placeCaption` positions by it, so the size that passed the fit is the
 * size that gets drawn.
 */
function blockHeight(lineCount: number, fontSize: number): number {
  return lineCount * fontSize * LINE_HEIGHT;
}

/**
 * Lay out one caption.
 *
 * With auto-fit on, the result uses the largest whole-pixel size between
 * `minFontSize` and `fontSize` at which the text wraps into at most `maxLines`
 * lines that each fit `maxWidth`. When even the floor does not fit, the floor
 * is used, the lines past the cap are joined into the last one, and `overflow`
 * is set so the UI can ask for shorter text.
 *
 * `maxLines` never falls below the number of lines `text` already has: the cap
 * exists to stop auto-wrapping from building a wall of text, and a break the
 * user typed is intent, not something to join away.
 *
 * The search only ever returns a size it has measured to fit, so it stays
 * correct even if a real font's widths are not perfectly monotonic in size.
 */
export function fitCaption(text: string, options: FitOptions): CaptionLayout {
  const { maxWidth, maxHeight, measure, autoFit } = options;
  const maxLines = Math.max(options.maxLines ?? MAX_CAPTION_LINES, text.split('\n').length);
  const preferred = Math.max(1, Math.floor(options.fontSize));

  if (!text) return { lines: [], fontSize: preferred, overflow: false };

  if (!autoFit) {
    const lines = wrapWords(text, maxWidth, preferred, measure);
    const fits =
      allLinesFit(lines, maxWidth, preferred, measure) && blockHeight(lines.length, preferred) <= maxHeight;
    return { lines, fontSize: preferred, overflow: !fits };
  }

  const floor = Math.min(preferred, Math.max(1, Math.ceil(options.minFontSize)));
  const fitsAt = (size: number): string[] | null => {
    const lines = wrapWords(text, maxWidth, size, measure);
    if (lines.length > maxLines || blockHeight(lines.length, size) > maxHeight) return null;
    return allLinesFit(lines, maxWidth, size, measure) ? lines : null;
  };

  const atPreferred = fitsAt(preferred);
  if (atPreferred) return { lines: atPreferred, fontSize: preferred, overflow: false };

  let best: { lines: string[]; fontSize: number } | null = null;
  let lo = floor;
  let hi = preferred - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const lines = fitsAt(mid);
    if (lines) {
      best = { lines, fontSize: mid };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best) return { ...best, overflow: false };

  const wrapped = wrapWords(text, maxWidth, floor, measure);
  const lines =
    wrapped.length > maxLines
      ? [...wrapped.slice(0, maxLines - 1), wrapped.slice(maxLines - 1).join(' ')]
      : wrapped;
  return { lines, fontSize: floor, overflow: true };
}

/** Gap between an auto-positioned caption and the canvas edge, in px. */
export function captionMargin(canvasWidth: number, canvasHeight: number): number {
  return Math.round(Math.min(canvasWidth, canvasHeight) * 0.04);
}

/**
 * Position a laid-out caption. `position === null` means "auto": top captions
 * hang from the top margin, bottom captions sit on the bottom margin.
 */
export function placeCaption(
  layout: CaptionLayout,
  slot: CaptionSlot,
  position: Point | null,
  canvasWidth: number,
  canvasHeight: number,
  measure: MeasureText,
): PlacedCaption {
  const height = blockHeight(layout.lines.length, layout.fontSize);
  const width = layout.lines.reduce((widest, line) => Math.max(widest, measure(line, layout.fontSize)), 0);

  let centerX = canvasWidth / 2;
  let centerY: number;
  if (position) {
    centerX = position.x * canvasWidth;
    centerY = position.y * canvasHeight;
  } else {
    const margin = captionMargin(canvasWidth, canvasHeight);
    centerY = slot === 'top' ? margin + height / 2 : canvasHeight - margin - height / 2;
  }
  return { ...layout, slot, centerX, centerY, width, height };
}

/** Which caption (if any) is under canvas point (x, y). Later captions are drawn on top, so they win. */
export function hitTestCaptions(placed: readonly PlacedCaption[], x: number, y: number): CaptionSlot | null {
  for (let i = placed.length - 1; i >= 0; i--) {
    const caption = placed[i];
    if (caption.lines.length === 0) continue;
    const pad = caption.fontSize * 0.25;
    if (
      Math.abs(x - caption.centerX) <= caption.width / 2 + pad &&
      Math.abs(y - caption.centerY) <= caption.height / 2 + pad
    ) {
      return caption.slot;
    }
  }
  return null;
}

export function clampPoint(point: Point): Point {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return { x: clamp(point.x), y: clamp(point.y) };
}
