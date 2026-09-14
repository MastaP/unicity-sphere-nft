import { ERROR_CODES } from '@unicitylabs/sphere-sdk/connect';
import { describe, expect, it } from 'vitest';
import {
  classifyMintFailure,
  describeConnectFailure,
  mintSupport,
  NOT_GRANTED_NOTICE,
  UNSUPPORTED_WALLET_NOTICE,
  walletKeepsSessionWhenLocked,
  walletKnowsNftMint,
} from './errors';

const coded = (code: number, message = 'refused', data?: unknown) => Object.assign(new Error(message), { code, data });
const TOKEN = 'ab'.repeat(32);
const on = (walletProtocol: string | null, permissions: string[] = ['identity:read', 'nft:mint']) => ({
  walletProtocol,
  permissions,
});

describe('error codes this app relies on', () => {
  it('match the Connect protocol', () => {
    expect(ERROR_CODES.INVALID_PARAMS).toBe(-32602);
    expect(ERROR_CODES.PERMISSION_DENIED).toBe(4002);
    expect(ERROR_CODES.USER_REJECTED).toBe(4003);
    expect(ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION).toBe(4007);
    expect(ERROR_CODES.INCOMPATIBLE_NETWORK).toBe(4008);
  });
});

describe('wallet protocol checks', () => {
  it('knows mint_nft from Connect 2.3', () => {
    expect(walletKnowsNftMint('2.3')).toBe(true);
    expect(walletKnowsNftMint('2.10')).toBe(true);
    expect(walletKnowsNftMint('3.0')).toBe(true);
    expect(walletKnowsNftMint('2.2')).toBe(false);
    expect(walletKnowsNftMint(null)).toBeNull();
    expect(walletKnowsNftMint('two')).toBeNull();
  });

  it('keeps the session across a lock from Connect 2.1, treating unknown as legacy', () => {
    expect(walletKeepsSessionWhenLocked('2.1')).toBe(true);
    expect(walletKeepsSessionWhenLocked('2.0')).toBe(false);
    expect(walletKeepsSessionWhenLocked(null)).toBe(false);
  });

  it('judges mint support from the version and the granted scopes', () => {
    expect(mintSupport('2.2', ['identity:read', 'nft:mint'])).toBe('unsupported');
    expect(mintSupport('2.3', ['identity:read'])).toBe('not-granted');
    expect(mintSupport('2.3', ['identity:read', 'nft:mint'])).toBe('supported');
    expect(mintSupport(null, ['identity:read', 'nft:mint'])).toBe('supported');
  });
});

