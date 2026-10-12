import React, { useState, useRef, useEffect, useId } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useI18n } from '../../lib/i18n';
import {
  formatDateToDMY,
  parseDMYToISO,
  toBanglaDigits,
  getTodayDhakaDateString,
} from '../../lib/calculations';

export interface DatePickerProps {
  id?: string;
  name?: string;
  label?: string;
  value?: string; // ISO date string: YYYY-MM-DD
  defaultValue?: string; // ISO date string: YYYY-MM-DD
  onChange?: (dateIso: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
}

const MONTHS_BN = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DatePicker: React.FC<DatePickerProps> = ({
  id,
  name,
  label,
  value,
  defaultValue,
  onChange,
  onBlur,
  error,
  helperText,
  placeholder,
  disabled,
  required,
  className,
  min,
  max,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const { language } = useI18n();

  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Controlled or uncontrolled internal ISO state
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string>(
    value || defaultValue || ''
  );
  const activeValue = isControlled ? value || '' : internalValue;

  // Text displayed in input: strictly DD/MM/YYYY
  const [displayText, setDisplayText] = useState<string>(() =>
    formatDateToDMY(activeValue)
  );
  const [isEditingText, setIsEditingText] = useState(false);

  // Calendar popover state
  const [isOpen, setIsOpen] = useState(false);

  // Year & Month being viewed in the calendar popover
  const initialDate = activeValue ? new Date(activeValue + 'T12:00:00+06:00') : new Date();
  const [viewYear, setViewYear] = useState<number>(() => initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => initialDate.getMonth());

  // Sync displayText when controlled value changes and user is not actively typing
  useEffect(() => {
    if (!isEditingText) {
      setDisplayText(formatDateToDMY(activeValue));
    }
  }, [activeValue, isEditingText]);

  // Sync viewYear and viewMonth when activeValue changes and calendar opens
  useEffect(() => {
    if (activeValue) {
      const d = new Date(activeValue + 'T12:00:00+06:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [activeValue]);

  // Close calendar popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const emitChange = (newIso: string) => {
    if (!isControlled) {
      setInternalValue(newIso);
    }
    setDisplayText(formatDateToDMY(newIso));
    setIsEditingText(false);
    onChange?.(newIso);
  };

  // Handle typed input (user enters DD/MM/YYYY or DD-MM-YYYY)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setIsEditingText(true);
    setDisplayText(val);

    const parsedIso = parseDMYToISO(val);
    if (parsedIso) {
      if (!isControlled) {
        setInternalValue(parsedIso);
      }
      onChange?.(parsedIso);
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditingText(false);
    const parsedIso = parseDMYToISO(displayText);
    if (parsedIso) {
      emitChange(parsedIso);
    } else if (displayText.trim() === '') {
      emitChange('');
    } else {
      // Revert to valid active date
      setDisplayText(formatDateToDMY(activeValue));
    }
    onBlur?.(e);
  };

  // Calendar calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const todayStr = getTodayDhakaDateString();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const iso = `${viewYear}-${mStr}-${dStr}`;
    emitChange(iso);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    emitChange(todayStr);
    const d = new Date(todayStr + 'T12:00:00+06:00');
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setIsOpen(false);
  };

  // Generate Year options: 1970 to CurrentYear + 15
  const currentYear = new Date().getFullYear();
  const yearOptions: number[] = [];
  for (let y = currentYear + 10; y >= 1970; y--) {
    yearOptions.push(y);
  }

  const defaultPlaceholder = language === 'bn' ? 'দিন/মাস/বছর (DD/MM/YYYY)' : 'DD/MM/YYYY';

  return (
    <div ref={containerRef} className="w-full space-y-1.5 relative">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          ref={textInputRef}
          id={inputId}
          name={name}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          required={required}
          value={displayText}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => {
            // Optional: can keep closed or open on click
          }}
          placeholder={placeholder || defaultPlaceholder}
          className={cn(
            'flex h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 pr-11 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-50',
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
            className
          )}
        />

        {/* Calendar Picker Trigger Button */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute right-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors focus:outline-none"
          title={language === 'bn' ? 'তারিখ নির্বাচন করুন' : 'Pick date'}
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Helper text or error message */}
      {error ? (
        <p className="text-xs text-rose-500 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 mt-1">{helperText}</p>
      ) : null}

      {/* Interactive Calendar Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-full min-w-[290px] max-w-[340px] rounded-2xl bg-white p-3.5 shadow-2xl border border-slate-200 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
          {/* Header Controls: Month, Year, Arrows */}
          <div className="flex items-center justify-between gap-1.5 pb-3 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title={language === 'bn' ? 'পূর্ববর্তী মাস' : 'Previous month'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month Dropdown */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
              >
                {(language === 'bn' ? MONTHS_BN : MONTHS_EN).map((mName, idx) => (
                  <option key={idx} value={idx}>
                    {mName}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {language === 'bn' ? toBanglaDigits(y) : y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title={language === 'bn' ? 'পরবর্তী মাস' : 'Next month'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center py-2 text-[11px] font-bold text-slate-400">
            {(language === 'bn' ? WEEKDAYS_BN : WEEKDAYS_EN).map((dayName, idx) => (
              <div key={idx}>{dayName}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank offset days */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-8" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const mStr = String(viewMonth + 1).padStart(2, '0');
              const dStr = String(day).padStart(2, '0');
              const cellIso = `${viewYear}-${mStr}-${dStr}`;

              const isSelected = activeValue === cellIso;
              const isToday = todayStr === cellIso;

              const isDayDisabled = Boolean(
                (min && cellIso < min) || (max && cellIso > max)
              );

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDayDisabled}
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    'h-8 w-full rounded-xl text-xs font-semibold flex items-center justify-center transition-all',
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : isToday
                      ? 'border border-emerald-500 text-emerald-800 font-bold bg-emerald-50/50 hover:bg-emerald-100'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                    isDayDisabled && 'opacity-25 cursor-not-allowed hover:bg-transparent'
                  )}
                >
                  {language === 'bn' ? toBanglaDigits(day) : day}
                </button>
              );
            })}
          </div>

          {/* Popover Footer: Quick Today & Format Tag */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-50"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'bn' ? 'আজকের দিন' : 'Today'}</span>
            </button>

            <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
              {language === 'bn' ? 'দিন/মাস/বছর' : 'DD/MM/YYYY'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
