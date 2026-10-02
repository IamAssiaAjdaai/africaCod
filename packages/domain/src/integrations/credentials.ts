import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export type ProviderCredentials = { apiKey: string; apiSecret: string };
export class CredentialVault {
  private key: Buffer;
  constructor(encodedKey: string | undefined) {
    if (!encodedKey || !/^[A-Za-z0-9+/]{43}=$/.test(encodedKey))
      throw new Error("Provider credential encryption is not configured.");
    this.key = Buffer.from(encodedKey, "base64");
    if (this.key.length !== 32)
      throw new Error("Provider credential encryption is not configured.");
  }
  encrypt(value: ProviderCredentials, context: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(context));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return JSON.stringify({
      v: 1,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: ciphertext.toString("base64"),
    });
  }
  decrypt(encoded: string, context: string): ProviderCredentials {
    try {
      const value = JSON.parse(encoded);
      if (value.v !== 1) throw new Error();
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(value.iv, "base64"),
      );
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(value.tag, "base64"));
      const clear = JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(value.data, "base64")),
          decipher.final(),
        ]).toString("utf8"),
      );
      if (
        typeof clear.apiKey !== "string" ||
        typeof clear.apiSecret !== "string"
      )
        throw new Error();
      return clear;
    } catch {
      throw new Error("Provider credentials could not be decrypted.");
    }
  }
}
