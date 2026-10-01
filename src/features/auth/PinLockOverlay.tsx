// src/features/auth/PinLockOverlay.tsx
import React, { useState } from 'react';
import { useAppLock } from './AppLockContext';
import { Lock, Delete, BookOpen } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

export const PinLockOverlay: React.FC = () => {
  const { isLocked, unlockWithPin } = useAppLock();
  const { t } = useI18n();
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  if (!isLocked) return null;

  const handleKeyPress = async (num: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + num;
    setPin(newPin);
    setError(false);

    if (newPin.length === 4) {
      const success = await unlockWithPin(newPin);
      if (!success) {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 600);
      } else {
        setPin('');
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-between p-6 select-none safe-top safe-bottom">
      {/* Brand Header */}
      <div className="text-center pt-8">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-3">
          <BookOpen className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-white tracking-tight">
          {t('app_name')}
        </h2>
        <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold mt-1">
          <Lock className="w-3.5 h-3.5" />
          <span>নিরাপত্তা লক: ৪ ডিজিটের পিন দিন</span>
        </div>
      </div>

      {/* 4-Dot Indicator */}
      <div className={`flex items-center justify-center gap-4 my-8 ${error ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((index) => {
          const filled = pin.length > index;
          return (
            <div
              key={index}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                filled
                  ? 'bg-emerald-500 scale-110 shadow-md shadow-emerald-500/50'
                  : 'bg-slate-700 border-2 border-slate-600'
              } ${error ? '!bg-rose-500' : ''}`}
            />
          );
        })}
      </div>

      {error && (
        <p className="text-xs font-bold text-rose-400 text-center -mt-4 mb-4 animate-bounce">
          ভুল পিন নম্বর! আবার চেষ্টা করুন।
        </p>
      )}

      {/* Numeric Keypad */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-4 pb-8">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleKeyPress(digit)}
            className="h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-600 text-white text-2xl font-bold font-mono transition-all flex items-center justify-center border border-slate-700/50 shadow-sm active:scale-95"
          >
            {digit}
          </button>
        ))}

        <div />

        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          className="h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-600 text-white text-2xl font-bold font-mono transition-all flex items-center justify-center border border-slate-700/50 shadow-sm active:scale-95"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="h-16 rounded-2xl bg-slate-800/40 hover:bg-slate-700/50 active:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-slate-700/30 active:scale-95"
          title="মুছুন"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
