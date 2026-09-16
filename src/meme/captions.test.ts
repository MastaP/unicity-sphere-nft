import { describe, expect, it } from 'vitest';
import {
  captionMargin,
  clampPoint,
  fitCaption,
  hitTestCaptions,
  LINE_HEIGHT,
  MAX_CAPTION_LINES,
  normalizeCaption,
  placeCaption,
  strokeWidth,
  wrapWords,
  type MeasureText,
} from './captions';

// Every character is half an em wide: widths scale linearly with the font size, like a real font.
const measure: MeasureText = (text, fontSize) => text.length * fontSize * 0.5;

const fitsAt = (text: string, size: number, maxWidth: number) => {
  const lines = wrapWords(text, maxWidth, size, measure);
  return lines.length <= MAX_CAPTION_LINES && lines.every((line) => measure(line, size) <= maxWidth);
};

describe('normalizeCaption', () => {
  it('collapses the spaces within a line and trims', () => {
    expect(normalizeCaption('  one   does\tnot  simply ', false)).toBe('one does not simply');
  });

  it('keeps the line breaks the user typed and drops the blank ones', () => {
    expect(normalizeCaption(' one does not \n\n  simply mint \n', false)).toBe('one does not\nsimply mint');
  });

  it('treats a CRLF or a lone CR as one break', () => {
    expect(normalizeCaption('one\r\ndoes\rnot', false)).toBe('one\ndoes\nnot');
  });

  it('uppercases only when the toggle is on', () => {
    expect(normalizeCaption('mint it', true)).toBe('MINT IT');
    expect(normalizeCaption('mint it', false)).toBe('mint it');
  });
});

describe('strokeWidth', () => {
  it('is proportional to the font size', () => {
    expect(strokeWidth(50) * 2).toBeCloseTo(strokeWidth(100));
    expect(strokeWidth(100)).toBeGreaterThan(0);
  });
});

describe('wrapWords', () => {
  it('breaks between words at the width', () => {
    // 10 px per character at size 20.
    expect(wrapWords('aaa bbb ccc', 70, 20, measure)).toEqual(['aaa bbb', 'ccc']);
  });

  it('gives an over-wide word a line of its own instead of splitting it', () => {
    expect(wrapWords('hi supercalifragilistic yo', 100, 20, measure)).toEqual([
      'hi',
      'supercalifragilistic',
      'yo',
    ]);
  });

  it('returns no lines for empty text', () => {
    expect(wrapWords('', 100, 20, measure)).toEqual([]);
  });

  it('breaks where the text already breaks, wrapping each line on its own', () => {
    expect(wrapWords('aaa\nbbb ccc', 70, 20, measure)).toEqual(['aaa', 'bbb ccc']);
  });

  it('keeps a typed break even where both lines would have fitted on one', () => {
    expect(wrapWords('aa\nbb', 400, 20, measure)).toEqual(['aa', 'bb']);
  });
});

