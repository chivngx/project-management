import crypto from "crypto";

const algorithm = "aes-256-cbc";
const secret = process.env.NEXTAUTH_SECRET || "default-secret-key-projectflow-management";
// Securely derive a 32-byte key from the NextAuth secret
const key = crypto.createHash("sha256").update(secret).digest();

/**
 * Encrypts a plain text string using AES-256-CBC.
 * Returns the format `ivHex:encryptedHex`.
 */
export function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an AES-256-CBC encrypted string.
 * If the string is not in the correct `ivHex:encryptedHex` format,
 * it returns the string as-is (graceful fallback for legacy unencrypted tokens).
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    // Graceful fallback for legacy plain text tokens
    return encryptedText;
  }

  try {
    const [ivHex, encryptedHex] = parts;
    if (ivHex.length !== 32) {
      // IV must be 16 bytes (32 hex characters)
      return encryptedText;
    }
    
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    console.error("Failed to decrypt token. Falling back to original text.", e);
    return encryptedText;
  }
}
