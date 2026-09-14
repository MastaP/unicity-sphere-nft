import { CircleCheck, LoaderCircle, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { NOT_GRANTED_NOTICE, UNSUPPORTED_WALLET_NOTICE, type MintSupport, type Notice } from '../connect/errors';
import { MintError } from '../connect/useSphereConnect';
import { exportMeme, formatBytes } from '../meme/export';
import type { LoadedImage } from '../meme/image';
import type { MemeSettings } from '../meme/render';
import { buildMemeNftContent, DESCRIPTION_MAX_LENGTH, suggestTitle, TITLE_MAX_LENGTH } from '../nft/memeContent';
import { CopyButton } from './CopyButton';
import { NoticeBanner } from './NoticeBanner';
import { fieldLabel, panel, primaryButton, textInput } from './ui';

interface ExportSummary {
  bytes: number;
  mediaType: string;
  width: number;
  height: number;
}

type Phase =
  | { kind: 'idle'; notice: Notice | null }
  | { kind: 'preparing' }
  | { kind: 'confirming'; exported: ExportSummary }
  | { kind: 'success'; tokenId: string; exported: ExportSummary };

interface MintPanelProps {
  image: LoadedImage | null;
  settings: MemeSettings;
  connected: boolean;
  locked: boolean;
  mintSupport: MintSupport | null;
  mintNft: (content: ReturnType<typeof buildMemeNftContent>) => Promise<string>;
  onBusyChange: (busy: boolean) => void;
  onMakeAnother: () => void;
}

const LOCKED_NOTICE: Notice = { tone: 'info', title: 'Your wallet is locked', detail: 'Unlock Sphere to mint.' };

function describeExport({ bytes, mediaType, width, height }: ExportSummary): string {
  return `${mediaType === 'image/webp' ? 'WebP' : 'JPEG'} · ${width}×${height} · ${formatBytes(bytes)}`;
}

export function MintPanel(props: MintPanelProps) {
  const { image, settings, connected, locked, mintSupport, mintNft, onBusyChange, onMakeAnother } = props;
  const [phase, setPhase] = useState<Phase>({ kind: 'idle', notice: null });
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  // The title follows the captions until the user types their own.
  const title = editedTitle ?? suggestTitle(settings.top.text, settings.bottom.text);
  const busy = phase.kind === 'preparing' || phase.kind === 'confirming';

  const blocker: Notice | null = !connected
    ? null
    : locked
      ? LOCKED_NOTICE
      : mintSupport === 'unsupported'
        ? UNSUPPORTED_WALLET_NOTICE
        : mintSupport === 'not-granted'
          ? NOT_GRANTED_NOTICE
          : null;
  const hint = !connected ? 'Connect your wallet to mint.' : !image ? 'Add an image to mint.' : !title.trim() ? 'Give your meme a title.' : null;
  const canMint = connected && !!image && !!title.trim() && !blocker && !busy;

  const mint = async (event: FormEvent) => {
    event.preventDefault();
    if (!canMint || !image) return;
    onBusyChange(true);
    setPhase({ kind: 'preparing' });
    try {
      let summary: ExportSummary;
      let content: ReturnType<typeof buildMemeNftContent>;
      try {
        const exported = await exportMeme(image, settings);
        summary = { bytes: exported.bytes.length, mediaType: exported.mediaType, width: exported.width, height: exported.height };
        content = buildMemeNftContent({
          title,
          description,
          topText: settings.top.text,
          bottomText: settings.bottom.text,
          image: { mediaType: exported.mediaType, bytes: exported.bytes },
        });
      } catch (err) {
        setPhase({
          kind: 'idle',
          notice: { tone: 'error', title: "Couldn't prepare the image", reason: err instanceof Error ? err.message : undefined },
        });
        return;
      }

      setPhase({ kind: 'confirming', exported: summary });
      try {
        const tokenId = await mintNft(content);
        setPhase({ kind: 'success', tokenId, exported: summary });
      } catch (err) {
        const notice: Notice =
          err instanceof MintError
            ? err.failure.notice
            : { tone: 'error', title: 'Mint failed', reason: err instanceof Error ? err.message : undefined };
        setPhase({ kind: 'idle', notice });
      }
    } finally {
      onBusyChange(false);
    }
  };

  const makeAnother = () => {
    setPhase({ kind: 'idle', notice: null });
    setEditedTitle(null);
    setDescription('');
    onMakeAnother();
  };

  if (phase.kind === 'success') {
    return (
      <section aria-labelledby="mint-heading" className={panel}>
        <div role="status" className="space-y-3">
          <h2 id="mint-heading" className="flex items-center gap-2 text-lg font-semibold text-neutral-50">
            <CircleCheck aria-hidden className="h-6 w-6 text-green-400" />
            Minted!
          </h2>
          <p className="text-sm text-neutral-300">
            Your meme is now an NFT in your wallet. Find it in your wallet&apos;s Tokens tab.
          </p>
          <div>
            <p className={fieldLabel}>Token id</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 break-all rounded-lg bg-neutral-950 px-2 py-1 font-mono text-xs text-neutral-200">
                {phase.tokenId}
              </code>
              <CopyButton value={phase.tokenId} label="token id" />
            </div>
          </div>
          <p className="text-xs text-neutral-500">Image: {describeExport(phase.exported)}</p>
          <button type="button" className={primaryButton} onClick={makeAnother}>
            <Sparkles aria-hidden className="h-4 w-4" />
            Make another
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="mint-heading" className={panel}>
      <h2 id="mint-heading" className="text-lg font-semibold text-neutral-50">
        Mint as NFT
      </h2>
      <form className="mt-3 space-y-3" onSubmit={mint} noValidate>
        <fieldset disabled={busy} className="min-w-0 space-y-3">
          <div>
            <label htmlFor="nft-title" className={fieldLabel}>
              Title <span className="normal-case text-neutral-500">(required)</span>
            </label>
            <input
              id="nft-title"
              type="text"
              required
              className={textInput}
              value={title}
              maxLength={TITLE_MAX_LENGTH}
              placeholder="Name your meme"
              onChange={(event) => setEditedTitle(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="nft-description" className={fieldLabel}>
              Description <span className="normal-case text-neutral-500">(optional)</span>
            </label>
            <textarea
              id="nft-description"
              rows={3}
              className={`${textInput} resize-y`}
              value={description}
              maxLength={DESCRIPTION_MAX_LENGTH}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </fieldset>

        {blocker && <NoticeBanner notice={blocker} />}
        {phase.kind === 'idle' && phase.notice && (
          <NoticeBanner notice={phase.notice} onDismiss={() => setPhase({ kind: 'idle', notice: null })} />
        )}

        {phase.kind === 'preparing' && (
          <p role="status" className="flex items-center gap-2 text-sm text-neutral-300">
            <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
            Preparing image…
          </p>
        )}
        {phase.kind === 'confirming' && (
          <div role="status" className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-neutral-100">
              <LoaderCircle aria-hidden className="h-4 w-4 animate-spin text-orange-400" />
              Confirm in your wallet
            </p>
            <p className="mt-1 text-neutral-300">Review the meme in Sphere and approve the mint.</p>
            <p className="mt-1 text-xs text-neutral-400">Image: {describeExport(phase.exported)}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButton} disabled={!canMint}>
            <Sparkles aria-hidden className="h-4 w-4" />
            Mint NFT
          </button>
          {!busy && hint && <p className="text-sm text-neutral-400">{hint}</p>}
        </div>
        {phase.kind === 'idle' && !phase.notice && connected && !blocker && image && (
          <p className="text-xs text-neutral-500">
            Your wallet asks you to confirm, signs the NFT as its creator and keeps it. The image is compressed to at
            most 900 KB.
          </p>
        )}
      </form>
    </section>
  );
}
