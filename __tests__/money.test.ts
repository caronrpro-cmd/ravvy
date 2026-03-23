import { describe, it, expect } from "vitest";
import { toCents, toEuros, formatEuros, splitEvenly, calculateDebts } from "../lib/money";

describe("toCents", () => {
  it("converts whole euros", () => {
    expect(toCents(10)).toBe(1000);
  });

  it("converts decimal euros without floating-point drift", () => {
    expect(toCents(0.1 + 0.2)).toBe(30); // 0.1+0.2 = 0.30000000000000004 in JS
  });

  it("converts 12.50€", () => {
    expect(toCents(12.5)).toBe(1250);
  });
});

describe("toEuros", () => {
  it("converts cents to euros", () => {
    expect(toEuros(1250)).toBe(12.5);
  });

  it("converts 1 cent", () => {
    expect(toEuros(1)).toBeCloseTo(0.01);
  });
});

describe("formatEuros", () => {
  it("formats 1000 cents as 10.00€", () => {
    expect(formatEuros(1000)).toBe("10.00€");
  });

  it("formats 1 cent as 0.01€", () => {
    expect(formatEuros(1)).toBe("0.01€");
  });
});

describe("splitEvenly", () => {
  it("splits evenly when divisible", () => {
    expect(splitEvenly(900, 3)).toEqual([300, 300, 300]);
  });

  it("distributes remainder cents to first slots", () => {
    // 10€ / 3 = 333 + 333 + 334  (3.34 + 3.33 + 3.33 = 10.00)
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
  });

  it("handles n=1", () => {
    expect(splitEvenly(500, 1)).toEqual([500]);
  });

  it("returns empty array for n=0", () => {
    expect(splitEvenly(500, 0)).toEqual([]);
  });

  it("splits 10 cents among 3 people (remainder 1)", () => {
    expect(splitEvenly(10, 3)).toEqual([4, 3, 3]);
  });
});

describe("calculateDebts", () => {
  const members = [
    { id: "alice", name: "Alice" },
    { id: "bob", name: "Bob" },
    { id: "carol", name: "Carol" },
  ];

  it("returns no debts when there are no expenses", () => {
    expect(calculateDebts([], members)).toEqual([]);
  });

  it("calculates a simple two-person debt", () => {
    const expenses = [{ paidBy: "alice", amount: 20, splitBetween: ["alice", "bob"] }];
    const debts = calculateDebts(expenses, members);
    expect(debts).toHaveLength(1);
    expect(debts[0].from).toBe("bob");
    expect(debts[0].to).toBe("alice");
    expect(debts[0].amountCents).toBe(1000); // 10€
  });

  it("handles a three-way split where one person paid", () => {
    // Alice pays 30€ split 3 ways → Bob and Carol each owe 10€
    const expenses = [{ paidBy: "alice", amount: 30, splitBetween: ["alice", "bob", "carol"] }];
    const debts = calculateDebts(expenses, members);
    expect(debts).toHaveLength(2);
    const totalOwed = debts.reduce((s, d) => s + d.amountCents, 0);
    expect(totalOwed).toBe(2000); // 20€ total owed back to Alice
  });

  it("produces no debts when expenses perfectly cancel out", () => {
    const expenses = [
      { paidBy: "alice", amount: 10, splitBetween: ["alice", "bob"] },
      { paidBy: "bob", amount: 10, splitBetween: ["alice", "bob"] },
    ];
    expect(calculateDebts(expenses, members)).toHaveLength(0);
  });

  it("avoids floating-point rounding errors on 0.1+0.2 amounts", () => {
    // 0.1 + 0.2 should be treated as 0.30€, not 0.30000000000000004€
    const expenses = [{ paidBy: "alice", amount: 0.1 + 0.2, splitBetween: ["alice", "bob"] }];
    const debts = calculateDebts(expenses, members);
    expect(debts).toHaveLength(1);
    expect(debts[0].amountCents).toBe(15); // 0.15€ = 15 cents
  });
});
