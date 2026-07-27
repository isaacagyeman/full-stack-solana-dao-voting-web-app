/**
 * Simple CSV parser for bulk voter uploads
 * Supports basic CSV format: email, name, phone (optional)
 */

export interface VoterRecord {
  email: string;
  name: string;
  phone?: string;
}

export function parseCSV(csvContent: string): {
  records: VoterRecord[];
  errors: string[];
} {
  const lines = csvContent.trim().split(/\r?\n/);
  const records: VoterRecord[] = [];
  const errors: string[] = [];

  if (lines.length === 0) {
    return { records, errors: ["CSV file is empty"] };
  }

  // Parse header
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const emailIndex = header.indexOf("email");
  const nameIndex = header.indexOf("name");
  const phoneIndex = header.indexOf("phone");

  if (emailIndex === -1 || nameIndex === -1) {
    return {
      records,
      errors: ["CSV must have 'email' and 'name' columns"],
    };
  }

  // Parse rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    try {
      const fields = parseCSVLine(line);
      const email = fields[emailIndex]?.trim() || "";
      const name = fields[nameIndex]?.trim() || "";
      const phone = phoneIndex !== -1 ? fields[phoneIndex]?.trim() : undefined;

      if (!email || !name) {
        errors.push(`Row ${i + 1}: Missing email or name`);
        continue;
      }

      if (!isValidEmail(email)) {
        errors.push(`Row ${i + 1}: Invalid email format: ${email}`);
        continue;
      }

      records.push({ email, name, phone });
    } catch (err) {
      errors.push(`Row ${i + 1}: Failed to parse - ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { records, errors };
}

/**
 * Simple CSV line parser that handles quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
