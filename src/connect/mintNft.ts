/**
 * The `mint_nft` Connect intent (Connect 2.3): the SDK's wire types, plus result parsing.
 *
 * `WireNftContent` is the SDK's `NftContent` with every inline `bytes: Uint8Array`
 * replaced by standard base64: Connect messages are JSON, and the extension
 * transport cannot carry a Uint8Array. Taking the types from the SDK means the
 * compiler checks this app against the same contract the wallet decodes with.
 */
import { INTENT_ACTIONS } from '@unicitylabs/sphere-sdk/connect';
import type { NftAttribute } from '@unicitylabs/sphere-sdk/connect';

export type {
  MintNftIntentParams,
  MintNftIntentResult,
  NftLink,
  WireNftContent,
  WireNftMedia,
  WireNftMetadata,
} from '@unicitylabs/sphere-sdk/connect';

export type WireNftAttribute = NftAttribute;

export const MINT_NFT_INTENT = INTENT_ACTIONS.MINT_NFT;

const TOKEN_ID = /^[0-9a-f]{64}$/i;

/** A token id carried by an untrusted value (an intent result or error data), or null. */
export function readTokenId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const tokenId = (value as { tokenId?: unknown }).tokenId;
  return typeof tokenId === 'string' && TOKEN_ID.test(tokenId) ? tokenId.toLowerCase() : null;
}
