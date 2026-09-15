import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WALLET,
  loadWalletChoice,
  saveWalletChoice,
  WALLET_STORAGE_KEY,
  walletById,
  WALLETS,
} from './walletChoice';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('popup wallets', () => {
  it('are production and staging, production first and the default', () => {
    expect(WALLETS.map((wallet) => [wallet.id, wallet.url])).toEqual([
      ['production', 'https://sphere.unicity.network'],
      ['staging', 'https://sphere.staging.unicity.network'],
    ]);
    expect(DEFAULT_WALLET).toBe('production');
    expect(walletById('staging').label).toBe('Staging');
  });

  it('carry no trailing slash — autoConnect appends /connect', () => {
    for (const wallet of WALLETS) expect(wallet.url.endsWith('/')).toBe(false);
  });
});

describe('the remembered wallet choice', () => {
  it('is production when nothing is stored, or when storage is unavailable', () => {
    expect(loadWalletChoice(memoryStorage())).toBe('production');
    expect(loadWalletChoice(null)).toBe('production');
    expect(
      loadWalletChoice({
        getItem: () => {
          throw new Error('SecurityError');
        },
      }),
    ).toBe('production');
  });

  it('ignores a stored value that names no wallet', () => {
    expect(loadWalletChoice(memoryStorage({ [WALLET_STORAGE_KEY]: 'https://wallet.example' }))).toBe('production');
  });

  it('comes back as saved', () => {
    const storage = memoryStorage();
    saveWalletChoice('staging', storage);

    expect(storage.data.get(WALLET_STORAGE_KEY)).toBe('staging');
    expect(loadWalletChoice(storage)).toBe('staging');
  });

  it('is forgotten quietly when storage refuses to save it', () => {
    expect(() =>
      saveWalletChoice('staging', {
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      }),
    ).not.toThrow();
  });
});
