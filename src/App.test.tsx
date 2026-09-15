import { ERROR_CODES, HOST_READY_TYPE } from '@unicitylabs/sphere-sdk/connect';
import type { AutoConnectConfig } from '@unicitylabs/sphere-sdk/connect/browser';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { WireNftMetadata } from './connect/mintNft';
import { base64ToBytes } from './nft/base64';

const sdk = vi.hoisted(() => ({
  autoConnect: vi.fn<(config: AutoConnectConfig) => Promise<unknown>>(),
  detectTransport: vi.fn<() => 'iframe' | 'extension' | 'popup'>(),
  isInIframe: vi.fn<() => boolean>(),
}));
vi.mock('@unicitylabs/sphere-sdk/connect/browser', () => sdk);

const TOKEN = 'c0ffee'.repeat(10) + 'beef';
const ALICE = { chainPubkey: `02${'ab'.repeat(32)}`, nametag: 'alice', directAddress: `DIRECT://0000${'cd'.repeat(30)}` };
const EXPORTED_BYTES = 2048;

type Handler = (data: unknown) => void;

function fakeWallet(options: { transport?: 'iframe' | 'extension' | 'popup'; walletProtocol?: string; permissions?: string[] } = {}) {
  const handlers = new Map<string, Set<Handler>>();
  const client = {
    walletProtocol: options.walletProtocol ?? '2.3',
    isConnected: true,
    on: vi.fn((event: string, handler: Handler) => {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(event, set);
      return () => set.delete(handler);
    }),
    intent: vi.fn<(action: string, params: Record<string, unknown>) => Promise<unknown>>(),
  };
  const result = {
    client,
    transport: options.transport ?? 'popup',
    connection: { sessionId: 'session-1', permissions: options.permissions ?? ['identity:read', 'nft:mint'], identity: ALICE },
    disconnect: vi.fn(async () => {}),
  };
  const emit = async (event: string, data: unknown = {}) => {
    await act(async () => handlers.get(event)?.forEach((handler) => handler(data)));
  };
  return { result, client, emit };
}

const coded = (code: number, message = 'refused', data?: unknown) => Object.assign(new Error(message), { code, data });

async function addImage(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText('Choose image'), new File([new Uint8Array([1, 2, 3])], 'cat.png', { type: 'image/png' }));
  await screen.findByRole('img', { name: /meme preview/i });
}

