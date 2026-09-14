/**
 * Standard base64 (RFC 4648 section 4, with padding), as the mint_nft wire
 * contract requires for inline media bytes.
 */

// String.fromCharCode takes its bytes as call arguments; chunking keeps a
// ~900 KB image well under engines' argument-count limits.
const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
