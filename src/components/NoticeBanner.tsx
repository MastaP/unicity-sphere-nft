import { CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import type { Notice } from '../connect/errors';
import { CopyButton } from './CopyButton';
import { focusRing } from './ui';

const TONES = {
  error: { box: 'border-red-500/40 bg-red-500/10', icon: CircleAlert, iconClass: 'text-red-400' },
  warning: { box: 'border-amber-500/40 bg-amber-500/10', icon: TriangleAlert, iconClass: 'text-amber-400' },
  info: { box: 'border-neutral-700 bg-neutral-800/60', icon: Info, iconClass: 'text-neutral-400' },
} as const;

interface NoticeBannerProps {
  notice: Notice;
  onDismiss?: () => void;
}

export function NoticeBanner({ notice, onDismiss }: NoticeBannerProps) {
  const tone = TONES[notice.tone];
  const Icon = tone.icon;
  return (
    <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl border p-3 ${tone.box}`}>
      <Icon aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 ${tone.iconClass}`} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-neutral-100">{notice.title}</p>
        {notice.detail && <p className="mt-1 text-neutral-300">{notice.detail}</p>}
        {notice.reason && <p className="mt-1 break-words text-xs text-neutral-400">Wallet said: {notice.reason}</p>}
        {notice.tokenId && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded-lg bg-neutral-950 px-2 py-1 font-mono text-xs text-neutral-200">
              {notice.tokenId}
            </code>
            <CopyButton value={notice.tokenId} label="token id" />
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={`h-7 w-7 shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 ${focusRing}`}
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
