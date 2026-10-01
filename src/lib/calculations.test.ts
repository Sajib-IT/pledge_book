// src/lib/calculations.test.ts
// Unit tests for financial calculations, early repayments, discounts and business rules

import { describe, it, expect } from 'vitest';
import {
  calculateYearlyInterest,
  calculateRenewAmount,
  calculateCloseAmount,
  calculateElapsedDuration,
  calculateEarlySettlement,
  calculateRenewWithDiscount,
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

describe('Early Repayment & Elapsed Duration', () => {
  it('calculates elapsed days and months correctly for early repayment', () => {
    // 90 days = 3 months
    const { daysElapsed, monthsElapsed, isEarly } = calculateElapsedDuration('2026-01-01', '2026-04-01');
    expect(daysElapsed).toBe(90);
    expect(monthsElapsed).toBe(3);
    expect(isEarly).toBe(true);
  });

  it('computes pro-rata monthly early settlement: 40,000 principal at 25% after 3 months', () => {
    // Yearly interest is 10,000. 3 months = 10,000 * 3 / 12 = 2,500
    const res = calculateEarlySettlement(40000, 25, '2026-01-01', '2026-04-01', 'monthly');
    expect(res.yearlyInterest).toBe(10000);
    expect(res.calculatedInterest).toBe(2500);
    expect(res.total).toBe(42500);
    expect(res.isEarly).toBe(true);
  });

  it('computes pro-rata daily early settlement', () => {
    // 90 days = 10,000 * 90 / 365 = 2466
    const res = calculateEarlySettlement(40000, 25, '2026-01-01', '2026-04-01', 'daily');
    expect(res.calculatedInterest).toBe(2466);
    expect(res.total).toBe(42466);
  });

  it('applies discounts (e.g. 500 or 1,000 taka discount) correctly on early close', () => {
    // Monthly interest: 2500, Discount: 500 => Net interest: 2000, Total: 42000
    const with500 = calculateEarlySettlement(40000, 25, '2026-01-01', '2026-04-01', 'monthly', 500);
    expect(with500.discount).toBe(500);
    expect(with500.netInterest).toBe(2000);
    expect(with500.total).toBe(42000);

    // Full year: 10,000 interest, Discount: 1,000 => Net interest: 9,000, Total: 49,000
    const with1000 = calculateEarlySettlement(40000, 25, '2026-01-01', '2027-01-01', 'full_year', 1000);
    expect(with1000.discount).toBe(1000);
    expect(with1000.netInterest).toBe(9000);
    expect(with1000.total).toBe(49000);
  });

  it('supports custom agreed interest amount', () => {
    const custom = calculateEarlySettlement(40000, 25, '2026-01-01', '2026-04-01', 'custom', 0, 1500);
    expect(custom.calculatedInterest).toBe(1500);
    expect(custom.netInterest).toBe(1500);
    expect(custom.total).toBe(41500);
  });

  it('calculates renew interest with discount or underpayment', () => {
    // 10,000 interest with 500 discount = 9,500 net
    const res500 = calculateRenewWithDiscount(40000, 25, 500);
    expect(res500.yearlyInterest).toBe(10000);
    expect(res500.discount).toBe(500);
    expect(res500.netInterest).toBe(9500);

    // Custom agreed underpayment: 8,000
    const custom = calculateRenewWithDiscount(40000, 25, 0, 8000);
    expect(custom.netInterest).toBe(8000);
    expect(custom.discount).toBe(2000);
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
