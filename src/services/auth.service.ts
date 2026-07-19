import bcrypt from "bcryptjs";
import crypto from "crypto";
import { UserRepository } from "@/repositories/user.repository";

export const AuthService = {
  async registerUser(name: string, email: string, password: string, username: string) {
    const normalized = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    
    // Check if user already exists
    const existing = await UserRepository.findByEmail(normalized);
    if (existing) {
      throw new Error("EMAIL_TAKEN");
    }

    const existingUsername = await UserRepository.findByUsername(normalizedUsername);
    if (existingUsername) {
      throw new Error("USERNAME_TAKEN");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUserId = crypto.randomUUID();
    const user = await UserRepository.create({
      id: newUserId,
      name,
      username: normalizedUsername,
      email: normalized,
      passwordHash,
      image: null,
    });
    return { user, workspace: null };
  },

  async registerGoogleUser(name: string, email: string, image?: string | null) {
    const normalized = email.trim().toLowerCase();
    
    // Check if user already exists
    const existing = await UserRepository.findByEmail(normalized);
    if (existing) {
      return { user: existing, workspace: null };
    }

    // Generate unique username from email
    let baseUsername = normalized.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
    if (baseUsername.length < 3) baseUsername = "user";
    let genUsername = baseUsername;
    let suffix = 1;
    while (await UserRepository.findByUsername(genUsername)) {
      genUsername = `${baseUsername}${suffix}`;
      suffix++;
    }

    // Save special marker to identify Google account without a password
    const passwordHash = "google_oauth_no_password";
    
    const newUserId = crypto.randomUUID();
    const user = await UserRepository.create({
      id: newUserId,
      name,
      username: genUsername,
      email: normalized,
      passwordHash,
      image: image || null,
    });
    return { user, workspace: null };
  },

  async validateUserCredentials(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const user = await UserRepository.findByEmail(normalized);
    if (!user || user.passwordHash === "google_oauth_no_password") {
      return null;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      image: user.image ?? undefined,
      tokenVersion: user.tokenVersion,
    };
  },
};
