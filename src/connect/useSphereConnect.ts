import { HOST_READY_TYPE, WALLET_EVENTS } from '@unicitylabs/sphere-sdk/connect';
import type { PublicIdentity } from '@unicitylabs/sphere-sdk/connect';
import { autoConnect, detectTransport, isInIframe } from '@unicitylabs/sphere-sdk/connect/browser';
import type { AutoConnectResult, DetectedTransport } from '@unicitylabs/sphere-sdk/connect/browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dappMetadata,
  INTERACTIVE_CONNECT_TIMEOUT_MS,
  MINT_INTENT_TIMEOUT_MS,
  NETWORK,
  requestedScopes,
  SILENT_CONNECT_TIMEOUT_MS,
  WALLET_URL,
} from './config';
import {
  classifyMintFailure,
  describeConnectFailure,
  mintSupport,
  walletKeepsSessionWhenLocked,
  type MintFailure,
  type MintSupport,
  type Notice,
} from './errors';
import { MINT_NFT_INTENT, readTokenId, type WireNftContent } from './mintNft';

export type ConnectionStatus = 'checking' | 'disconnected' | 'connecting' | 'connected';

export interface SphereConnectState {
  status: ConnectionStatus;
  transport: DetectedTransport | null;
  identity: PublicIdentity | null;
  permissions: readonly string[];
  /** Connect protocol version the wallet reported at handshake. */
  walletProtocol: string | null;
  /** The wallet is locked; the session is alive and waits for the unlock. */
  locked: boolean;
  /** Why the app is not connected, when there is something worth saying. */
  notice: Notice | null;
}

export interface SphereConnect extends SphereConnectState {
  /** Whether minting can work on this connection; null while not connected. */
  mintSupport: MintSupport | null;
  connect: () => void;
  disconnect: () => Promise<void>;
  /** Mint `content` into the connected wallet. Resolves the token id; rejects with a MintError. */
  mintNft: (content: WireNftContent) => Promise<string>;
  dismissNotice: () => void;
}

export class MintError extends Error {
  readonly failure: MintFailure;
  constructor(failure: MintFailure) {
    super(failure.notice.title);
    this.name = 'MintError';
    this.failure = failure;
  }
}

const DISCONNECTED: SphereConnectState = {
  status: 'disconnected',
  transport: null,
  identity: null,
  permissions: [],
  walletProtocol: null,
  locked: false,
  notice: null,
};

const LOCKED_POPUP_NOTICE: Notice = {
  tone: 'info',
  title: 'Your wallet locked',
  detail: 'Connect again once Sphere is unlocked.',
};

const ENDED_NOTICE: Notice = {
  tone: 'info',
  title: 'Your wallet ended the connection',
  detail: 'Connect again to keep minting.',
};

function isIdentity(value: unknown): value is PublicIdentity {
  return typeof value === 'object' && value !== null && typeof (value as PublicIdentity).chainPubkey === 'string';
}

