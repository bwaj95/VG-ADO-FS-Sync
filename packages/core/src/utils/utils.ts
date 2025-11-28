export const formattedDate = (): string => {
  const now = new Date();

  const formatted = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}_${now
    .getHours()
    .toString()
    .padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}`;

  return formatted;
};

export const getUtcTimestamp = (dateInput?: Date | string): string => {
  const date = dateInput ? new Date(dateInput) : new Date();

  // Get UTC parts
  const year = date.getUTCFullYear();
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[date.getUTCMonth()];
  const day = date.getUTCDate().toString().padStart(2, "0");

  // Format hours/minutes in 12-hour format
  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // convert 0–23 to 1–12
  const hourStr = hours.toString().padStart(2, "0");

  // Combine everything
  return `${year}-${month}-${day} ${hourStr}:${minutes} ${ampm} (UTC)`;
};

const INVISIBLE_SPACES =
  /[\u00A0\u1680\u180E\u2000-\u200D\u202F\u205F\u3000\uFEFF]/g;
const SMART_QUOTES = /[“”‘’]/g;

/**
 * Sanitize the user query and return encodeURIComponent("\"sanitized query\"")
 * This will encode apostrophes as %27 and spaces as %20 (single), matching Postman.
 */
export function sanitizeAndEncodeFSQuery(raw: string): string {
  if (!raw || typeof raw !== "string") return encodeURIComponent('""');

  // 1. Replace invisible spaces with normal space
  let q = raw.replace(INVISIBLE_SPACES, " ");

  // 2. Replace smart quotes with straight single quote
  q = q.replace(SMART_QUOTES, "'");

  // 3. Replace any sequences of whitespace (tabs/newlines/multi-space) with a single space
  q = q.replace(/\s+/g, " ").trim();

  // 4. Ensure single quotes around tokens remain straight quotes (already replaced)
  // 5. Wrap entire query in double quotes (Freshservice requires quotes)
  const wrapped = `"${q}"`;

  // 6. Encode the wrapped string as Postman does
  return encodeURIComponent(wrapped);
}

export function stringifyMultiSelectFS(modules: string[]): string {
  if (!modules || modules.length === 0) {
    return ""; // or return "N/A" if you prefer
  }

  if (modules.length === 1) {
    return modules[0]?.toString() || "";
  }

  return modules.map((m) => m.toString()).join(", ");
}

export function convertADODateToISO(dateStr: string): string {
  // dateStr = "10/06/2025" → MM/DD/YYYY

  if (dateStr && !dateStr.includes("/")) {
    return dateStr;
  }

  const [month, day, year] = dateStr.split("/");

  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);

  return date.toISOString();
}
