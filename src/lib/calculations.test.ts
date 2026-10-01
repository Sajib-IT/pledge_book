// src/lib/calculations.test.ts
// Unit tests for financial calculations and business rules

import { describe, it, expect } from 'vitest';
import {
  calculateYearlyInterest,
  calculateRenewAmount,
  calculateCloseAmount,
  isMortgageOverdue,
  getDaysUntilDue,
  formatBDT,
  toBanglaDigits,
} from './calculations';

describe('Mortgage Financial Calculations', () => {
  it('calculates flat yearly interest accurately: 40,000 at 25% = 10,000', () => {
    const interest = calculateYearlyInterest(40000, 25);
    expect(interest).toBe(10000);
  });

  it('calculates flat yearly interest for other amounts and rates', () => {
    // 50,000 at 25% = 12,500
    expect(calculateYearlyInterest(50000, 25)).toBe(12500);
    // 100,000 at 24% = 24,000
    expect(calculateYearlyInterest(100000, 24)).toBe(24000);
    // 33,333 at 10% = 3333.3 -> rounds to 3333 integer
    expect(calculateYearlyInterest(33333, 10)).toBe(3333);
  });

  it('calculates renew payment (interest only)', () => {
    const renew = calculateRenewAmount(40000, 25);
    expect(renew).toBe(10000);
  });

  it('calculates close payment (principal + interest: 40,000 + 10,000 = 50,000)', () => {
    const close = calculateCloseAmount(40000, 25);
    expect(close.principal).toBe(40000);
    expect(close.interest).toBe(10000);
    expect(close.total).toBe(50000);
  });

  it('handles negative or zero principal gracefully', () => {
    expect(calculateYearlyInterest(0, 25)).toBe(0);
    expect(calculateYearlyInterest(-5000, 25)).toBe(0);
  });
});

describe('Due Date & Overdue Logic', () => {
  const refDate = '2026-10-01';

  it('identifies overdue when due_date < today and status is active', () => {
    expect(isMortgageOverdue('2026-09-30', 'active', refDate)).toBe(true);
    expect(isMortgageOverdue('2026-01-15', 'active', refDate)).toBe(true);
  });

  it('does NOT mark closed or defaulted mortgages as overdue', () => {
    expect(isMortgageOverdue('2026-09-30', 'closed', refDate)).toBe(false);
    expect(isMortgageOverdue('2026-09-30', 'defaulted', refDate)).toBe(false);
  });

  it('identifies non-overdue when due_date is today or in the future', () => {
    expect(isMortgageOverdue('2026-10-01', 'active', refDate)).toBe(false);
    expect(isMortgageOverdue('2026-10-15', 'active', refDate)).toBe(false);
  });

  it('calculates days until due correctly', () => {
    expect(getDaysUntilDue('2026-10-01', refDate)).toBe(0);
    expect(getDaysUntilDue('2026-10-16', refDate)).toBe(15);
    expect(getDaysUntilDue('2026-09-21', refDate)).toBe(-10);
  });
});

describe('Bangla and BDT Formatting', () => {
  it('converts digits to Bangla digits', () => {
    expect(toBanglaDigits('0123456789')).toBe('০১২৩৪৫৬৭৮৯');
    expect(toBanglaDigits(40000)).toBe('৪০০০০');
  });

  it('formats currency in BDT in English and Bangla', () => {
    expect(formatBDT(40000, 'en')).toBe('৳ 40,000');
    expect(formatBDT(40000, 'bn')).toBe('৳ ৪০,০০০');
    expect(formatBDT(1500000, 'en')).toBe('৳ 15,00,000');
    expect(formatBDT(1500000, 'bn')).toBe('৳ ১৫,০০,০০০');
  });

  it('formats negative amounts correctly (for reversals/corrections)', () => {
    expect(formatBDT(-10000, 'en')).toBe('-৳ 10,000');
    expect(formatBDT(-10000, 'bn')).toBe('-৳ ১০,০০০');
  });
});