export function useSphereConnect(): SphereConnect {
  // In a popup-only environment a silent check would have to open a window on
  // page load, so there is nothing to check: go straight to the Connect button.
  const [state, setState] = useState<SphereConnectState>(() => ({
    ...DISCONNECTED,
    status: detectTransport() === 'popup' ? 'disconnected' : 'checking',
  }));

  const connectionRef = useRef<AutoConnectResult | null>(null);
  /** Bumped whenever a pending attempt's result must be thrown away. */
  const generationRef = useRef(0);
  const inFlightRef = useRef(false);
  /** HOST_READY arrived while an attempt was in flight: retry if that attempt fails. */
  const retryOnReadyRef = useRef(false);

  /**
   * Drop the current connection without the user asking to disconnect.
   *
   * Iframe and extension hosts stay alive, so their transport is released; a
   * sphere_disconnect over a dead link just fails quietly. A wallet popup is
   * left open — the user may still be using it — and its transport is freed
   * by autoConnect when that window closes.
   */
  const release = useCallback(() => {
    const current = connectionRef.current;
    connectionRef.current = null;
    if (current && current.transport !== 'popup') void current.disconnect().catch(() => {});
  }, []);

  const adopt = useCallback(
    (result: AutoConnectResult) => {
      const { client } = result;
      connectionRef.current = result;
      const isCurrent = () => connectionRef.current === result;

      client.on(WALLET_EVENTS.LOCKED, () => {
        if (!isCurrent()) return;
        if (result.transport === 'popup' || !walletKeepsSessionWhenLocked(client.walletProtocol)) {
          release();
          setState({ ...DISCONNECTED, notice: LOCKED_POPUP_NOTICE });
          return;
        }
        setState((s) => ({ ...s, locked: true }));
      });
      client.on(WALLET_EVENTS.UNLOCKED, (data) => {
        if (!isCurrent()) return;
        const identity = (data as { identity?: unknown } | undefined)?.identity;
        setState((s) => ({ ...s, locked: false, identity: isIdentity(identity) ? identity : s.identity }));
      });
      client.on(WALLET_EVENTS.IDENTITY_CHANGED, (data) => {
        if (!isCurrent()) return;
        setState((s) => ({ ...s, locked: false, identity: isIdentity(data) ? data : s.identity }));
      });
      client.on(WALLET_EVENTS.DISCONNECTED, () => {
        if (!isCurrent()) return;
        release();
        setState({ ...DISCONNECTED, notice: ENDED_NOTICE });
      });

      setState({
        status: 'connected',
        transport: result.transport,
        identity: result.connection.identity,
        permissions: result.connection.permissions,
        walletProtocol: client.walletProtocol,
        locked: result.connection.locked === true,
        notice: null,
      });
    },
    [release],
  );

  const attemptRef = useRef<(silent: boolean) => Promise<void>>(async () => {});

  const attempt = useCallback(
    async (silent: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      retryOnReadyRef.current = false;
      const generation = ++generationRef.current;
      // A background (silent) attempt leaves any notice on screen; only the user's own attempt replaces it.
      setState((s) => ({ ...s, status: silent ? 'checking' : 'connecting', notice: silent ? s.notice : null }));
      try {
        // No await before this call: a popup must open inside the click's user activation.
        const result = await autoConnect({
          dapp: dappMetadata(),
          walletUrl: WALLET_URL,
          network: NETWORK,
          permissions: requestedScopes(),
          silent,
          timeout: silent ? SILENT_CONNECT_TIMEOUT_MS : INTERACTIVE_CONNECT_TIMEOUT_MS,
          intentTimeout: MINT_INTENT_TIMEOUT_MS,
        });
        if (generation !== generationRef.current) {
          void result.disconnect().catch(() => {});
          return;
        }
        release();
        adopt(result);
      } catch (err) {
        if (generation !== generationRef.current) return;
        setState((s) => ({ ...DISCONNECTED, notice: silent ? s.notice : describeConnectFailure(err) }));
      } finally {
        inFlightRef.current = false;
        if (!connectionRef.current && retryOnReadyRef.current) {
          retryOnReadyRef.current = false;
          void attemptRef.current(true);
        }
      }
    },
    [adopt, release],
  );

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  // Silent reconnect on load, where a persistent host can answer without UI.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (detectTransport() !== 'popup') void attempt(true);
  }, [attempt]);

  // Inside Sphere, the wallet announces HOST_READY when it can serve a handshake:
  // after it finishes loading, and after an unlock that left it without a session.
  useEffect(() => {
    if (!isInIframe()) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if ((event.data as { type?: unknown } | null)?.type !== HOST_READY_TYPE) return;
      if (connectionRef.current) return;
      if (inFlightRef.current) {
        retryOnReadyRef.current = true;
        return;
      }
      void attempt(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [attempt]);

  const connect = useCallback(() => {
    void attempt(false);
  }, [attempt]);

  const disconnect = useCallback(async () => {
    generationRef.current += 1;
    const current = connectionRef.current;
    connectionRef.current = null;
    setState(DISCONNECTED);
    if (current) await current.disconnect().catch(() => {});
  }, []);

  const mintNft = useCallback(
    async (content: WireNftContent): Promise<string> => {
      const current = connectionRef.current;
      if (!current) {
        throw new MintError(classifyMintFailure(new Error('Not connected'), { walletProtocol: null, permissions: [] }));
      }
      const walletProtocol = current.client.walletProtocol;
      let result: unknown;
      try {
        result = await current.client.intent(MINT_NFT_INTENT, { content, sign: true });
      } catch (err) {
        const failure = classifyMintFailure(err, { walletProtocol, permissions: current.connection.permissions });
        if (connectionRef.current === current) {
          if (failure.effect === 'disconnected' || (failure.effect === 'locked' && current.transport === 'popup')) {
            release();
            setState({ ...DISCONNECTED, notice: failure.notice });
          } else if (failure.effect === 'locked') {
            setState((s) => ({ ...s, locked: true }));
          }
        }
        throw new MintError(failure);
      }

      const tokenId = readTokenId(result);
      if (!tokenId) {
        throw new MintError({
          effect: 'none',
          notice: {
            tone: 'warning',
            title: 'The mint may still complete',
            detail: "The wallet answered without a token id. Check your wallet's Tokens tab before minting again.",
          },
        });
      }
      return tokenId;
    },
    [release],
  );

  const dismissNotice = useCallback(() => setState((s) => ({ ...s, notice: null })), []);

  return {
    ...state,
    mintSupport: state.status === 'connected' ? mintSupport(state.walletProtocol, state.permissions) : null,
    connect,
    disconnect,
    mintNft,
    dismissNotice,
  };
}
