/**
 * Financial utilities using integer cents to avoid floating-point rounding errors.
 */

/** Convert euros (float) to integer cents. */
export function toCents(euros: number): number {
  return Math.round(euros * 100);
}

/** Convert integer cents to euros (float). */
export function toEuros(cents: number): number {
  return cents / 100;
}

/** Format cents as a localized euro string, e.g. "12.50€". */
export function formatEuros(cents: number): string {
  return toEuros(cents).toFixed(2) + "€";
}

/**
 * Splits an amount (in cents) as evenly as possible among `n` people.
 * The first `remainder` shares receive one extra cent to account for indivisibility.
 * Returns an array of length `n`.
 */
export function splitEvenly(totalCents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalCents / n);
  const remainder = totalCents % n;
  return Array.from({ length: n }, (_, i) => (i < remainder ? base + 1 : base));
}

export interface DebtResult {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  /** Amount in cents */
  amountCents: number;
}

export interface Expense {
  paidBy: string;
  /** Amount in euros (stored as float in the app state) */
  amount: number;
  splitBetween: string[];
}

export interface Member {
  id: string;
  name: string;
}

/**
 * Calculates the simplified debt graph for a list of expenses.
 * All arithmetic is done in integer cents.
 * Returns an array of transfer instructions to settle all debts.
 */
export function calculateDebts(expenses: Expense[], members: Member[]): DebtResult[] {
  if (expenses.length === 0) return [];

  const balancesCents: Record<string, { name: string; cents: number }> = {};

  for (const m of members) {
    balancesCents[m.id] = { name: m.name, cents: 0 };
  }

  for (const expense of expenses) {
    const totalCents = toCents(expense.amount);
    const splitCount = expense.splitBetween.length || 1;
    const shares = splitEvenly(totalCents, splitCount);

    if (balancesCents[expense.paidBy]) {
      balancesCents[expense.paidBy].cents += totalCents;
    }

    expense.splitBetween.forEach((personId, idx) => {
      if (balancesCents[personId]) {
        balancesCents[personId].cents -= shares[idx];
      }
    });
  }

  // Simplify: match debtors with creditors
  const debtors = Object.entries(balancesCents)
    .filter(([_, v]) => v.cents < -1)
    .map(([id, v]) => ({ id, name: v.name, cents: -v.cents }))
    .sort((a, b) => b.cents - a.cents);

  const creditors = Object.entries(balancesCents)
    .filter(([_, v]) => v.cents > 1)
    .map(([id, v]) => ({ id, name: v.name, cents: v.cents }))
    .sort((a, b) => b.cents - a.cents);

  const result: DebtResult[] = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];
    const transfer = Math.min(debtor.cents, creditor.cents);

    if (transfer > 1) {
      result.push({
        from: debtor.id,
        fromName: debtor.name,
        to: creditor.id,
        toName: creditor.name,
        amountCents: transfer,
      });
    }

    debtor.cents -= transfer;
    creditor.cents -= transfer;

    if (debtor.cents <= 1) di++;
    if (creditor.cents <= 1) ci++;
  }

  return result;
}
