import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./encryption";

describe("Token Encryption Utility", () => {
  it("should encrypt and decrypt correctly", () => {
    const originalToken = "ghp_secureToken123456789";
    const encrypted = encrypt(originalToken);
    
    expect(encrypted).not.toBe(originalToken);
    expect(encrypted).toContain(":");
    
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(originalToken);
  });

  it("should fall back gracefully and return the original text if input is not encrypted (plain text)", () => {
    const plainToken = "glpat-legacyPlainToken456";
    const decrypted = decrypt(plainToken);
    
    expect(decrypted).toBe(plainToken);
  });

  it("should return empty string for empty inputs", () => {
    expect(encrypt("")).toBe("");
    expect(decrypt("")).toBe("");
  });
});
