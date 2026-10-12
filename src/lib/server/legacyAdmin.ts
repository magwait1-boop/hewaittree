import 'server-only';

import { scrypt, timingSafeEqual } from 'node:crypto';

// Compatibility verifier for the existing tree administrator. This never leaves
// the server. The legacy tree role is not authentication for private visitor data.
const DEFAULT_ADMIN_USERNAME = 'magwait';
const DEFAULT_ADMIN_PASSWORD_HASH =
  'd59444955d0b7e94716620108128b6e0:4bf92ca698c9a8cd2b719022d9cab107869e1e0acec39aa36101055a4474000e4b7c102e6d7199668b286fc6c443372b9a991adced2b78f8fae963f15083e3a4';

/** Optionally override both values using server-only deployment environment variables. */
export async function verifyLegacyAdmin(username: string, password: string): Promise<boolean> {
  if (!username || username.length > 128 || !password || password.length > 512) return false;
  const configuredHash = process.env.FAMILY_ADMIN_PASSWORD_HASH ?? DEFAULT_ADMIN_PASSWORD_HASH;
  if (!/^[a-f\d]{32,128}:[a-f\d]{128}$/i.test(configuredHash)) {
    throw new Error('Invalid administrator password verifier configuration');
  }
  const [saltHex, expectedHex] = configuredHash.split(':');
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
  const matchesPassword = timingSafeEqual(actual, expected);
  const expectedUsername = process.env.FAMILY_ADMIN_USERNAME ?? DEFAULT_ADMIN_USERNAME;
  return matchesPassword && username.trim() === expectedUsername;
}
