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
  calculateTermDuration,
  calculateTermInterest,
  convertMonthlyToYearlyRate,
  convertYearlyToMonthlyRate,
  isMortgageOverdue,
  getDaysUntilDue,
  formatBDT,
  toBanglaDigits,
  formatDateDhaka,
  formatDateToDMY,
  parseDMYToISO,
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

  it('prevents string concatenation bug for total settlement (20,000 + 5,000 = 25,000 not 200005000)', () => {
    // Tests 20,000 BDT at 25% interest rate
    const resNum = calculateCloseAmount(20000, 25);
    expect(resNum.principal).toBe(20000);
    expect(resNum.interest).toBe(5000);
    expect(resNum.total).toBe(25000);
    expect(formatBDT(resNum.total, 'en')).toBe('৳ 25,000');

    // Also tests string input from HTML form inputs
    const resStr = calculateCloseAmount('20000' as any, '25' as any);
    expect(resStr.principal).toBe(20000);
    expect(resStr.interest).toBe(5000);
    expect(resStr.total).toBe(25000);
    expect(formatBDT(resStr.total, 'en')).toBe('৳ 25,000');
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

describe('Distinct Customer Mortgage Terms and Calculations', () => {
  it('converts between monthly and yearly interest rates', () => {
    // 2% monthly = 24% yearly
    expect(convertMonthlyToYearlyRate(2)).toBe(24);
    // 2.5% monthly = 30% yearly
    expect(convertMonthlyToYearlyRate(2.5)).toBe(30);
    // 24% yearly = 2% monthly
    expect(convertYearlyToMonthlyRate(24)).toBe(2);
    // 30% yearly = 2.5% monthly
    expect(convertYearlyToMonthlyRate(30)).toBe(2.5);
  });

  it('calculates term duration for various mortgage horizons', () => {
    // 1 Month (~30 days)
    const term1m = calculateTermDuration('2026-01-01', '2026-02-01');
    expect(term1m.months).toBe(1);

    // 3 Months (~90 days)
    const term3m = calculateTermDuration('2026-01-01', '2026-04-01');
    expect(term3m.months).toBe(3);
    expect(term3m.days).toBe(90);

    // 6 Months (~181 days)
    const term6m = calculateTermDuration('2026-01-01', '2026-07-01');
    expect(term6m.months).toBe(6);

    // 1 Year (365 days)
    const term1y = calculateTermDuration('2026-01-01', '2027-01-01');
    expect(term1y.days).toBe(365);
    expect(term1y.termLabelEn).toContain('1 Year');
  });

  it('calculates distinct term interest for 3-month loan: 50,000 principal at 24% yearly (2% monthly)', () => {
    // 50,000 * 24% = 12,000/year => 1,000/month => 3 months (90 days) = 50,000 * 0.24 * 90 / 365 = 2959 BDT
    const res = calculateTermInterest(50000, 24, '2026-01-01', '2026-04-01');
    expect(res.principal).toBe(50000);
    expect(res.monthlyInterestRate).toBe(2);
    expect(res.monthlyInterest).toBe(1000); // 1,000 BDT per month
    expect(res.termInterest).toBe(2959); // ~3,000 BDT
    expect(res.totalMaturity).toBe(52959);
  });

  it('calculates distinct term interest for 1-year loan', () => {
    const res = calculateTermInterest(50000, 25, '2026-01-01', '2027-01-01');
    expect(res.termInterest).toBe(12500);
    expect(res.totalMaturity).toBe(62500);
  });
});

describe('Date Formatting Logic (Single format: date/month/year)', () => {
  const sampleDate = '2026-10-12';

  it('formats dates strictly as date/month/year (12/10/2026 for en, ১২/১০/২০২৬ for bn)', () => {
    const enFormatted = formatDateDhaka(sampleDate, 'en');
    expect(enFormatted).toBe('12/10/2026');

    const bnFormatted = formatDateDhaka(sampleDate, 'bn');
    expect(bnFormatted).toBe('১২/১০/২০২৬');
  });

  it('converts ISO YYYY-MM-DD to DD/MM/YYYY via formatDateToDMY', () => {
    expect(formatDateToDMY('2026-10-12')).toBe('12/10/2026');
    expect(formatDateToDMY('2024-05-01')).toBe('01/05/2024');
  });

  it('parses DD/MM/YYYY, DD-MM-YYYY, and Bangla digits to ISO YYYY-MM-DD via parseDMYToISO', () => {
    expect(parseDMYToISO('12/10/2026')).toBe('2026-10-12');
    expect(parseDMYToISO('১২/১০/২০২৬')).toBe('2026-10-12');
    expect(parseDMYToISO('05-04-2025')).toBe('2025-04-05');
    expect(parseDMYToISO('5/4/2025')).toBe('2025-04-05');
    expect(parseDMYToISO('invalid')).toBeNull();
  });
});


