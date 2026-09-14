import { PERMISSION_SCOPES, SPHERE_NETWORKS } from '@unicitylabs/sphere-sdk/connect';
import type { DAppMetadata, PermissionScope } from '@unicitylabs/sphere-sdk/connect';
import iconUrl from '../assets/sphere-memes.svg';

/**
 * The only Connect scopes this app asks for, always passed explicitly —
 * omitting `permissions` makes the client request every scope there is.
 *
 *   identity:read  show who is connected
 *   nft:mint       mint the meme into the connected wallet
 */
export const SPHERE_PERMISSIONS: readonly PermissionScope[] = [
  PERMISSION_SCOPES.IDENTITY_READ,
  PERMISSION_SCOPES.NFT_MINT,
];

export function requestedScopes(): PermissionScope[] {
  // A fresh array per call, so no caller can edit the constant.
  return [...SPHERE_PERMISSIONS];
}

export const DEFAULT_WALLET_URL = 'https://sphere.unicity.network';

/** The wallet opened in popup mode. Trailing slashes are dropped: autoConnect appends `/connect`. */
export function resolveWalletUrl(configured: string | undefined): string {
  return (configured ?? '').trim().replace(/\/+$/, '') || DEFAULT_WALLET_URL;
}

export const WALLET_URL = resolveWalletUrl(import.meta.env.VITE_WALLET_URL);

export const NETWORK = SPHERE_NETWORKS.testnet2;

export function dappMetadata(): DAppMetadata {
  return {
    name: 'Sphere Memes',
    description: 'Make a meme and mint it as an NFT into your Sphere wallet.',
    url: location.origin + import.meta.env.BASE_URL,
    icon: new URL(iconUrl, location.href).href,
  };
}

/** A silent check must not leave "Connecting…" on screen for long when no wallet answers. */
export const SILENT_CONNECT_TIMEOUT_MS = 8_000;
/** An interactive handshake includes the user reading the approval prompt (the wallet allows 120 s). */
export const INTERACTIVE_CONNECT_TIMEOUT_MS = 120_000;
/**
 * A mint covers review, confirmation and certification. Kept longer than the
 * wallet's own intent deadline so the wallet's answer, not this timer, decides.
 */
export const MINT_INTENT_TIMEOUT_MS = 300_000;
