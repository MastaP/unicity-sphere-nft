# Sphere Memes

Make a meme and mint it as an NFT into your Sphere wallet.

Sphere Memes is a static single-page app. It runs inside the Sphere wallet (as an embedded app) or on its own
page, talks to the wallet over [Sphere Connect](https://www.npmjs.com/package/@unicitylabs/sphere-sdk), and has
no backend of any kind: no server, no API keys, no analytics, no CDN. Fonts and assets are bundled.

Live: https://mastap.github.io/unicity-sphere-nft/ (testnet).

## What it does

1. **Pick an image**: choose a file, drag and drop it onto the editor, or paste it (Ctrl+V / ⌘V).
   PNG, JPEG, WebP and GIF (first frame) are accepted.
2. **Caption it**: top and bottom text in Anton, white with a black outline. Uppercase toggle, a size slider,
   and auto-fit (shrinks the text to the image width, wrapping to at most three lines). Drag captions on the
   image to move them (mouse or touch). "Reset positions" puts them back.
3. **Mint it**: give it a title (prefilled from the captions) and an optional description, then confirm the mint
   in your wallet. The wallet mints one NFT to its own active address, signed with its key as the creator.

The exported image keeps the source aspect ratio with the long edge at most 1024 px. It is encoded as WebP (JPEG
where the browser cannot encode WebP), stepping quality from 0.92 down to 0.5 and then shrinking in ×0.85 steps
until the file is at most 900 000 bytes, which keeps the whole NFT under the wallet's 1 MiB payload limit.

## Permissions

Sphere Memes requests exactly two Connect scopes, and always passes them explicitly (a Connect client that omits
`permissions` requests every scope):

| Scope           | Why                                                                         |
| --------------- | --------------------------------------------------------------------------- |
| `identity:read` | Show who is connected (nametag, or a shortened DIRECT address).             |
| `nft:mint`      | Ask the wallet to mint the meme. The wallet shows it and asks every time.   |

It cannot read balances, tokens or history, send anything, or sign messages. The list lives in
`src/connect/config.ts` and a test pins it.

## Wallet compatibility

Minting uses the `mint_nft` intent, added in **Sphere Connect 2.3**. A wallet on an older Connect version still
connects, but Sphere Memes tells the user "This wallet doesn't support minting NFTs yet" instead of attempting the
mint. The app targets **testnet2**; a wallet on another network is asked to switch.

How the app finds the wallet (handled by `autoConnect` from the SDK):

- **Inside Sphere** (iframe): connects to the parent wallet, silently if this app was approved before.
- **Standalone with the Sphere extension**: connects through the extension, silently if approved before.
- **Standalone without the extension**: the Connect button opens the wallet in a popup. There is no silent
  check on page load here, because it would have to open a window.

Only in that last case does the connect card offer a choice of wallet: **Production**
(`https://sphere.unicity.network`, the default) or **Staging** (`https://sphere.staging.unicity.network`). The
choice is remembered in this browser, and a staging connection is marked in the header. Inside Sphere, or
through the extension, the wallet is already given, so the choice is hidden.

## Running locally

Requires Node.js 22.12 or newer.

```bash
npm ci
npm run dev        # http://localhost:5173/unicity-sphere-nft/
```

The popup wallets are listed in `src/connect/walletChoice.ts`; add an entry there to try another wallet build, such
as a GitHub Pages preview of a Sphere branch. The wallet must be on testnet.

## Scripts

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Vite dev server                                      |
| `npm test`          | Vitest (jsdom) unit and component tests              |
| `npm run lint`      | ESLint                                               |
| `npm run typecheck` | `tsc -b` over the app, test and config projects     |
| `npm run build`     | Type-check, then build the static site into `dist/`  |
| `npm run preview`   | Serve `dist/` locally                                |

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main` and on manual dispatch: `npm ci`, lint, tests and the
build, then publishes `dist/` with `actions/deploy-pages`. The Vite `base` is `/unicity-sphere-nft/`, matching the
Pages project URL.

One-time repository setup: **Settings → Pages → Source: GitHub Actions**.

## Project layout

```
src/
  connect/      Connect config (permissions, dApp metadata), popup wallet choice,
                useSphereConnect hook, mint_nft wire types, error mapping
  meme/         caption fit/wrap and placement, canvas rendering, image loading,
                export-size search
  nft/          base64 and the meme NFT content builder
  components/   editor, caption controls, mint panel, connect card, header
```
