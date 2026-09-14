import { describe, expect, it } from 'vitest';
import { displayIdentity } from './identity';

const chainPubkey = `02${'ab'.repeat(32)}`;

describe('displayIdentity', () => {
  it('prefers the nametag, with a single @', () => {
    expect(displayIdentity({ chainPubkey, nametag: 'alice' })).toBe('@alice');
    expect(displayIdentity({ chainPubkey, nametag: '@alice' })).toBe('@alice');
  });

  it('falls back to a shortened DIRECT address', () => {
    const directAddress = `DIRECT://0000${'cd'.repeat(30)}1234`;
    expect(displayIdentity({ chainPubkey, directAddress, nametag: ' ' })).toBe('DIRECT://0000cd…1234');
  });

  it('falls back to a shortened chain pubkey, and to nothing without an identity', () => {
    expect(displayIdentity({ chainPubkey })).toBe('02abab…abab');
    expect(displayIdentity(null)).toBe('');
  });
});
