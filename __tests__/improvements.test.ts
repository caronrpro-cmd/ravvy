import { describe, it, expect } from "vitest";
import {
  formatDateFR,
  formatDateLongFR,
  formatDateShortFR,
  formatRelativeTimeFR,
  formatTimeFR,
  convertDateFormat,
  parseDateFR,
} from "../lib/date-utils";

describe("Date Utils - Format français", () => {
  it("formatDateFR formate en JJ/MM/AAAA", () => {
    const date = new Date(2026, 2, 15); // 15 mars 2026
    expect(formatDateFR(date)).toBe("15/03/2026");
  });

  it("formatDateFR avec une string ISO", () => {
    expect(formatDateFR("2026-12-25T10:00:00.000Z")).toMatch(/25\/12\/2026/);
  });

  it("formatDateFR retourne la string originale si invalide", () => {
    expect(formatDateFR("invalid")).toBe("invalid");
  });

  it("formatDateLongFR formate en jour complet", () => {
    const date = new Date(2026, 0, 5); // 5 janvier 2026
    const result = formatDateLongFR(date);
    expect(result).toContain("5");
    expect(result).toContain("janvier");
    expect(result).toContain("2026");
  });

  it("formatDateShortFR formate en jour court", () => {
    const date = new Date(2026, 5, 20); // 20 juin 2026
    expect(formatDateShortFR(date)).toBe("20 jui.");
  });

  it("formatTimeFR formate en HH:MM", () => {
    const date = new Date(2026, 0, 1, 14, 30);
    expect(formatTimeFR(date)).toBe("14:30");
  });

  it("formatTimeFR avec padding", () => {
    const date = new Date(2026, 0, 1, 9, 5);
    expect(formatTimeFR(date)).toBe("09:05");
  });

  it("convertDateFormat convertit YYYY-MM-DD en JJ/MM/AAAA", () => {
    expect(convertDateFormat("2026-03-15")).toBe("15/03/2026");
  });

  it("convertDateFormat laisse JJ/MM/AAAA tel quel", () => {
    expect(convertDateFormat("15/03/2026")).toBe("15/03/2026");
  });

  it("parseDateFR parse JJ/MM/AAAA correctement", () => {
    const date = parseDateFR("25/12/2026");
    expect(date).not.toBeNull();
    expect(date!.getDate()).toBe(25);
    expect(date!.getMonth()).toBe(11); // December = 11
    expect(date!.getFullYear()).toBe(2026);
  });

  it("parseDateFR retourne null pour un format invalide", () => {
    expect(parseDateFR("2026-03-15")).toBeNull();
    expect(parseDateFR("invalid")).toBeNull();
  });

  it("formatRelativeTimeFR retourne 'à l'instant' pour maintenant", () => {
    const now = new Date();
    expect(formatRelativeTimeFR(now)).toBe("à l'instant");
  });

  it("formatRelativeTimeFR retourne 'il y a X min'", () => {
    const date = new Date(Date.now() - 5 * 60000);
    expect(formatRelativeTimeFR(date)).toBe("il y a 5 min");
  });

  it("formatRelativeTimeFR retourne 'il y a Xh'", () => {
    const date = new Date(Date.now() - 3 * 3600000);
    expect(formatRelativeTimeFR(date)).toBe("il y a 3h");
  });

  it("formatRelativeTimeFR retourne 'hier'", () => {
    const date = new Date(Date.now() - 86400000);
    expect(formatRelativeTimeFR(date)).toBe("hier");
  });
});

describe("Store formatDate - Format JJ/MM/AAAA", () => {
  // Import from store to verify the updated function
  it("store formatDate retourne JJ/MM/AAAA", async () => {
    const { formatDate } = await import("../lib/store");
    const result = formatDate(new Date(2026, 2, 15).toISOString());
    expect(result).toMatch(/15\/03\/2026/);
  });

  it("store formatTime retourne HH:MM", async () => {
    const { formatTime } = await import("../lib/store");
    const result = formatTime(new Date(2026, 0, 1, 20, 30).toISOString());
    expect(result).toBe("20:30");
  });
});
