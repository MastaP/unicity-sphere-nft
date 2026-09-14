import type { PublicIdentity } from '@unicitylabs/sphere-sdk/connect';

function shorten(value: string, head: number, tail: number): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** How the connected wallet is named on screen: its nametag, else a shortened DIRECT address. */
export function displayIdentity(identity: PublicIdentity | null): string {
  if (!identity) return '';
  const nametag = identity.nametag?.trim().replace(/^@/, '');
  if (nametag) return `@${nametag}`;
  const direct = identity.directAddress;
  if (direct) {
    const prefix = /^DIRECT:\/\//i.exec(direct)?.[0] ?? '';
    return prefix + shorten(direct.slice(prefix.length), 6, 4);
  }
  return shorten(identity.chainPubkey, 6, 4);
}