beforeEach(() => {
  sdk.autoConnect.mockReset();
  sdk.detectTransport.mockReturnValue('popup');
  sdk.isInIframe.mockReturnValue(false);
  // The popup wallet choice is remembered in this browser; every test starts without one.
  localStorage.clear();

  // jsdom has no canvas: a context that measures 10 px per character and draws nothing.
  const context = new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, prop) =>
      prop === 'measureText' ? (text: string) => ({ width: text.length * 10 }) : prop in target ? target[prop] : () => undefined,
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => context) as unknown as HTMLCanvasElement['getContext']);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback: BlobCallback, type?: string) {
    callback(new Blob([new Uint8Array(EXPORTED_BYTES)], { type: type ?? 'image/png' }));
  });
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close() {} })));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Sphere Memes', () => {
  it('goes from not connected to connected, minting and success', async () => {
    const user = userEvent.setup();
    const { result, client } = fakeWallet();
    sdk.autoConnect.mockResolvedValue(result);
    let finishMint: (value: unknown) => void = () => {};
    client.intent.mockImplementation(() => new Promise((resolve) => (finishMint = resolve)));

    render(<App />);
    // Standalone without the extension: no silent attempt, which would have to open a window.
    expect(sdk.autoConnect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^connect wallet$/i }));
    expect(sdk.autoConnect).toHaveBeenCalledTimes(1);
    const config = sdk.autoConnect.mock.calls[0][0];
    expect(config.permissions).toEqual(['identity:read', 'nft:mint']);
    expect(config).toMatchObject({
      silent: false,
      network: { id: 4, name: 'testnet2' },
      walletUrl: 'https://sphere.unicity.network',
      dapp: { name: 'Sphere Memes' },
    });

    expect(await screen.findByText('@alice')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^connect wallet$/i })).not.toBeInTheDocument();

    await addImage(user);
    await user.type(screen.getByLabelText('Top text'), 'One does not simply');
    await user.type(screen.getByLabelText('Bottom text'), 'mint a meme');
    expect(screen.getByLabelText(/^title/i)).toHaveValue('One does not simply / mint a meme');

    await user.click(screen.getByRole('button', { name: /mint nft/i }));
    expect(await screen.findByText('Confirm in your wallet')).toBeInTheDocument();
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();

    expect(client.intent).toHaveBeenCalledTimes(1);
    const [action, params] = client.intent.mock.calls[0];
    const { content, sign } = params as { content: WireNftMetadata; sign: boolean };
    expect(action).toBe('mint_nft');
    expect(sign).toBe(true);
    expect(content).toMatchObject({
      kind: 'metadata',
      name: 'One does not simply / mint a meme',
      description: null,
      animation_url: null,
      external_url: 'https://mastap.github.io/unicity-sphere-nft/',
      collection: 'Sphere Memes',
      attributes: [
        { trait_type: 'Top text', value: 'One does not simply' },
        { trait_type: 'Bottom text', value: 'mint a meme' },
      ],
      image: { kind: 'media', media_type: 'image/webp' },
    });
    if (content.image?.kind !== 'media') throw new Error('expected inline media');
    expect(base64ToBytes(content.image.bytes)).toHaveLength(EXPORTED_BYTES);

    await act(async () => finishMint({ tokenId: TOKEN }));
    expect(await screen.findByText('Minted!')).toBeInTheDocument();
    expect(screen.getByText(TOKEN)).toBeInTheDocument();
    expect(screen.getByText(/Tokens tab/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /make another/i }));
    expect(screen.getByText(/add an image to start/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Top text')).toHaveValue('');
  });

  it('reconnects silently where a persistent host exists, and follows lock, unlock and disconnect', async () => {
    sdk.detectTransport.mockReturnValue('extension');
    const { result, emit } = fakeWallet({ transport: 'extension' });
    sdk.autoConnect.mockResolvedValue(result);

    render(<App />);
    expect(await screen.findByText('@alice')).toBeInTheDocument();
    expect(sdk.autoConnect).toHaveBeenCalledWith(
      expect.objectContaining({ silent: true, permissions: ['identity:read', 'nft:mint'] }),
    );

    await emit('wallet:locked');
    expect(screen.getByLabelText('Wallet locked')).toBeInTheDocument();
    expect(screen.getByText('Your wallet is locked')).toBeInTheDocument();

    await emit('identity:changed', { chainPubkey: `03${'ef'.repeat(32)}`, nametag: 'bob' });
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(screen.queryByLabelText('Wallet locked')).not.toBeInTheDocument();

    await emit('wallet:disconnected');
    expect(screen.getByRole('button', { name: /^connect wallet$/i })).toBeEnabled();
    expect(screen.getByText('Your wallet ended the connection')).toBeInTheDocument();
  });

  it('stays quiet when the silent check finds no approval', async () => {
    sdk.detectTransport.mockReturnValue('extension');
    sdk.autoConnect.mockRejectedValue(new Error('Connection rejected by wallet'));

    render(<App />);
    expect(await screen.findByRole('button', { name: /^connect wallet$/i })).toBeEnabled();
    expect(screen.queryByText('Not connected')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disconnects a popup session when the wallet locks, leaving the wallet window alone', async () => {
    const user = userEvent.setup();
    const { result, emit } = fakeWallet({ transport: 'popup' });
    sdk.autoConnect.mockResolvedValue(result);

    render(<App />);
    await user.click(screen.getByRole('button', { name: /^connect wallet$/i }));
    await screen.findByText('@alice');

    await emit('wallet:locked');
    expect(screen.getByRole('button', { name: /^connect wallet$/i })).toBeEnabled();
    expect(screen.getByText('Your wallet locked')).toBeInTheDocument();
    expect(result.disconnect).not.toHaveBeenCalled();
  });

  it('inside Sphere, retries the silent check when the wallet announces it is ready', async () => {
    sdk.detectTransport.mockReturnValue('iframe');
    sdk.isInIframe.mockReturnValue(true);
    let failFirst: (err: Error) => void = () => {};
    const { result } = fakeWallet({ transport: 'iframe' });
    sdk.autoConnect
      .mockImplementationOnce(() => new Promise((_, reject) => (failFirst = reject)))
      .mockResolvedValueOnce(result);

    render(<App />);
    expect(sdk.autoConnect).toHaveBeenCalledTimes(1);

    // The wallet finishes loading while the first attempt is still waiting.
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: HOST_READY_TYPE }, source: window }));
    });
    expect(sdk.autoConnect).toHaveBeenCalledTimes(1);

    await act(async () => failFirst(new Error('Connection timeout')));
    expect(await screen.findByText('@alice')).toBeInTheDocument();
    expect(sdk.autoConnect).toHaveBeenCalledTimes(2);
    expect(sdk.autoConnect.mock.calls[1][0]).toMatchObject({ silent: true });
  });

  it("tells a Connect 2.2 wallet user that the wallet can't mint NFTs yet", async () => {
    const user = userEvent.setup();
    const { result, client } = fakeWallet({ walletProtocol: '2.2' });
    sdk.autoConnect.mockResolvedValue(result);

    render(<App />);
    await user.click(screen.getByRole('button', { name: /^connect wallet$/i }));
    await screen.findByText('@alice');
    await addImage(user);
    await user.type(screen.getByLabelText('Top text'), 'hello');

    expect(screen.getByText("This wallet doesn't support minting NFTs yet")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mint nft/i })).toBeDisabled();
    expect(client.intent).not.toHaveBeenCalled();
  });

  it('explains a network mismatch on connect', async () => {
    const user = userEvent.setup();
    sdk.autoConnect.mockRejectedValue(coded(ERROR_CODES.INCOMPATIBLE_NETWORK, 'dApp targets a different network'));

    render(<App />);
    await user.click(screen.getByRole('button', { name: /^connect wallet$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/switch your wallet to testnet/i);
  });

  describe('mint failures', () => {
    async function mintWith(error: unknown) {
      const user = userEvent.setup();
      const wallet = fakeWallet();
      wallet.client.intent.mockRejectedValue(error);
      sdk.autoConnect.mockResolvedValue(wallet.result);
      render(<App />);
      await user.click(screen.getByRole('button', { name: /^connect wallet$/i }));
      await screen.findByText('@alice');
      await addImage(user);
      await user.type(screen.getByLabelText(/^title/i), 'A meme');
      await user.click(screen.getByRole('button', { name: /mint nft/i }));
      return wallet;
    }

    it('keeps a user rejection quiet', async () => {
      await mintWith(coded(ERROR_CODES.USER_REJECTED, 'User rejected'));
      expect(await screen.findByText('Mint cancelled in your wallet')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /mint nft/i })).toBeEnabled();
    });

    it('says the mint may still complete when the error names a token', async () => {
      await mintWith(coded(ERROR_CODES.INTERNAL_ERROR, 'Certification pending', { tokenId: TOKEN }));
      expect(await screen.findByText('The mint may still complete')).toBeInTheDocument();
      expect(screen.getByText(TOKEN)).toBeInTheDocument();
    });

    it('lands in the disconnected state when the connection is gone', async () => {
      await mintWith(coded(ERROR_CODES.NOT_CONNECTED, 'Not connected'));
      expect(await screen.findByRole('button', { name: /^connect wallet$/i })).toBeEnabled();
      expect(screen.getAllByText('Lost the connection to your wallet').length).toBeGreaterThan(0);
    });
  });
});

