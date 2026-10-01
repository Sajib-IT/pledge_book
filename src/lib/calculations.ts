// src/lib/calculations.ts
// Precision-safe financial math and business rules for Mortgage Management in BDT

import type { MortgageStatus } from '../types/database';

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
 * At the end of the 1-year term, customer CLOSES by paying principal + interest.
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
  // Last 3 digits grouped, then groups of 2 digits
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
