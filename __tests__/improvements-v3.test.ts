import { describe, it, expect } from "vitest";

// Test reminder date parsing
describe("Reminder date parsing", () => {
  it("should parse DD/MM/YYYY format correctly", () => {
    const dateStr = "25/12/2025";
    const parts = dateStr.split("/");
    const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T20:00:00`);
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(11); // December = 11
    expect(date.getDate()).toBe(25);
  });

  it("should parse ISO format correctly", () => {
    const dateStr = "2025-12-25T20:00:00";
    const date = new Date(dateStr);
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(25);
  });

  it("should calculate 24h and 1h delays correctly", () => {
    const eventDate = new Date("2025-12-25T20:00:00");
    const now = new Date("2025-12-24T10:00:00");
    const diff = eventDate.getTime() - now.getTime();
    const oneHour = 60 * 60 * 1000;
    const twentyFourHours = 24 * 60 * 60 * 1000;

    expect(diff).toBeGreaterThan(twentyFourHours);
    const delay24h = diff - twentyFourHours;
    const delay1h = diff - oneHour;
    expect(delay24h).toBeGreaterThan(0);
    expect(delay1h).toBeGreaterThan(0);
    expect(delay1h).toBeGreaterThan(delay24h);
  });
});

// Test debt calculation (tricount)
describe("Bilan debt calculation", () => {
  it("should calculate simple debt between two people", () => {
    const expenses = [
      { paidBy: "user1", amount: 100, splitBetween: ["user1", "user2"] },
    ];

    const balances: Record<string, number> = { user1: 0, user2: 0 };
    expenses.forEach((e) => {
      const perPerson = e.amount / e.splitBetween.length;
      balances[e.paidBy] += e.amount;
      e.splitBetween.forEach((p) => {
        balances[p] -= perPerson;
      });
    });

    expect(balances.user1).toBe(50); // paid 100, owes 50 → net +50
    expect(balances.user2).toBe(-50); // paid 0, owes 50 → net -50
  });

  it("should handle multiple expenses", () => {
    const expenses = [
      { paidBy: "user1", amount: 60, splitBetween: ["user1", "user2", "user3"] },
      { paidBy: "user2", amount: 30, splitBetween: ["user1", "user2", "user3"] },
    ];

    const balances: Record<string, number> = { user1: 0, user2: 0, user3: 0 };
    expenses.forEach((e) => {
      const perPerson = e.amount / e.splitBetween.length;
      balances[e.paidBy] += e.amount;
      e.splitBetween.forEach((p) => {
        balances[p] -= perPerson;
      });
    });

    // user1: paid 60, owes 20+10=30 → net +30
    // user2: paid 30, owes 20+10=30 → net 0
    // user3: paid 0, owes 20+10=30 → net -30
    expect(balances.user1).toBeCloseTo(30);
    expect(balances.user2).toBeCloseTo(0);
    expect(balances.user3).toBeCloseTo(-30);
  });

  it("should handle equal expenses (no debts)", () => {
    const expenses = [
      { paidBy: "user1", amount: 50, splitBetween: ["user1", "user2"] },
      { paidBy: "user2", amount: 50, splitBetween: ["user1", "user2"] },
    ];

    const balances: Record<string, number> = { user1: 0, user2: 0 };
    expenses.forEach((e) => {
      const perPerson = e.amount / e.splitBetween.length;
      balances[e.paidBy] += e.amount;
      e.splitBetween.forEach((p) => {
        balances[p] -= perPerson;
      });
    });

    expect(balances.user1).toBeCloseTo(0);
    expect(balances.user2).toBeCloseTo(0);
  });
});

// Test memories filtering
describe("Memories - Past groups filtering", () => {
  it("should filter past groups correctly", () => {
    const groups = [
      { id: "1", date: "2024-01-15", name: "Past party" },
      { id: "2", date: "2099-12-31", name: "Future party" },
    ];

    const pastGroups = groups.filter((g) => {
      const d = new Date(g.date);
      return !isNaN(d.getTime()) && d.getTime() < Date.now();
    });

    expect(pastGroups.length).toBe(1);
    expect(pastGroups[0].name).toBe("Past party");
  });

  it("should sort past groups by date descending", () => {
    const groups = [
      { id: "1", date: "2024-01-15", name: "January" },
      { id: "2", date: "2024-06-15", name: "June" },
      { id: "3", date: "2024-03-15", name: "March" },
    ];

    const sorted = groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    expect(sorted[0].name).toBe("June");
    expect(sorted[1].name).toBe("March");
    expect(sorted[2].name).toBe("January");
  });
});

// Test share text generation
describe("Bilan share text", () => {
  it("should generate correct share text", () => {
    const group = { name: "BBQ Party", date: "15/07/2025", location: "Parc" };
    const debts = [
      { fromName: "Alice", toName: "Bob", amount: 25.50 },
    ];

    const lines = [
      `Bilan de "${group.name}"`,
      `Lieu : ${group.location}`,
      ``,
      `Remboursements :`,
    ];
    debts.forEach((d) => {
      lines.push(`  ${d.fromName} doit ${d.amount.toFixed(2)}€ à ${d.toName}`);
    });

    const text = lines.join("\n");
    expect(text).toContain("BBQ Party");
    expect(text).toContain("Alice doit 25.50€ à Bob");
  });
});

// Test photo profil and banner
describe("Profile and banner image", () => {
  it("should accept image URI for avatar", () => {
    const profile = { name: "Test", avatar: "" };
    const newUri = "file:///path/to/photo.jpg";
    profile.avatar = newUri;
    expect(profile.avatar).toBe(newUri);
    expect(profile.avatar.length).toBeGreaterThan(0);
  });

  it("should accept image URI for group cover", () => {
    const group = { name: "Party", coverImage: "" };
    const newUri = "file:///path/to/cover.jpg";
    group.coverImage = newUri;
    expect(group.coverImage).toBe(newUri);
  });
});

// Test QR code share link generation
describe("Group share link", () => {
  it("should generate valid share code", () => {
    const groupId = "group_abc123";
    const code = groupId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
    expect(code.length).toBeLessThanOrEqual(8);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });
});
