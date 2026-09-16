import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, layoutMeme, type MemeSettings } from './render';

/**
 * A 2D context stand-in. `layoutMeme` only ever sets `font` and measures text, so
 * this is enough to exercise the real layout at real canvas sizes — jsdom has no
 * `getContext`, which is why these rules were otherwise untestable.
 */
function fakeCtx(): CanvasRenderingContext2D {
  let fontSize = 10;
  return {
    set font(value: string) {
      fontSize = Number.parseFloat(value.split(' ')[1]) || fontSize;
    },
    get font() {
      return `400 ${fontSize}px test`;
    },
    measureText: (text: string) => ({ width: text.length * fontSize * 0.5 }),
  } as unknown as CanvasRenderingContext2D;
}

const settingsWith = (top: string, bottom = ''): MemeSettings => ({
  ...DEFAULT_SETTINGS,
  top: { text: top, position: null },
  bottom: { text: bottom, position: null },
});

const topEdge = (caption: { centerY: number; height: number }) => caption.centerY - caption.height / 2;
const bottomEdge = (caption: { centerY: number; height: number }) => caption.centerY + caption.height / 2;

describe('layoutMeme', () => {
  const W = 1024;
  const H = 1024;

  it('keeps two auto-placed multi-line captions from overlapping', () => {
    // Four short typed lines in each field: trivially reachable, and with a
    // per-caption height budget the two blocks would cover 184% of the canvas.
    const four = 'LINE0\nLINE1\nLINE2\nLINE3';
    const placed = layoutMeme(fakeCtx(), settingsWith(four, four), W, H);

    expect(placed).toHaveLength(2);
    const top = placed.find((caption) => caption.slot === 'top')!;
    const bottom = placed.find((caption) => caption.slot === 'bottom')!;

    expect(top.overflow).toBe(false);
    expect(bottom.overflow).toBe(false);
    expect(bottomEdge(top)).toBeLessThanOrEqual(topEdge(bottom));
  });

  it('keeps a caption that cannot fit inside the canvas anyway', () => {
    // 50 typed lines is 99 characters, inside the field limit. Before the height
    // bound this drew hundreds of pixels past the bottom edge.
    const placed = layoutMeme(fakeCtx(), settingsWith(Array.from({ length: 50 }, () => 'A').join('\n')), W, H);

    expect(placed).toHaveLength(1);
    expect(placed[0].overflow).toBe(true);
    expect(topEdge(placed[0])).toBeGreaterThanOrEqual(0);
    expect(bottomEdge(placed[0])).toBeLessThanOrEqual(H);
  });

  it('lets a lone caption use the whole band, not half of it', () => {
    const many = Array.from({ length: 8 }, (_, i) => `LINE${String(i)}`).join('\n');
    const alone = layoutMeme(fakeCtx(), settingsWith(many), W, H)[0];
    const paired = layoutMeme(fakeCtx(), settingsWith(many, 'X'), W, H).find((c) => c.slot === 'top')!;

    expect(alone.fontSize).toBeGreaterThan(paired.fontSize);
  });

  it('splits the band between auto-placed captions only, not dragged ones', () => {
    // A dragged caption hangs from no margin, so it must not cost the other one half
    // its height budget — that would shrink a caption, or flag it overflowing, for a
    // collision that cannot happen where the user put it.
    const many = Array.from({ length: 8 }, (_, i) => `LINE${String(i)}`).join('\n');
    const bothAuto = layoutMeme(fakeCtx(), settingsWith(many, 'X'), W, H).find((c) => c.slot === 'top')!;
    const withDragged = layoutMeme(
      fakeCtx(),
      { ...settingsWith(many, 'X'), bottom: { text: 'X', position: { x: 0.5, y: 0.5 } } },
      W,
      H,
    ).find((c) => c.slot === 'top')!;

    expect(withDragged.fontSize).toBeGreaterThan(bothAuto.fontSize);
  });

  it('leaves out an empty caption', () => {
    expect(layoutMeme(fakeCtx(), settingsWith('  \n\n  ', 'REAL'), W, H).map((c) => c.slot)).toEqual(['bottom']);
  });
});
