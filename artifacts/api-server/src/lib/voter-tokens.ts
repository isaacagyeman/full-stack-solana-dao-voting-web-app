import { randomBytes } from "crypto";

/**
 * Generate a cryptographically secure voter token
 * Format: prefix-<random-chars> for easy recognition and validation
 */
export function generateVoterToken(): string {
  const randomPart = randomBytes(32).toString("hex");
  return `VOTE-${randomPart.substring(0, 40).toUpperCase()}`;
}

/**
 * Validate voter token format
 */
export function isValidVoterToken(token: string): boolean {
  return /^VOTE-[A-F0-9]{40}$/.test(token);
}
