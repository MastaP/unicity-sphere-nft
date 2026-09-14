import { LoaderCircle, Wallet } from 'lucide-react';
import type { Notice } from '../connect/errors';
import type { ConnectionStatus } from '../connect/useSphereConnect';
import { NoticeBanner } from './NoticeBanner';
import { panel, primaryButton } from './ui';

interface ConnectCardProps {
  status: ConnectionStatus;
  notice: Notice | null;
  onConnect: () => void;
  onDismissNotice: () => void;
}

export function ConnectCard({ status, notice, onConnect, onDismissNotice }: ConnectCardProps) {
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
      <button type="button" className={`${primaryButton} mt-4`} onClick={onConnect} disabled={busy}>
        {busy ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : <Wallet aria-hidden className="h-4 w-4" />}
        {label}
      </button>
      {notice && (
        <div className="mt-4">
          <NoticeBanner notice={notice} onDismiss={onDismissNotice} />
        </div>
      )}
    </section>
  );
}
