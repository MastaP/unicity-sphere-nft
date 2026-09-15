import { useCallback, useState } from 'react';

/**
 * The Sphere wallets the Connect button can open in a popup, production first. Inside
 * Sphere, or with the Sphere extension, the wallet is already given and none of this
 * applies. No trailing slash on a URL: autoConnect appends `/connect`.
 */
export const WALLETS = [
  { id: 'production', label: 'Production', url: 'https://sphere.unicity.network' },
  { id: 'staging', label: 'Staging', url: 'https://sphere.staging.unicity.network' },
] as const;

export type WalletId = (typeof WALLETS)[number]['id'];

export const DEFAULT_WALLET: WalletId = 'production';

export const WALLET_STORAGE_KEY = 'sphere-memes:wallet';

export function walletById(id: WalletId): (typeof WALLETS)[number] {
  return WALLETS.find((wallet) => wallet.id === id) ?? WALLETS[0];
}

function isWalletId(value: unknown): value is WalletId {
  return WALLETS.some((wallet) => wallet.id === value);
}

/** This browser's storage, or null where it is blocked (a private window, a sandboxed frame). */
function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The wallet this browser picked last: the default when it picked none, or storage is unavailable. */
export function loadWalletChoice(storage: Pick<Storage, 'getItem'> | null = browserStorage()): WalletId {
  try {
    const stored = storage?.getItem(WALLET_STORAGE_KEY);
    return isWalletId(stored) ? stored : DEFAULT_WALLET;
  } catch {
    return DEFAULT_WALLET;
  }
}

/** Remembers the choice for the next visit. A browser that refuses storage keeps it for this visit only. */
export function saveWalletChoice(id: WalletId, storage: Pick<Storage, 'setItem'> | null = browserStorage()): void {
  try {
    storage?.setItem(WALLET_STORAGE_KEY, id);
  } catch {
    // Storage refused: nothing to remember it in.
  }
}

/** The popup wallet choice, remembered in this browser. */
export function useWalletChoice(): [WalletId, (id: WalletId) => void] {
  const [choice, setChoice] = useState<WalletId>(() => loadWalletChoice());
  const choose = useCallback((id: WalletId) => {
    setChoice(id);
    saveWalletChoice(id);
  }, []);
  return [choice, choose];
}
