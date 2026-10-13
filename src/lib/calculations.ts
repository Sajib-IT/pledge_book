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
 * Determines the start date for the current active interest calculation cycle.
 * For historical mortgages (e.g. started in 2017) where prior interest was settled offline
 * or renewed annually, the active billing cycle starts from the last interest payment/settlement date.
 */
export function getMortgageCycleStartDate(
  startDateStr: string,
  dueDateStr: string,
  lastInterestPaidOn?: string | null
): string {
  if (lastInterestPaidOn && lastInterestPaidOn.trim()) {
    return lastInterestPaidOn.trim();
  }
  if (!startDateStr || !dueDateStr) return startDateStr || '';

  const start = new Date(startDateStr + 'T00:00:00+06:00');
  const due = new Date(dueDateStr + 'T00:00:00+06:00');
  const diffDays = Math.round((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 370) {
    const parts = dueDateStr.split('-');
    if (parts.length === 3) {
      const prevYear = Number(parts[0]) - 1;
      let month = parts[1];
      let day = parts[2];
      if (month === '02' && day === '29' && prevYear % 4 !== 0) {
        day = '28';
      }
      return `${prevYear}-${month}-${day}`;
    }
  }
  return startDateStr;
}

/**
 * Calculates yearly flat interest amount in BDT.
 * Rate is percentage (e.g. 25 for 25%).
 * Formula: round((principal * interestRate) / 100)
 * All monetary amounts are integers (no floating cents).
 */
export function calculateYearlyInterest(principal: number, interestRate: number): number {
  const numPrincipal = Number(principal) || 0;
  const numRate = Number(interestRate) || 0;
  if (numPrincipal <= 0 || numRate < 0) return 0;
  return Math.round((numPrincipal * numRate) / 100);
}

/**
 * At the end of the 1-year term, customer RENEWS by paying only the interest.
 * Principal remains unchanged, due_date is extended by 1 year.
 */
export function calculateRenewAmount(principal: number, interestRate: number): number {
  return calculateYearlyInterest(Number(principal) || 0, Number(interestRate) || 0);
}

/**
 * Standard 1-year term mortgage closure (principal + full yearly interest).
 */
export function calculateCloseAmount(
  principal: number,
  interestRate: number
): { principal: number; interest: number; total: number } {
  const numPrincipal = Number(principal) || 0;
  const numRate = Number(interestRate) || 0;
  const interest = calculateYearlyInterest(numPrincipal, numRate);
  return {
    principal: numPrincipal,
    interest,
    total: numPrincipal + interest,
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
  const numPrincipal = Number(principal) || 0;
  const numRate = Number(interestRate) || 0;
  const yearlyInterest = calculateYearlyInterest(numPrincipal, numRate);
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
    calculatedInterest = Math.max(0, Math.round(Number(customInterestAmount) || 0));
  } else {
    calculatedInterest = yearlyInterest;
  }

  const safeDiscount = Math.max(0, Math.round(Number(discount) || 0));
  const effectiveDiscount = Math.min(calculatedInterest, safeDiscount);
  const netInterest = Math.max(0, calculatedInterest - effectiveDiscount);
  const total = numPrincipal + netInterest;

  return {
    principal: numPrincipal,
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
  const numPrincipal = Number(principal) || 0;
  const numRate = Number(interestRate) || 0;
  const yearlyInterest = calculateYearlyInterest(numPrincipal, numRate);

  if (customInterestAmount !== undefined && customInterestAmount !== null) {
    const custom = Math.max(0, Math.round(Number(customInterestAmount)));
    return {
      yearlyInterest,
      discount: Math.max(0, yearlyInterest - custom),
      netInterest: custom,
    };
  }

  const safeDiscount = Math.max(0, Math.round(Number(discount) || 0));
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
 * Converts Bangla digits (০-৯) to standard English digits (0-9).
 */
export function toEnglishDigits(val: string | number): string {
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let str = String(val ?? '');
  banglaDigits.forEach((digit, idx) => {
    str = str.replaceAll(digit, String(idx));
  });
  return str;
}

/**
 * Parses numeric string from either English or Bangla digits, ignoring commas.
 */
export function parseBanglaOrEnglishNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  const englishStr = toEnglishDigits(val).replace(/,/g, '').trim();
  const num = parseFloat(englishStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Formats an integer amount into BDT (Taka) format.
 * E.g., 40000 -> ৳ ৪০,০০০ (bn) or ৳ 40,000 (en)
 */
export function formatBDT(amount: number | string, locale: 'bn' | 'en' = 'bn'): string {
  const num = typeof amount === 'number' ? (isNaN(amount) ? 0 : amount) : (Number(amount) || 0);
  const isNegative = num < 0;
  const absAmount = Math.abs(Math.round(num));

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

export type DateDisplayFormat = 'slash'; // Standard single format: date/month/year (DD/MM/YYYY)

/**
 * Format date string into human friendly format in Asia/Dhaka.
 * Strictly uses date/month/year (DD/MM/YYYY) across the entire application:
 * - English: 12/10/2026
 * - Bengali: ১২/১০/২০২৬
 */
export function formatDateDhaka(
  dateStr: string | null | undefined,
  locale: 'bn' | 'en' = 'bn',
  _preferredFormat?: string
): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00+06:00`);
    if (isNaN(date.getTime())) return dateStr;

    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    };

    return new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-GB', options).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Formats an ISO string (YYYY-MM-DD) directly into DD/MM/YYYY.
 */
export function formatDateToDMY(isoDateStr: string | null | undefined): string {
  if (!isoDateStr) return '';
  const clean = isoDateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return isoDateStr;
}

/**
 * Parses user input in DD/MM/YYYY (or DD-MM-YYYY / Bangla digits) into standard ISO YYYY-MM-DD.
 */
export function parseDMYToISO(dmyStr: string | null | undefined): string | null {
  if (!dmyStr) return null;
  const cleaned = toEnglishDigits(dmyStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  const parts = cleaned.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const dStr = String(day).padStart(2, '0');
  const mStr = String(month).padStart(2, '0');
  const yStr = String(year).padStart(4, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Calculates mortgage duration between start and due date.
 */
export function calculateTermDuration(
  startDateStr: string,
  dueDateStr: string
): { days: number; months: number; termLabelBn: string; termLabelEn: string } {
  if (!startDateStr || !dueDateStr) {
    return { days: 365, months: 12, termLabelBn: '১ বছর (৩৬৫ দিন)', termLabelEn: '1 Year (365 days)' };
  }
  const start = new Date(startDateStr + 'T00:00:00+06:00');
  const due = new Date(dueDateStr + 'T00:00:00+06:00');
  const diffMs = due.getTime() - start.getTime();
  const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  const months = Math.max(1, Math.round(days / 30.4375));

  let termLabelBn = '';
  let termLabelEn = '';

  if (days >= 355 && days <= 375) {
    termLabelBn = '১ বছর (৩৬৫ দিন)';
    termLabelEn = '1 Year (365 days)';
  } else if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    termLabelBn = `${toBanglaDigits(years)} বছর (${toBanglaDigits(days)} দিন)`;
    termLabelEn = `${years} Year${years > 1 ? 's' : ''} (${days} days)`;
  } else if (days < 28) {
    termLabelBn = `${toBanglaDigits(days)} দিন`;
    termLabelEn = `${days} Days`;
  } else {
    termLabelBn = `${toBanglaDigits(months)} মাস (${toBanglaDigits(days)} দিন)`;
    termLabelEn = `${months} Month${months > 1 ? 's' : ''} (${days} days)`;
  }

  return { days, months, termLabelBn, termLabelEn };
}

/**
 * Converts monthly rate to annualized rate (e.g. 2% monthly -> 24% yearly).
 */
export function convertMonthlyToYearlyRate(monthlyRate: number): number {
  return Number((Math.max(0, Number(monthlyRate) || 0) * 12).toFixed(2));
}

/**
 * Converts yearly rate to monthly rate (e.g. 24% yearly -> 2% monthly).
 */
export function convertYearlyToMonthlyRate(yearlyRate: number): number {
  return Number((Math.max(0, Number(yearlyRate) || 0) / 12).toFixed(2));
}

export interface TermCalculationResult {
  principal: number;
  yearlyInterestRate: number;
  monthlyInterestRate: number;
  days: number;
  months: number;
  monthlyInterest: number;
  termInterest: number;
  totalMaturity: number;
}

/**
 * Calculates distinct per-customer mortgage calculation based on specific mortgage terms.
 * Supports pro-rata term calculation or exact duration.
 */
export function calculateTermInterest(
  principal: number,
  yearlyInterestRate: number,
  startDateStr: string,
  dueDateStr: string
): TermCalculationResult {
  const numPrincipal = Number(principal) || 0;
  const numYearlyRate = Number(yearlyInterestRate) || 0;
  if (numPrincipal <= 0 || numYearlyRate <= 0) {
    return {
      principal: numPrincipal,
      yearlyInterestRate: numYearlyRate,
      monthlyInterestRate: convertYearlyToMonthlyRate(numYearlyRate),
      days: 0,
      months: 0,
      monthlyInterest: 0,
      termInterest: 0,
      totalMaturity: numPrincipal,
    };
  }

  const { days, months } = calculateTermDuration(startDateStr, dueDateStr);
  const monthlyInterestRate = convertYearlyToMonthlyRate(numYearlyRate);

  // Monthly interest amount: (principal * yearlyRate) / 100 / 12
  const monthlyInterest = Math.round((numPrincipal * numYearlyRate) / 1200);

  // Exact term interest based on duration:
  let termInterest: number;
  if (days >= 355 && days <= 375) {
    termInterest = calculateYearlyInterest(numPrincipal, numYearlyRate);
  } else {
    // Pro-rata based on elapsed term days (day-based precision: 365 days)
    termInterest = Math.round((numPrincipal * (numYearlyRate / 100) * days) / 365);
  }

  const totalMaturity = numPrincipal + termInterest;

  return {
    principal: numPrincipal,
    yearlyInterestRate: numYearlyRate,
    monthlyInterestRate,
    days,
    months,
    monthlyInterest,
    termInterest,
    totalMaturity,
  };
}

