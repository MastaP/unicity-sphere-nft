import { Buffer } from 'node:buffer';
import { nftContentFromWire } from '@unicitylabs/sphere-sdk/connect';
import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';
import {
  buildMemeNftContent,
  MEME_COLLECTION,
  MEME_EXTERNAL_URL,
  suggestTitle,
  TITLE_MAX_LENGTH,
} from './memeContent';

describe('base64', () => {
  it('uses the standard alphabet with padding, not the URL-safe one', () => {
    expect(bytesToBase64(new Uint8Array([0xfb, 0xff]))).toBe('+/8=');
    expect(bytesToBase64(new Uint8Array([0xfb]))).toBe('+w==');
    expect(bytesToBase64(new Uint8Array([]))).toBe('');
  });

  it('round-trips every byte value and every padding length', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    for (let length = 0; length <= all.length; length += 1) {
      const bytes = all.subarray(0, length);
      const encoded = bytesToBase64(bytes);
      expect(encoded).toBe(Buffer.from(bytes).toString('base64'));
      expect(base64ToBytes(encoded)).toEqual(bytes);
    }
  });

  it('round-trips an image-sized buffer across chunk boundaries', () => {
    const bytes = Uint8Array.from({ length: 900_001 }, (_, i) => (i * 131 + 7) % 256);
    const encoded = bytesToBase64(bytes);
    expect(encoded).toBe(Buffer.from(bytes).toString('base64'));
    expect(base64ToBytes(encoded)).toEqual(bytes);
  });
});

describe('buildMemeNftContent', () => {
  const bytes = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x00, 0xff, 0x10]);
  const input = {
    title: '  One does not simply  ',
    description: '  Made with Sphere Memes \n',
    topText: 'One does not simply',
    bottomText: 'mint a meme',
    image: { mediaType: 'image/webp', bytes },
  };

  it('builds the metadata content exactly per the mint_nft contract', () => {
    expect(buildMemeNftContent(input)).toEqual({
      kind: 'metadata',
      name: 'One does not simply',
      description: 'Made with Sphere Memes',
      image: { kind: 'media', media_type: 'image/webp', bytes: Buffer.from(bytes).toString('base64') },
      animation_url: null,
      external_url: MEME_EXTERNAL_URL,
      attributes: [
        { trait_type: 'Top text', value: 'One does not simply' },
        { trait_type: 'Bottom text', value: 'mint a meme' },
      ],
      collection: MEME_COLLECTION,
      collection_id: null,
    });
    expect(MEME_EXTERNAL_URL).toBe('https://mastap.github.io/unicity-sphere-nft/');
    expect(MEME_COLLECTION).toBe('Sphere Memes');
  });

  it("passes the wallet's own mint_nft decoder, so a wallet on the same SDK accepts it", () => {
    // The wallet validates the intent with nftContentFromWire before any dialog opens; a
    // missing or extra field is refused there with INVALID_PARAMS.
    const decoded = nftContentFromWire(buildMemeNftContent(input));
    if (decoded.kind !== 'metadata') throw new Error('expected metadata');
    expect(decoded.name).toBe('One does not simply');
    expect(decoded.collection_id).toBeNull();
    expect(decoded.image).toMatchObject({ kind: 'media', media_type: 'image/webp' });
  });

  it('carries image bytes that decode back to the exported file', () => {
    const content = buildMemeNftContent(input);
    const image = content.image;
    if (image?.kind !== 'media') throw new Error('expected inline media');
    expect(base64ToBytes(image.bytes)).toEqual(bytes);
  });

  it('takes media_type from the encoding actually chosen', () => {
    const content = buildMemeNftContent({ ...input, image: { mediaType: 'image/jpeg', bytes } });
    expect(content.image).toMatchObject({ kind: 'media', media_type: 'image/jpeg' });
  });

  it('omits empty captions from the attributes', () => {
    expect(buildMemeNftContent({ ...input, topText: '   ', bottomText: '' }).attributes).toEqual([]);
    expect(buildMemeNftContent({ ...input, topText: '' }).attributes).toEqual([
      { trait_type: 'Bottom text', value: 'mint a meme' },
    ]);
    expect(buildMemeNftContent({ ...input, bottomText: ' ' }).attributes).toEqual([
      { trait_type: 'Top text', value: 'One does not simply' },
    ]);
  });

  it('sends a blank description as null', () => {
    expect(buildMemeNftContent({ ...input, description: ' \n ' }).description).toBeNull();
  });

  it('refuses an empty title', () => {
    expect(() => buildMemeNftContent({ ...input, title: '   ' })).toThrow(/title/i);
  });
});

describe('suggestTitle', () => {
  it('joins the non-empty captions', () => {
    expect(suggestTitle('One  does not simply', 'mint a meme')).toBe('One does not simply / mint a meme');
    expect(suggestTitle('', 'only bottom')).toBe('only bottom');
    expect(suggestTitle(' ', '')).toBe('');
  });

  it('stays within the title limit', () => {
    expect(suggestTitle('x'.repeat(200), 'y').length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
  });
});