describe('fitCaption', () => {
  // maxHeight is deliberately out of reach here, so these cases exercise the width rules alone.
  const base = { maxWidth: 400, maxHeight: 10_000, fontSize: 80, minFontSize: 10, autoFit: true, measure };

  it('keeps short text at the chosen size on one line', () => {
    expect(fitCaption('HELLO', base)).toEqual({ lines: ['HELLO'], fontSize: 80, overflow: false });
  });

  it('returns no lines for empty text', () => {
    expect(fitCaption('', base).lines).toEqual([]);
  });

  it('shrinks long text until it wraps into at most three lines that each fit the width', () => {
    const text = 'WHEN YOU FINALLY MINT YOUR FIRST MEME AND IT ACTUALLY WORKS ON THE FIRST TRY';
    const layout = fitCaption(text, base);

    expect(layout.overflow).toBe(false);
    expect(layout.fontSize).toBeLessThan(80);
    expect(layout.lines.length).toBeLessThanOrEqual(MAX_CAPTION_LINES);
    for (const line of layout.lines) expect(measure(line, layout.fontSize)).toBeLessThanOrEqual(400);
    expect(layout.lines.join(' ')).toBe(text);
  });

  it('picks the largest whole-pixel size that fits', () => {
    const texts = [
      'ONE DOES NOT SIMPLY',
      'ONE DOES NOT SIMPLY MINT A MEME WITHOUT A WALLET',
      'SUCH WOW VERY NFT MUCH TOKEN SO CHAIN AMAZE',
      'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
      'LOOOOOOOOOOOOOOOOOOONG WORD',
    ];
    for (const maxWidth of [150, 300, 512, 941]) {
      for (const text of texts) {
        const layout = fitCaption(text, { ...base, maxWidth });
        let expected = 0;
        for (let size = 80; size >= 10; size--) {
          if (fitsAt(text, size, maxWidth)) {
            expected = size;
            break;
          }
        }
        if (expected === 0) {
          expect(layout.overflow, `${text} @ ${maxWidth}`).toBe(true);
        } else {
          expect(layout.fontSize, `${text} @ ${maxWidth}`).toBe(expected);
          expect(layout.overflow).toBe(false);
        }
      }
    }
  });

  it('never grows past the chosen size', () => {
    expect(fitCaption('HI', { ...base, fontSize: 24 }).fontSize).toBe(24);
  });

  it('flags overflow at the floor size and keeps every word within three lines', () => {
    const text = 'THIS CAPTION IS FAR TOO LONG TO FIT ANYWHERE EVEN AT THE VERY SMALLEST SIZE ALLOWED';
    const layout = fitCaption(text, { ...base, maxWidth: 120, minFontSize: 20 });

    expect(layout.overflow).toBe(true);
    expect(layout.fontSize).toBe(20);
    expect(layout.lines).toHaveLength(MAX_CAPTION_LINES);
    expect(layout.lines.join(' ')).toBe(text);
  });

  it('honours more typed lines than the auto-wrap cap, shrinking instead of joining them', () => {
    const text = 'ONE\nDOES NOT\nSIMPLY\nMINT A MEME';
    const layout = fitCaption(text, base);

    expect(layout.lines).toEqual(['ONE', 'DOES NOT', 'SIMPLY', 'MINT A MEME']);
    expect(layout.lines.length).toBeGreaterThan(MAX_CAPTION_LINES);
    expect(layout.overflow).toBe(false);
    // 'MINT A MEME' is 11 characters, so 72 is the largest size fitting 400 px.
    expect(layout.fontSize).toBe(72);
  });

  it('shrinks typed lines that would otherwise run past the available height', () => {
    // 50 single-character lines: within the 100-character field limit, and every line
    // fits the width, so only a height check can stop them rendering off the image.
    const text = Array.from({ length: 50 }, () => 'A').join('\n');
    const layout = fitCaption(text, { ...base, maxHeight: 600 });

    expect(layout.overflow).toBe(false);
    expect(layout.lines).toHaveLength(50);
    expect(layout.fontSize).toBeLessThan(80);
    expect(layout.lines.length * layout.fontSize * LINE_HEIGHT).toBeLessThanOrEqual(600);
  });

  it('flags overflow when typed lines cannot fit the height even at the floor size', () => {
    const text = Array.from({ length: 50 }, () => 'A').join('\n');
    const layout = fitCaption(text, { ...base, maxHeight: 100 });

    expect(layout.overflow).toBe(true);
    expect(layout.fontSize).toBe(10);
  });

  it('collapses a typed segment onto one line rather than merging two of them', () => {
    // The first segment needs two lines at the floor size, which pushes the block past
    // the cap. The break between DDD and EEE has room to survive, so it must.
    const text = 'ONE DOES NOT SIMPLY MINT A MEME WITHOUT A WALLET AND A LOT OF PATIENCE OK\nDDD\nEEE';
    const layout = fitCaption(text, { ...base, maxWidth: 120, minFontSize: 20 });

    expect(layout.overflow).toBe(true);
    expect(layout.lines.at(-2)).toBe('DDD');
    expect(layout.lines.at(-1)).toBe('EEE');
    expect(layout.lines.join(' ')).toBe(text.replace(/\n/g, ' '));
  });

  it('keeps the unfittable fallback inside the height, merging across breaks only then', () => {
    const text = Array.from({ length: 50 }, () => 'A').join('\n');
    const layout = fitCaption(text, { ...base, maxHeight: 100 });

    expect(layout.overflow).toBe(true);
    expect(layout.lines.length * layout.fontSize * LINE_HEIGHT).toBeLessThanOrEqual(100);
    expect(layout.lines.join(' ')).toBe(text.replace(/\n/g, ' '));
  });

  it('with auto-fit off, flags a block taller than the height', () => {
    const text = Array.from({ length: 20 }, () => 'A').join('\n');
    expect(fitCaption(text, { ...base, autoFit: false, maxHeight: 200 }).overflow).toBe(true);
    expect(fitCaption(text, { ...base, autoFit: false, maxHeight: 10_000 }).overflow).toBe(false);
  });

  it('with auto-fit off, wraps at the chosen size without shrinking or capping lines', () => {
    const text = 'A LONG CAPTION THAT NEEDS MANY LINES AT THIS SIZE';
    // 40 px per character: the longest word (CAPTION, 280 px) fits, whole phrases do not.
    const layout = fitCaption(text, { ...base, maxWidth: 300, autoFit: false });

    expect(layout.fontSize).toBe(80);
    expect(layout.lines.length).toBeGreaterThan(MAX_CAPTION_LINES);
    expect(layout.overflow).toBe(false);
  });

  it('with auto-fit off, flags a word wider than the canvas', () => {
    expect(fitCaption('ABSOLUTELYENORMOUS', { ...base, maxWidth: 100, autoFit: false }).overflow).toBe(true);
  });
});

