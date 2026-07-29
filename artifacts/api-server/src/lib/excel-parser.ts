import * as XLSX from "xlsx";

export interface MemberRecord {
  fullName: string;
  email: string;
  phone: string;
  department?: string;
  position?: string;
}

export interface MemberImportResult {
  records: MemberRecord[];
  errors: string[];
}

/** Column name variants accepted (case-insensitive, dash/space-insensitive) */
const COL_MAP: Record<string, string> = {
  fullname: "fullName",
  "full name": "fullName",
  name: "fullName",
  email: "email",
  "email-address": "email",
  emailaddress: "email",
  "e-mail": "email",
  telephone: "phone",
  phone: "phone",
  "telephone number": "phone",
  "phone number": "phone",
  department: "department",
  dept: "department",
  position: "position",
  role: "position",
  title: "position",
};

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/[-_]+/g, " ");
}

export function parseExcelBuffer(buffer: Buffer): MemberImportResult {
  const records: MemberRecord[] = [];
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return { records, errors: ["Failed to read file. Make sure it is a valid .xlsx or .xls file."] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { records, errors: ["The workbook contains no sheets."] };
  }

  const ws = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];

  if (rows.length < 2) {
    return { records, errors: ["The sheet must have a header row and at least one data row."] };
  }

  // Build column index map from header row
  const headerRow = rows[0] as string[];
  const colIndex: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    const canonical = COL_MAP[normalise(String(h ?? ""))];
    if (canonical) colIndex[canonical] = idx;
  });

  const required = ["fullName", "email", "phone"];
  const missing = required.filter((f) => colIndex[f] === undefined);
  if (missing.length > 0) {
    const friendly = { fullName: "Full name", email: "Email address", phone: "Telephone number" };
    return {
      records,
      errors: [
        `Missing required columns: ${missing.map((m) => friendly[m as keyof typeof friendly]).join(", ")}. ` +
          `Expected column headers: Full name, Email-address, Telephone number, Department (optional), Position (optional).`,
      ],
    };
  }

  function cell(row: unknown[], field: string): string {
    const idx = colIndex[field];
    if (idx === undefined) return "";
    return String(row[idx] ?? "").trim();
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const isBlank = row.every((c) => !String(c ?? "").trim());
    if (isBlank) continue;

    const fullName = cell(row, "fullName");
    const email = cell(row, "email");
    const phone = cell(row, "phone");
    const department = cell(row, "department") || undefined;
    const position = cell(row, "position") || undefined;

    if (!fullName) { errors.push(`Row ${i + 1}: Full name is required`); continue; }
    if (!email) { errors.push(`Row ${i + 1}: Email address is required`); continue; }
    if (!phone) { errors.push(`Row ${i + 1}: Telephone number is required`); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Row ${i + 1}: Invalid email format: ${email}`); continue;
    }

    records.push({ fullName, email, phone, department, position });
  }

  return { records, errors };
}

/** Parse a candidate Excel: columns name (required), description (optional) */
export interface CandidateRecord {
  name: string;
  description?: string;
}

export function parseCandidateExcelBuffer(buffer: Buffer): { records: CandidateRecord[]; errors: string[] } {
  const records: CandidateRecord[] = [];
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return { records, errors: ["Failed to read file."] };
  }

  const ws = workbook.Sheets[workbook.SheetNames[0]];
  if (!ws) return { records, errors: ["Empty workbook."] };

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  if (rows.length < 2) return { records, errors: ["Need header row + at least one data row."] };

  const header = (rows[0] as string[]).map((h) => normalise(String(h ?? "")));
  const nameIdx = header.findIndex((h) => ["name", "candidate", "candidate name", "full name", "fullname"].includes(h));
  const descIdx = header.findIndex((h) => ["description", "desc", "bio", "about"].includes(h));

  if (nameIdx === -1) {
    return { records, errors: ["Sheet must have a 'Name' column."] };
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as string[];
    const name = String(row[nameIdx] ?? "").trim();
    if (!name) continue;
    const description = descIdx !== -1 ? String(row[descIdx] ?? "").trim() || undefined : undefined;
    records.push({ name, description });
  }

  return { records, errors };
}
