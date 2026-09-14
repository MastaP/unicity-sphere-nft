import { useCallback, useState } from 'react';
import { ConnectCard } from './components/ConnectCard';
import { Header } from './components/Header';
import { MemeEditor } from './components/MemeEditor';
import { MintPanel } from './components/MintPanel';
import { useSphereConnect } from './connect/useSphereConnect';
import { DEFAULT_SETTINGS, type MemeSettings } from './meme/render';
import { useOwnedImage } from './meme/useOwnedImage';

export function App() {
  const wallet = useSphereConnect();
  const { image, setImage, clearImage } = useOwnedImage();
  const [settings, setSettings] = useState<MemeSettings>(DEFAULT_SETTINGS);
  const [mintBusy, setMintBusy] = useState(false);
  const connected = wallet.status === 'connected';

  const makeAnother = useCallback(() => {
    clearImage();
    setSettings(DEFAULT_SETTINGS);
  }, [clearImage]);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-10 sm:px-6">
      <Header
        status={wallet.status}
        identity={wallet.identity}
        locked={wallet.locked}
        onDisconnect={() => void wallet.disconnect()}
      />
      <main className="space-y-4">
        {!connected && (
          <ConnectCard
            status={wallet.status}
            notice={wallet.notice}
            onConnect={wallet.connect}
            onDismissNotice={wallet.dismissNotice}
          />
        )}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <MemeEditor
            image={image}
            onImage={setImage}
            settings={settings}
            onSettingsChange={setSettings}
            disabled={mintBusy}
          />
          <MintPanel
            image={image}
            settings={settings}
            connected={connected}
            locked={wallet.locked}
            mintSupport={wallet.mintSupport}
            mintNft={wallet.mintNft}
            onBusyChange={setMintBusy}
            onMakeAnother={makeAnother}
          />
        </div>
      </main>
      <footer className="mt-8 text-center text-xs text-neutral-500">
        Sphere Memes runs entirely in your browser. Your meme goes only to your wallet, which mints it.
      </footer>
    </div>
  );
}
