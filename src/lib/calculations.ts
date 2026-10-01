// src/lib/calculations.ts
// Precision-safe financial math and business rules for Mortgage Management in BDT

import type { MortgageStatus } from '../types/database';

export type InterestCalculationMode = 'full_year' | 'monthly' | 'daily' | 'custom';

export interface EarlyRepaymentCalculation {
  principal: number;
  yearlyInterest: number;
  mode: InterestCalculationMode;
  daysElapsed: number;
  monthsElapsed: number;
  isEarly: boolean;
  calculatedInterest: number;
  discount: number;
  netInterest: number;
  total: number;
}

/**
 * Calculates yearly flat interest amount in BDT.
 * Rate is percentage (e.g. 25 for 25%).
 * Formula: round((principal * interestRate) / 100)
 * All monetary amounts are integers (no floating cents).
 */
export function calculateYearlyInterest(principal: number, interestRate: number): number {
  if (principal <= 0 || interestRate < 0) return 0;
  return Math.round((principal * interestRate) / 100);
}

/**
 * At the end of the 1-year term, customer RENEWS by paying only the interest.
 * Principal remains unchanged, due_date is extended by 1 year.
 */
export function calculateRenewAmount(principal: number, interestRate: number): number {
  return calculateYearlyInterest(principal, interestRate);
}

/**
 * Standard 1-year term mortgage closure (principal + full yearly interest).
 */
export function calculateCloseAmount(
  principal: number,
  interestRate: number
): { principal: number; interest: number; total: number } {
  const interest = calculateYearlyInterest(principal, interestRate);
  return {
    principal,
    interest,
    total: principal + interest,
  };
}

/**
 * Calculates days and months elapsed between start date and payment date in Asia/Dhaka.
 */
export function calculateElapsedDuration(
  startDateStr: string,
  paymentDateStr?: string
): { daysElapsed: number; monthsElapsed: number; isEarly: boolean } {
  const payDate = paymentDateStr || getTodayDhakaDateString();
  const start = new Date(startDateStr + 'T00:00:00+06:00');
  const pay = new Date(payDate + 'T00:00:00+06:00');
  const diffMs = pay.getTime() - start.getTime();
  const daysElapsed = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  // Months elapsed (ceil: 1-30 days = 1 month, 31-60 = 2 months, as customary in Bangladesh pawn shops)
  const monthsElapsed = Math.max(1, Math.min(12, Math.ceil(daysElapsed / 30.4375)));
  const isEarly = daysElapsed < 360;

  return { daysElapsed, monthsElapsed, isEarly };
}

/**
 * Computes early repayment settlement breakdown with pro-rata options and discount.
 * Supports:
 * - full_year: full 1-year flat interest (default contract)
 * - monthly: pro-rated by elapsed months
 * - daily: pro-rated by exact elapsed days
 * - custom: owner negotiated custom interest
 * - discount: deduction/waiver (e.g. 500, 1000 BDT)
 */
export function calculateEarlySettlement(
  principal: number,
  interestRate: number,
  startDateStr: string,
  paymentDateStr?: string,
  mode: InterestCalculationMode = 'full_year',
  discount: number = 0,
  customInterestAmount?: number
): EarlyRepaymentCalculation {
  const yearlyInterest = calculateYearlyInterest(principal, interestRate);
  const { daysElapsed, monthsElapsed, isEarly } = calculateElapsedDuration(
    startDateStr,
    paymentDateStr
  );

  let calculatedInterest = yearlyInterest;

  if (mode === 'daily') {
    const effectiveDays = Math.min(365, daysElapsed);
    calculatedInterest = Math.round((yearlyInterest * effectiveDays) / 365);
  } else if (mode === 'monthly') {
    calculatedInterest = Math.round((yearlyInterest * monthsElapsed) / 12);
  } else if (mode === 'custom') {
    calculatedInterest = Math.max(0, Math.round(customInterestAmount || 0));
  } else {
    calculatedInterest = yearlyInterest;
  }

  const safeDiscount = Math.max(0, Math.round(discount || 0));
  const effectiveDiscount = Math.min(calculatedInterest, safeDiscount);
  const netInterest = Math.max(0, calculatedInterest - effectiveDiscount);
  const total = principal + netInterest;

  return {
    principal,
    yearlyInterest,
    mode,
    daysElapsed,
    monthsElapsed,
    isEarly,
    calculatedInterest,
    discount: effectiveDiscount,
    netInterest,
    total,
  };
}

