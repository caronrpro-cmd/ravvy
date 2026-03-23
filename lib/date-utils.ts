/**
 * Utilitaires de formatage de dates en français (JJ/MM/AAAA)
 */

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const DAYS_FR = [
  "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
];

/**
 * Format date as JJ/MM/AAAA
 */
export function formatDateFR(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return dateStr as string;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date as "Lundi 15 janvier 2026"
 */
export function formatDateLongFR(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return dateStr as string;
  const dayName = DAYS_FR[date.getDay()];
  const day = date.getDate();
  const month = MONTHS_FR[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${day} ${month} ${year}`;
}

/**
 * Format date as "15 jan."
 */
export function formatDateShortFR(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return dateStr as string;
  const day = date.getDate();
  const month = MONTHS_FR[date.getMonth()].substring(0, 3);
  return `${day} ${month}.`;
}

/**
 * Format relative time in French: "il y a 5 min", "il y a 2h", "hier", etc.
 */
export function formatRelativeTimeFR(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHour < 24) return `il y a ${diffHour}h`;
  if (diffDay === 1) return "hier";
  if (diffDay < 7) return `il y a ${diffDay} jours`;
  return formatDateFR(date);
}

/**
 * Format time as HH:MM
 */
export function formatTimeFR(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return dateStr as string;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Format a date string that might be in YYYY-MM-DD format to JJ/MM/AAAA
 */
export function convertDateFormat(dateStr: string): string {
  // Already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  // YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  }
  // Try parsing as date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return formatDateFR(date);
  return dateStr;
}

/**
 * Parse a DD/MM/YYYY date string to a Date object
 */
export function parseDateFR(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
