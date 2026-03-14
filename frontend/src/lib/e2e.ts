/**
 * E2E message encryption using Web Crypto API.
 * ECDH P-256 for key agreement, HKDF to derive AES-256-GCM key, then encrypt per message with random IV.
 */

const E2E_PREFIX = 'e2e:'
const E2E_STORAGE_KEY_PRIV = 'lx_e2e_private_key'
const E2E_STORAGE_KEY_PUB = 'lx_e2e_public_key'
const HKDF_SALT = new TextEncoder().encode('lx-os-e2e-v1')
const IV_LEN = 12
const AES_KEY_LEN = 256

function b64Encode(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return btoa(bin)
}

function b64Decode(str: string): Uint8Array {
  return new Uint8Array(atob(str).split('').map((c) => c.charCodeAt(0)))
}

export function isEncrypted(content: string): boolean {
  return typeof content === 'string' && content.startsWith(E2E_PREFIX)
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const raw = await window.crypto.subtle.exportKey('raw', publicKey)
  return b64Encode(raw)
}

export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const jwk = await window.crypto.subtle.exportKey('jwk', privateKey)
  return btoa(JSON.stringify(jwk))
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const raw = b64Decode(base64)
  return window.crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )
}

export async function importPrivateKey(base64: string): Promise<CryptoKey> {
  const jwk = JSON.parse(atob(base64)) as JsonWebKey
  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )
}

async function deriveAesKey(sharedSecret: ArrayBuffer): Promise<CryptoKey> {
  const key = await window.crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey']
  )
  return window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: HKDF_SALT,
      info: new Uint8Array(0),
    },
    key,
    { name: 'AES-GCM', length: AES_KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Get or create keypair; persist to localStorage and return public key base64. */
export async function ensureKeyPairAndExportPublic(): Promise<string> {
  const storedPub = localStorage.getItem(E2E_STORAGE_KEY_PUB)
  const storedPriv = localStorage.getItem(E2E_STORAGE_KEY_PRIV)
  if (storedPub && storedPriv) {
    try {
      await importPrivateKey(storedPriv)
      return storedPub
    } catch {
      localStorage.removeItem(E2E_STORAGE_KEY_PUB)
      localStorage.removeItem(E2E_STORAGE_KEY_PRIV)
    }
  }
  const pair = await generateKeyPair()
  const pubB64 = await exportPublicKey(pair.publicKey)
  const privB64 = await exportPrivateKey(pair.privateKey)
  localStorage.setItem(E2E_STORAGE_KEY_PUB, pubB64)
  localStorage.setItem(E2E_STORAGE_KEY_PRIV, privB64)
  return pubB64
}

/** Get private key from storage (or null if not set). */
export async function getPrivateKey(): Promise<CryptoKey | null> {
  const stored = localStorage.getItem(E2E_STORAGE_KEY_PRIV)
  if (!stored) return null
  try {
    return await importPrivateKey(stored)
  } catch {
    return null
  }
}

/** Encrypt plaintext for a recipient; recipientPublicKey is base64. Returns "e2e:" + base64(iv|ciphertext). */
export async function encrypt(
  plaintext: string,
  recipientPublicKeyBase64: string
): Promise<string> {
  const myPrivate = await getPrivateKey()
  if (!myPrivate) throw new Error('E2E: no local keypair')
  const theirPublic = await importPublicKey(recipientPublicKeyBase64)
  const sharedSecret = await window.crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublic },
    myPrivate,
    256
  )
  const aesKey = await deriveAesKey(sharedSecret)
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN))
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    new TextEncoder().encode(plaintext)
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return E2E_PREFIX + b64Encode(combined.buffer)
}

/** Decrypt content that starts with "e2e:"; senderPublicKeyBase64 is the message sender's public key. */
export async function decrypt(
  encryptedContent: string,
  senderPublicKeyBase64: string
): Promise<string> {
  if (!isEncrypted(encryptedContent)) return encryptedContent
  const myPrivate = await getPrivateKey()
  if (!myPrivate) return '[Unable to decrypt: no key]'
  const payload = encryptedContent.slice(E2E_PREFIX.length)
  const combined = b64Decode(payload)
  const iv = combined.slice(0, IV_LEN)
  const ciphertext = combined.slice(IV_LEN)
  const theirPublic = await importPublicKey(senderPublicKeyBase64)
  const sharedSecret = await window.crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublic },
    myPrivate,
    256
  )
  const aesKey = await deriveAesKey(sharedSecret)
  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      aesKey,
      ciphertext
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    return '[Unable to decrypt]'
  }
}
