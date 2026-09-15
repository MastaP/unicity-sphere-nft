import { LoaderCircle, Wallet } from 'lucide-react';
import type { Notice } from '../connect/errors';
import type { ConnectionStatus } from '../connect/useSphereConnect';
import { WALLETS, type WalletId } from '../connect/walletChoice';
import { NoticeBanner } from './NoticeBanner';
import { focusRing, panel, primaryButton } from './ui';

interface ConnectCardProps {
  status: ConnectionStatus;
  notice: Notice | null;
  /** The wallet Connect opens; null hides the choice — inside Sphere or with the extension, the wallet is given. */
  walletChoice: WalletId | null;
  onWalletChoice: (id: WalletId) => void;
  onConnect: () => void;
  onDismissNotice: () => void;
}

export function ConnectCard({ status, notice, walletChoice, onWalletChoice, onConnect, onDismissNotice }: ConnectCardProps) {
  const busy = status === 'checking' || status === 'connecting';
  const label = status === 'checking' ? 'Looking for your wallet…' : status === 'connecting' ? 'Connecting…' : 'Connect wallet';

  return (
    <section aria-labelledby="connect-heading" className={panel}>
      <h2 id="connect-heading" className="text-lg font-semibold text-neutral-50">
        Make a meme. Mint it as an NFT.
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        Add an image and captions below, then connect your Sphere wallet to mint the meme into it. Sphere Memes asks
        only to see who you are and to request mints, which your wallet confirms every time. Runs on testnet.
      </p>
      {/* One row: Connect on the left, the wallet it opens on the right. The choice keeps to the
          right when a narrow screen wraps it onto its own line. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={primaryButton} onClick={onConnect} disabled={busy}>
          {busy ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : <Wallet aria-hidden className="h-4 w-4" />}
          {label}
        </button>
        {walletChoice !== null && (
          <div className="ml-auto flex items-center gap-2">
            <span id="wallet-choice-label" className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Wallet
            </span>
            <div
              role="radiogroup"
              aria-labelledby="wallet-choice-label"
              className="inline-flex rounded-xl border border-neutral-700 bg-neutral-950 p-1"
            >
              {WALLETS.map((wallet) => {
                const selected = wallet.id === walletChoice;
                return (
                  <button
                    key={wallet.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={wallet.url}
                    disabled={busy}
                    onClick={() => onWalletChoice(wallet.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
                      selected ? 'bg-neutral-800 text-neutral-50' : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {wallet.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {notice && (
        <div className="mt-4">
          <NoticeBanner notice={notice} onDismiss={onDismissNotice} />
        </div>
      )}
    </section>
  );
}