describe('describeConnectFailure', () => {
  it('asks for testnet on a network mismatch', () => {
    const notice = describeConnectFailure(coded(ERROR_CODES.INCOMPATIBLE_NETWORK));
    expect(notice?.tone).toBe('error');
    expect(notice?.detail).toMatch(/testnet/);
  });

  it('explains a protocol mismatch and keeps the wallet reason', () => {
    const notice = describeConnectFailure(coded(ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION, 'app speaks 3.0, wallet 2.2'));
    expect(notice?.detail).toMatch(/Connect versions/);
    expect(notice?.reason).toBe('app speaks 3.0, wallet 2.2');
  });

  it('reports a wallet that refuses the nft:mint scope as not supporting minting', () => {
    for (const code of [ERROR_CODES.PERMISSION_DENIED, ERROR_CODES.INVALID_PARAMS]) {
      expect(describeConnectFailure(coded(code, 'Unknown permission: nft:mint'))?.title).toBe(
        UNSUPPORTED_WALLET_NOTICE.title,
      );
    }
  });

  it('stays quiet when the user declines or closes the wallet window', () => {
    expect(describeConnectFailure(coded(ERROR_CODES.USER_REJECTED))).toBeNull();
    expect(describeConnectFailure(new Error('autoConnect: Wallet popup was closed before connecting'))).toBeNull();
  });

  it('turns an uncoded handshake refusal into a gentle note that mentions minting support', () => {
    const notice = describeConnectFailure(new Error('Connection rejected by wallet'));
    expect(notice?.tone).toBe('info');
    expect(notice?.detail).toMatch(/minting NFTs/);
  });

  it('names a blocked popup and an unresponsive wallet', () => {
    expect(
      describeConnectFailure(new Error('autoConnect: Failed to open wallet popup — check popup blocker settings'))?.title,
    ).toMatch(/blocked/);
    expect(describeConnectFailure(new Error('Connection timeout'))?.title).toMatch(/didn't respond/);
  });

  it('falls back to the raw message', () => {
    expect(describeConnectFailure(new Error('weird'))).toMatchObject({ tone: 'error', reason: 'weird' });
  });
});

describe('classifyMintFailure', () => {
  it('is quiet about a user who cancels', () => {
    for (const code of [ERROR_CODES.USER_REJECTED, ERROR_CODES.INTENT_CANCELLED]) {
      expect(classifyMintFailure(coded(code), on('2.3'))).toEqual({
        effect: 'none',
        notice: { tone: 'info', title: 'Mint cancelled in your wallet' },
      });
    }
  });

  it('says the mint may still complete when the error names a token, whatever the code', () => {
    const failure = classifyMintFailure(
      coded(ERROR_CODES.INTERNAL_ERROR, 'Certification pending', { tokenId: TOKEN.toUpperCase() }),
      on('2.3'),
    );
    expect(failure.effect).toBe('none');
    expect(failure.notice).toMatchObject({
      tone: 'warning',
      title: 'The mint may still complete',
      tokenId: TOKEN,
      reason: 'Certification pending',
    });
  });

  it('ignores a malformed token id in error data', () => {
    const failure = classifyMintFailure(coded(ERROR_CODES.INTERNAL_ERROR, 'nope', { tokenId: 'xyz' }), on('2.3'));
    expect(failure.notice.tokenId).toBeUndefined();
    expect(failure.notice.title).toBe('Mint failed');
  });

  it('never calls an unknown outcome a failure', () => {
    expect(classifyMintFailure(coded(ERROR_CODES.INTENT_OUTCOME_UNKNOWN), on('2.3')).notice.title).toBe(
      'The mint may still complete',
    );
  });

  it('marks the wallet locked on WALLET_LOCKED', () => {
    expect(classifyMintFailure(coded(ERROR_CODES.WALLET_LOCKED), on('2.3')).effect).toBe('locked');
  });

  it('reads PERMISSION_DENIED from a pre-2.3 wallet as "minting not supported"', () => {
    expect(classifyMintFailure(coded(ERROR_CODES.PERMISSION_DENIED), on('2.2')).notice).toBe(UNSUPPORTED_WALLET_NOTICE);
    expect(classifyMintFailure(coded(ERROR_CODES.PERMISSION_DENIED), on(null)).notice).toBe(UNSUPPORTED_WALLET_NOTICE);
  });

  it('reads PERMISSION_DENIED from a 2.3 wallet as "scope not granted"', () => {
    expect(classifyMintFailure(coded(ERROR_CODES.PERMISSION_DENIED), on('2.3', ['identity:read'])).notice).toBe(
      NOT_GRANTED_NOTICE,
    );
  });

  it('passes the wallet reason through for invalid params', () => {
    const failure = classifyMintFailure(coded(ERROR_CODES.INVALID_PARAMS, 'content.image.bytes: not base64'), on('2.3'));
    expect(failure.notice.reason).toBe('content.image.bytes: not base64');
  });

  it('drops to disconnected when the connection is gone', () => {
    expect(classifyMintFailure(coded(ERROR_CODES.NOT_CONNECTED, 'Not connected'), on('2.3')).effect).toBe('disconnected');
    expect(classifyMintFailure(coded(ERROR_CODES.SESSION_EXPIRED), on('2.3')).effect).toBe('disconnected');
    expect(classifyMintFailure(new Error('Extension context invalidated.'), on('2.3')).effect).toBe('disconnected');
  });

  it('does not treat a coded refusal as a dead connection because of its wording', () => {
    expect(classifyMintFailure(coded(ERROR_CODES.INTERNAL_ERROR, 'wallet disconnected the signer'), on('2.3')).effect).toBe(
      'none',
    );
  });
});