describe('placeCaption / hitTestCaptions', () => {
  const W = 1000;
  const H = 600;
  const layout = { lines: ['TOP', 'TEXT'], fontSize: 50, overflow: false };

  it('hangs an auto top caption from the top margin and sits a bottom caption on the bottom margin', () => {
    const margin = captionMargin(W, H);
    const height = 2 * 50 * LINE_HEIGHT;

    const top = placeCaption(layout, 'top', null, W, H, measure);
    expect(top.centerX).toBe(W / 2);
    expect(top.centerY - top.height / 2).toBeCloseTo(margin);
    expect(top.height).toBeCloseTo(height);
    expect(top.width).toBe(measure('TEXT', 50));

    const bottom = placeCaption(layout, 'bottom', null, W, H, measure);
    expect(bottom.centerY + bottom.height / 2).toBeCloseTo(H - margin);
  });

  it('centres a dragged caption on its stored fractional position', () => {
    const placed = placeCaption(layout, 'top', { x: 0.25, y: 0.5 }, W, H, measure);
    expect(placed.centerX).toBe(250);
    expect(placed.centerY).toBe(300);
  });

  it('finds the caption under a point, and nothing elsewhere', () => {
    const top = placeCaption(layout, 'top', null, W, H, measure);
    const bottom = placeCaption(layout, 'bottom', null, W, H, measure);

    expect(hitTestCaptions([top, bottom], top.centerX, top.centerY)).toBe('top');
    expect(hitTestCaptions([top, bottom], bottom.centerX, bottom.centerY)).toBe('bottom');
    expect(hitTestCaptions([top, bottom], 5, H / 2)).toBeNull();
  });

  it('lets the caption drawn last win where two overlap', () => {
    const a = placeCaption(layout, 'top', { x: 0.5, y: 0.5 }, W, H, measure);
    const b = placeCaption(layout, 'bottom', { x: 0.5, y: 0.5 }, W, H, measure);
    expect(hitTestCaptions([a, b], 500, 300)).toBe('bottom');
  });

  it('clamps positions into the canvas', () => {
    expect(clampPoint({ x: -0.2, y: 1.4 })).toEqual({ x: 0, y: 1 });
    expect(clampPoint({ x: 0.3, y: 0.7 })).toEqual({ x: 0.3, y: 0.7 });
  });
});
