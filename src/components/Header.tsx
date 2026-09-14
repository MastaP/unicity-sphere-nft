import type { PublicIdentity } from '@unicitylabs/sphere-sdk/connect';
import { Lock, LogOut } from 'lucide-react';
import iconUrl from '../assets/sphere-memes.svg';
import { displayIdentity } from '../connect/identity';
import type { ConnectionStatus } from '../connect/useSphereConnect';
import { focusRing } from './ui';

interface HeaderProps {
  status: ConnectionStatus;
  identity: PublicIdentity | null;
  locked: boolean;
  onDisconnect: () => void;
}

export function Header({ status, identity, locked, onDisconnect }: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <img src={iconUrl} alt="" className="h-9 w-9 shrink-0" />
        <h1 className="font-meme truncate text-2xl tracking-wide text-neutral-50">Sphere Memes</h1>
      </div>

      {status === 'connected' && (
        <div className="flex min-w-0 items-center gap-1.5">
          <p
            className="flex min-w-0 items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
            title={identity?.directAddress ?? identity?.chainPubkey}
          >
            {locked && <Lock aria-label="Wallet locked" className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
            <span className="sr-only">Connected as </span>
            <span className="truncate">{displayIdentity(identity)}</span>
          </p>
          <button
            type="button"
            onClick={onDisconnect}
            aria-label="Disconnect wallet"
            title="Disconnect"
            className={`shrink-0 rounded-full p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 ${focusRing}`}
          >
            <LogOut aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}
