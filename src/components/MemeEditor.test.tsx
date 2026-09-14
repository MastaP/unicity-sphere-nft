import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadImage, type LoadedImage } from '../meme/image';
import { DEFAULT_SETTINGS } from '../meme/render';
import { MemeEditor } from './MemeEditor';

vi.mock('../meme/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../meme/image')>();
  return { ...actual, loadImage: vi.fn() };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeImage(name: string) {
  const dispose = vi.fn();
  const image: LoadedImage = { source: {} as CanvasImageSource, width: 10, height: 10, name, dispose };
  return { image, dispose };
}

const file = (name: string) => new File([new Uint8Array([1])], name, { type: 'image/png' });

function renderEditor(onImage = vi.fn()) {
  const view = render(
    <MemeEditor image={null} onImage={onImage} settings={DEFAULT_SETTINGS} onSettingsChange={() => {}} />,
  );
  const pick = (name: string) => fireEvent.change(screen.getByLabelText('Choose image'), { target: { files: [file(name)] } });
  return { ...view, onImage, pick };
}

describe('MemeEditor image picks', () => {
  const slow = deferred<LoadedImage>();
  const fast = deferred<LoadedImage>();
  let older: ReturnType<typeof fakeImage>;
  let newer: ReturnType<typeof fakeImage>;

  beforeEach(() => {
    Object.assign(slow, deferred<LoadedImage>());
    Object.assign(fast, deferred<LoadedImage>());
    older = fakeImage('slow.png');
    newer = fakeImage('new.png');
    vi.mocked(loadImage).mockReset();
    vi.mocked(loadImage).mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
  });

  it('never lets a slower earlier decode replace the newer pick, and releases it', async () => {
    const { onImage, pick } = renderEditor();
    pick('slow.png');
    pick('new.png');

    await act(async () => fast.resolve(newer.image));
    expect(onImage).toHaveBeenCalledTimes(1);
    expect(onImage).toHaveBeenLastCalledWith(newer.image);

    await act(async () => slow.resolve(older.image));
    expect(onImage).toHaveBeenCalledTimes(1);
    expect(older.dispose).toHaveBeenCalledTimes(1);
    expect(newer.dispose).not.toHaveBeenCalled();
  });

  it('keeps loading until the newest pick finishes, not the first', async () => {
    const { onImage, pick } = renderEditor();
    pick('slow.png');
    pick('new.png');

    await act(async () => slow.resolve(older.image));
    expect(screen.getByText('Loading image…')).toBeInTheDocument();
    expect(onImage).not.toHaveBeenCalled();

    await act(async () => fast.resolve(newer.image));
    expect(onImage).toHaveBeenCalledWith(newer.image);
    expect(screen.queryByText('Loading image…')).not.toBeInTheDocument();
  });

  it('does not show an earlier pick’s failure over the newer image', async () => {
    const { pick } = renderEditor();
    pick('slow.png');
    pick('new.png');

    await act(async () => fast.resolve(newer.image));
    await act(async () => slow.reject(new Error('decode failed')));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('releases a decode that finishes after the editor unmounts', async () => {
    const { onImage, pick, unmount } = renderEditor();
    pick('slow.png');
    unmount();

    await act(async () => slow.resolve(older.image));

    expect(onImage).not.toHaveBeenCalled();
    expect(older.dispose).toHaveBeenCalledTimes(1);
  });
});