describe('Sphere Memes — which wallet a popup opens', () => {
  it('opens production Sphere by default, and staging once Staging is picked — remembered on the next visit', async () => {
    const user = userEvent.setup();
    sdk.autoConnect.mockRejectedValue(new Error('Connection rejected by wallet'));

    const first = render(<App />);
    const choice = screen.getByRole('radiogroup', { name: 'Wallet' });
    expect(within(choice).getByRole('radio', { name: 'Production' })).toHaveAttribute('aria-checked', 'true');
    expect(within(choice).getByRole('radio', { name: 'Staging' })).toHaveAttribute('aria-checked', 'false');

    await user.click(within(choice).getByRole('radio', { name: 'Staging' }));
    await user.click(screen.getByRole('button', { name: /^connect wallet$/i }));
    expect(sdk.autoConnect).toHaveBeenCalledTimes(1);
    expect(sdk.autoConnect.mock.calls[0][0]).toMatchObject({ walletUrl: 'https://sphere.staging.unicity.network' });

    first.unmount();
    render(<App />);
    expect(screen.getByRole('radio', { name: 'Staging' })).toHaveAttribute('aria-checked', 'true');
  });

  it('marks a staging connection in the header, and a production one not at all', async () => {
    const user = userEvent.setup();
    const { result } = fakeWallet();
    sdk.autoConnect.mockResolvedValue(result);

    const production = render(<App />);
    await user.click(screen.getByRole('button', { name: /^connect wallet$/i }));
    await screen.findByText('@alice');
    expect(screen.queryByText('Staging')).not.toBeInTheDocument();
    production.unmount();

    render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Staging' }));
    await user.click(screen.getByRole('button', { name: /^connect wallet$/i }));
    await screen.findByText('@alice');
    expect(screen.getByText('Staging')).toBeInTheDocument();
  });

  it.each(['iframe', 'extension'] as const)('offers no wallet choice when the connection goes through the %s', async (transport) => {
    sdk.detectTransport.mockReturnValue(transport);
    sdk.isInIframe.mockReturnValue(transport === 'iframe');
    sdk.autoConnect.mockRejectedValue(new Error('Connection rejected by wallet'));

    render(<App />);

    expect(await screen.findByRole('button', { name: /^connect wallet$/i })).toBeEnabled();
    expect(screen.queryByRole('radiogroup', { name: 'Wallet' })).not.toBeInTheDocument();
  });
});
