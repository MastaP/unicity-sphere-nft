import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WALLET_URL,
  dappMetadata,
  NETWORK,
  requestedScopes,
  resolveWalletUrl,
  SPHERE_PERMISSIONS,
} from './config';

describe('Connect permissions', () => {
  it('are exactly identity:read and nft:mint', () => {
    expect(SPHERE_PERMISSIONS).toEqual(['identity:read', 'nft:mint']);
    expect(requestedScopes()).toEqual(['identity:read', 'nft:mint']);
  });

  it('hand each connect attempt its own array', () => {
    const first = requestedScopes();
    first.push('balance:read');
    expect(requestedScopes()).toEqual(['identity:read', 'nft:mint']);
  });
});

describe('resolveWalletUrl', () => {
  it('defaults to production Sphere', () => {
    expect(resolveWalletUrl(undefined)).toBe(DEFAULT_WALLET_URL);
    expect(resolveWalletUrl('')).toBe('https://sphere.unicity.network');
    expect(resolveWalletUrl('   ')).toBe(DEFAULT_WALLET_URL);
  });

  it('accepts a staging preview URL and drops trailing slashes', () => {
    expect(resolveWalletUrl('https://unicity-sphere.github.io/sphere/feat-x/')).toBe(
      'https://unicity-sphere.github.io/sphere/feat-x',
    );
  });
});

describe('dappMetadata', () => {
  it('names the app, points at its deployed base path and ships a bundled icon', () => {
    const meta = dappMetadata();
    expect(meta.name).toBe('Sphere Memes');
    expect(meta.description).toBeTruthy();
    // Vitest serves from '/'; the Pages base path is checked against the production build.
    expect(meta.url).toBe(`${location.origin}${import.meta.env.BASE_URL}`);
    expect(meta.icon && new URL(meta.icon).origin).toBe(location.origin);
  });

  it('targets testnet2', () => {
    expect(NETWORK).toMatchObject({ name: 'testnet2', id: 4 });
  });
});
