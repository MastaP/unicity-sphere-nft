/**
 * What a Connect failure means for this app, in words a person can act on.
 *
 * Coded errors are discriminated on the numeric `.code` (duck-typed, never
 * `instanceof`: the SDK warns that breaks across bundle copies). Message text
 * is consulted only for the failures the SDK raises without a code.
 */
import { ERROR_CODES } from '@unicitylabs/sphere-sdk/connect';
import { readTokenId } from './mintNft';

export type NoticeTone = 'error' | 'warning' | 'info';

export interface Notice {
  tone: NoticeTone;
  title: string;
  detail?: string;
  /** The wallet's own words, shown as secondary text. */
  reason?: string;
  /** A token that may still be minted. */
  tokenId?: string;
}

export function errorCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'number' ? code : undefined;
}

function errorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (typeof err !== 'object' || err === null) return '';
  const message = (err as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

function errorData(err: unknown): unknown {
  return typeof err === 'object' && err !== null ? (err as { data?: unknown }).data : undefined;
}

/** `MAJOR.MINOR` from a Connect protocol version string, or null. */
export function parseProtocolVersion(version: string | null | undefined) {
  if (typeof version !== 'string') return null;
  const match = /^(\d+)\.(\d+)$/.exec(version.trim());
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : null;
}

function atLeast(version: string | null | undefined, major: number, minor: number): boolean | null {
  const parsed = parseProtocolVersion(version);
  if (!parsed) return null;
  return parsed.major > major || (parsed.major === major && parsed.minor >= minor);
}

/** Connect 2.3 added `mint_nft`. null when the wallet reported no usable version. */
export function walletKnowsNftMint(walletProtocol: string | null | undefined): boolean | null {
  return atLeast(walletProtocol, 2, 3);
}

/**
 * Connect 2.1 made a lock a state: the session survives and `wallet:unlocked`
 * follows. A 2.0 wallet revoked the session on lock, so waiting would wait
 * forever. An unreadable version counts as legacy for the same reason.
 */
export function walletKeepsSessionWhenLocked(walletProtocol: string | null | undefined): boolean {
  return atLeast(walletProtocol, 2, 1) === true;
}

export type MintSupport = 'supported' | 'unsupported' | 'not-granted';

/** Whether a mint can work on this connection, judged before trying one. */
export function mintSupport(walletProtocol: string | null | undefined, permissions: readonly string[]): MintSupport {
  if (walletKnowsNftMint(walletProtocol) === false) return 'unsupported';
  if (!permissions.includes('nft:mint')) return 'not-granted';
  return 'supported';
}

export const UNSUPPORTED_WALLET_NOTICE: Notice = {
  tone: 'error',
  title: "This wallet doesn't support minting NFTs yet",
  detail: 'Minting needs a Sphere wallet with Sphere Connect 2.3 or newer. Update Sphere, then connect again.',
};

export const NOT_GRANTED_NOTICE: Notice = {
  tone: 'error',
  title: "Minting isn't allowed for this app",
  detail: 'Disconnect, connect again, and allow minting NFTs when your wallet asks.',
};

const POPUP_CLOSED = /popup was closed/i;
const POPUP_BLOCKED = /failed to open wallet popup|popup blocked/i;
const HANDSHAKE_REFUSED = /connection rejected by wallet/i;
const NO_ANSWER = /did not respond in time|connection timeout/i;

/**
 * Copy for a failed interactive connect, or null when there is nothing to say
 * (the user declined or closed the wallet window).
 */
export function describeConnectFailure(err: unknown): Notice | null {
  const code = errorCode(err);
  const message = errorMessage(err);

  switch (code) {
    case ERROR_CODES.INCOMPATIBLE_NETWORK:
      return {
        tone: 'error',
        title: 'Your wallet is on a different network',
        detail: 'Sphere Memes runs on testnet. Switch your wallet to testnet, then connect again.',
      };
    case ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION:
      return {
        tone: 'error',
        title: "Your wallet can't talk to this app",
        detail: 'Sphere Memes and your wallet use incompatible Sphere Connect versions. Update Sphere, then reload this page.',
        reason: message || undefined,
      };
    // A wallet that checks requested scopes and does not know nft:mint.
    case ERROR_CODES.PERMISSION_DENIED:
    case ERROR_CODES.INVALID_PARAMS:
    case ERROR_CODES.INVALID_REQUEST:
      return { ...UNSUPPORTED_WALLET_NOTICE, reason: message || undefined };
    case ERROR_CODES.USER_REJECTED:
      return null;
    case ERROR_CODES.ORIGIN_BLOCKED:
      return { tone: 'error', title: 'Your wallet refused connections from this site' };
    case ERROR_CODES.RATE_LIMITED:
      return { tone: 'error', title: 'Too many attempts', detail: 'Wait a moment, then connect again.' };
  }

  if (code === undefined) {
    if (POPUP_CLOSED.test(message)) return null;
    if (POPUP_BLOCKED.test(message)) {
      return {
        tone: 'error',
        title: 'Your browser blocked the wallet window',
        detail: 'Allow pop-ups for this site, then connect again.',
      };
    }
    // An empty handshake refusal carries no code: a declined prompt and a
    // wallet that refuses an unknown scope look identical from here.
    if (HANDSHAKE_REFUSED.test(message)) {
      return {
        tone: 'info',
        title: 'Not connected',
        detail:
          "The wallet didn't approve the connection. If you did approve it, your wallet may not support minting NFTs yet (it needs Sphere Connect 2.3 or newer).",
      };
    }
    if (NO_ANSWER.test(message)) {
      return {
        tone: 'error',
        title: "Your wallet didn't respond",
        detail: 'Make sure Sphere has finished loading, then connect again.',
      };
    }
  }

  return { tone: 'error', title: "Couldn't connect to your wallet", reason: message || undefined };
}

export interface MintFailure {
  notice: Notice;
  /** What the failure does to the connection. */
  effect: 'none' | 'locked' | 'disconnected';
}

/** Codeless SDK failures that mean the connection itself is gone. */
const CONNECTION_GONE =
  /\b(not connected|disconnected|connection timeout|query timeout|intent timeout|extension context invalidated|receiving end does not exist|could not establish connection)\b/i;

export function classifyMintFailure(
  err: unknown,
  connection: { walletProtocol: string | null; permissions: readonly string[] },
): MintFailure {
  const code = errorCode(err);
  const message = errorMessage(err);

  // Checked first: a journaled mint names its token, whatever the code says,
  // and the wallet resumes it. Nothing else may claim the mint did not happen.
  const tokenId = readTokenId(errorData(err));
  if (tokenId) {
    return {
      effect: 'none',
      notice: {
        tone: 'warning',
        title: 'The mint may still complete',
        detail: "Your wallet will finish it if it can. Check your wallet's Tokens tab before minting again.",
        reason: message || undefined,
        tokenId,
      },
    };
  }

  switch (code) {
    case ERROR_CODES.USER_REJECTED:
    case ERROR_CODES.INTENT_CANCELLED:
      return { effect: 'none', notice: { tone: 'info', title: 'Mint cancelled in your wallet' } };
    case ERROR_CODES.INTENT_OUTCOME_UNKNOWN:
      return {
        effect: 'none',
        notice: {
          tone: 'warning',
          title: 'The mint may still complete',
          detail: "The wallet's answer never arrived. Check your wallet's Tokens tab before minting again.",
        },
      };
    case ERROR_CODES.WALLET_LOCKED:
      return {
        effect: 'locked',
        notice: { tone: 'info', title: 'Your wallet is locked', detail: 'Unlock Sphere, then mint again.' },
      };
    case ERROR_CODES.PERMISSION_DENIED:
      // Below 2.3 the wallet has no mint_nft at all; from 2.3 a denial can only mean the scope.
      return {
        effect: 'none',
        notice: walletKnowsNftMint(connection.walletProtocol) === true ? NOT_GRANTED_NOTICE : UNSUPPORTED_WALLET_NOTICE,
      };
    case ERROR_CODES.METHOD_NOT_FOUND:
      return { effect: 'none', notice: UNSUPPORTED_WALLET_NOTICE };
    case ERROR_CODES.INVALID_PARAMS:
      return {
        effect: 'none',
        notice: { tone: 'error', title: 'The wallet rejected the meme data', reason: message || undefined },
      };
    case ERROR_CODES.NOT_CONNECTED:
    case ERROR_CODES.SESSION_EXPIRED:
      return { effect: 'disconnected', notice: CONNECTION_LOST_NOTICE };
  }

  if (code === undefined && CONNECTION_GONE.test(message)) {
    return { effect: 'disconnected', notice: CONNECTION_LOST_NOTICE };
  }

  return { effect: 'none', notice: { tone: 'error', title: 'Mint failed', reason: message || undefined } };
}

const CONNECTION_LOST_NOTICE: Notice = {
  tone: 'error',
  title: 'Lost the connection to your wallet',
  detail: 'Connect again, then mint.',
};