/**
 * Computes renewal with discount / waiver / underpayment.
 */
export function calculateRenewWithDiscount(
  principal: number,
  interestRate: number,
  discount: number = 0,
  customInterestAmount?: number
): {
  yearlyInterest: number;
  discount: number;
  netInterest: number;
} {
  const yearlyInterest = calculateYearlyInterest(principal, interestRate);

  if (customInterestAmount !== undefined && customInterestAmount !== null && customInterestAmount >= 0) {
    const custom = Math.round(customInterestAmount);
    return {
      yearlyInterest,
      discount: Math.max(0, yearlyInterest - custom),
      netInterest: custom,
    };
  }

  const safeDiscount = Math.max(0, Math.round(discount || 0));
  const effectiveDiscount = Math.min(yearlyInterest, safeDiscount);
  const netInterest = Math.max(0, yearlyInterest - effectiveDiscount);

  return {
    yearlyInterest,
    discount: effectiveDiscount,
    netInterest,
  };
}

/**
 * Checks if a mortgage is overdue:
 * Overdue is computed: due_date < today AND status = 'active'.
 * Uses Asia/Dhaka day boundaries (YYYY-MM-DD string comparison).
 */
export function isMortgageOverdue(
  dueDateStr: string,
  status: MortgageStatus,
  referenceDateStr?: string
): boolean {
  if (status !== 'active') return false;
  const today = referenceDateStr || getTodayDhakaDateString();
  return dueDateStr < today;
}

/**
 * Computes remaining days until due date.
 * Positive = remaining days. Negative = overdue days. 0 = due today.
 */
export function getDaysUntilDue(dueDateStr: string, referenceDateStr?: string): number {
  const todayStr = referenceDateStr || getTodayDhakaDateString();
  const due = new Date(dueDateStr + 'T00:00:00+06:00');
  const today = new Date(todayStr + 'T00:00:00+06:00');
  const diffTime = due.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Dhaka timezone.
 */
export function getTodayDhakaDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Converts English digits (0-9) to Bangla digits (০-৯).
 */
export function toBanglaDigits(val: string | number): string {
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/[0-9]/g, (match) => banglaDigits[parseInt(match, 10)]);
}

/**
 * Formats an integer amount into BDT (Taka) format.
 * E.g., 40000 -> ৳ ৪০,০০০ (bn) or ৳ 40,000 (en)
 */
export function formatBDT(amount: number, locale: 'bn' | 'en' = 'bn'): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(Math.round(amount));

  // Indian/Bangladeshi numbering system format (lakh/crore):
  const str = absAmount.toString();
  let result = '';
  if (str.length > 3) {
    const lastThree = str.substring(str.length - 3);
    const rest = str.substring(0, str.length - 3);
    const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    result = withCommas + ',' + lastThree;
  } else {
    result = str;
  }

  if (locale === 'bn') {
    const bnNum = toBanglaDigits(result);
    return isNegative ? `-৳ ${bnNum}` : `৳ ${bnNum}`;
  }

  return isNegative ? `-৳ ${result}` : `৳ ${result}`;
}

/**
 * Format date string into human friendly format in Asia/Dhaka.
 */
export function formatDateDhaka(
  dateStr: string | null | undefined,
  locale: 'bn' | 'en' = 'bn'
): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00+06:00`);
    if (isNaN(date.getTime())) return dateStr;

    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };

    const formatted = new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-US', options).format(date);
    return formatted;
  } catch {
    return dateStr;
  }
}
