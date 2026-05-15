/**
 * Graph change-notification payload decryption utility.
 *
 * Generate the RSA-2048 key pair once with:
 *
 *   openssl genrsa -out webhook_private.pem 2048
 *   openssl rsa -in webhook_private.pem -pubout -out webhook_public.pem
 *
 * Then set WEBHOOK_RSA_PRIVATE_KEY and WEBHOOK_RSA_PUBLIC_KEY in your
 * environment (with literal \n escapes for newlines in .env files, or real
 * newlines in shell exports).
 */

import {
  createPrivateKey,
  privateDecrypt,
  createDecipheriv,
  constants,
} from "crypto";

/**
 * Decrypt a Graph change notification encrypted payload.
 *
 * Graph encrypts the symmetric key with RSA-OAEP (SHA-1) and the payload
 * with AES-256-CBC using that symmetric key.
 *
 * Ref: https://learn.microsoft.com/graph/change-notifications-with-resource-data
 */
export function decryptGraphPayload(encryptedContent: {
  /** RSA-OAEP encrypted AES key (base64) */
  dataKey: string;
  /** AES-256-CBC encrypted payload (base64) */
  data: string;
  /** HMAC-SHA256 signature (base64) */
  dataSignature: string;
  encryptionCertificateId: string;
  encryptionCertificateThumbprint: string;
}): unknown {
  const rawPem = process.env.WEBHOOK_RSA_PRIVATE_KEY;
  if (!rawPem) {
    throw new Error("WEBHOOK_RSA_PRIVATE_KEY env var is not set");
  }

  const privateKeyPem = rawPem.replace(/\\n/g, "\n");
  const privateKey = createPrivateKey(privateKeyPem);

  // 1. Decrypt symmetric AES key with RSA-OAEP SHA-1
  const encryptedKey = Buffer.from(encryptedContent.dataKey, "base64");
  const aesKey = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha1",
    },
    encryptedKey
  );

  // 2. Decrypt payload with AES-256-CBC; IV is first 16 bytes of encrypted data
  const encryptedData = Buffer.from(encryptedContent.data, "base64");
  const iv = encryptedData.subarray(0, 16);
  const ciphertext = encryptedData.subarray(16);
  const decipher = createDecipheriv("aes-256-cbc", aesKey, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return JSON.parse(decrypted.toString("utf8"));
}
