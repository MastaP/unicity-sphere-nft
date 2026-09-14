/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Wallet opened in popup mode. Empty or unset = production Sphere. */
  readonly VITE_WALLET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
