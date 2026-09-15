import { describe, expect, it } from 'vitest';
import { dappMetadata, NETWORK, requestedScopes, SPHERE_PERMISSIONS } from './config';

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
