import type { WireNftAttribute, WireNftMetadata } from '../connect/mintNft';
import { bytesToBase64 } from './base64';

export const MEME_EXTERNAL_URL = 'https://mastap.github.io/unicity-sphere-nft/';
export const MEME_COLLECTION = 'Sphere Memes';
export const TITLE_MAX_LENGTH = 80;
export const DESCRIPTION_MAX_LENGTH = 500;

export interface MemeNftInput {
  title: string;
  description: string;
  topText: string;
  bottomText: string;
  /** The exported image, as encoded. `mediaType` must be the encoding actually used. */
  image: { mediaType: string; bytes: Uint8Array };
}

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The title the mint form starts with: the captions, as typed. */
export function suggestTitle(topText: string, bottomText: string): string {
  return [tidy(topText), tidy(bottomText)]
    .filter(Boolean)
    .join(' / ')
    .slice(0, TITLE_MAX_LENGTH)
    .trim();
}

/** The `content` of a mint_nft intent for a meme. */
export function buildMemeNftContent(input: MemeNftInput): WireNftMetadata {
  const name = tidy(input.title);
  if (!name) throw new Error('A title is required.');

  const attributes: WireNftAttribute[] = [];
  const top = tidy(input.topText);
  const bottom = tidy(input.bottomText);
  if (top) attributes.push({ trait_type: 'Top text', value: top });
  if (bottom) attributes.push({ trait_type: 'Bottom text', value: bottom });

  return {
    kind: 'metadata',
    name,
    description: input.description.trim() || null,
    image: { kind: 'media', media_type: input.image.mediaType, bytes: bytesToBase64(input.image.bytes) },
    animation_url: null,
    external_url: MEME_EXTERNAL_URL,
    attributes,
    collection: MEME_COLLECTION,
    // No stable collection identifier: "Sphere Memes" is an open collection, so claiming one would mean nothing.
    collection_id: null,
  };
}
