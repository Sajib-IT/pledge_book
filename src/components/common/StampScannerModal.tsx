// src/components/common/StampScannerModal.tsx
import React, { useState, useRef } from 'react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useI18n } from '../../lib/i18n';
import {
  Camera,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  User,
  Coins,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { captureFromCamera, pickFromGallery, readFileAsDataUrl } from '../../lib/media';
import { compressDocumentPhoto } from '../../lib/imageCompressor';
import {
  scanStampDocument,
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  type StampExtractedData,
} from '../../lib/stampScanner';
import { formatBDT, toBanglaDigits } from '../../lib/calculations';

interface StampScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (extractedData: StampExtractedData, originalPhotoDataUrl: string) => void;
}

export const StampScannerModal: React.FC<StampScannerModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const { language } = useI18n();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<StampExtractedData | null>(null);

  // Key input state if key is missing
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyPrompt, setShowKeyPrompt] = useState(!getStoredGeminiApiKey());

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const resetScanner = () => {
    setImagePreview(null);
    setIsScanning(false);
    setErrorMsg(null);
    setExtractedData(null);
  };

  const handleProcessImage = async (dataUrl: string) => {
    setImagePreview(dataUrl);
    setErrorMsg(null);
    setExtractedData(null);
    setIsScanning(true);

    try {
      // Compress document image client-side to ensure fast upload & avoid Google server congestion
      let imageToScan = dataUrl;
      try {
        imageToScan = await compressDocumentPhoto(dataUrl);
      } catch (compErr) {
        console.warn('Client-side compression fallback:', compErr);
      }

      const result = await scanStampDocument(imageToScan);
      setExtractedData(result);
    } catch (err: any) {
      console.error('Stamp scan failed:', err);
      const msg = err?.message || 'স্ট্যাম্প বিশ্লেষণ করতে সমস্যা হয়েছে।';
      setErrorMsg(msg);
      if (msg.includes('API Key')) {
        setShowKeyPrompt(true);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleCapturePhoto = async () => {
    try {
      const dataUrl = await captureFromCamera(85);
      if (dataUrl) {
        await handleProcessImage(dataUrl);
      } else {
        cameraInputRef.current?.click();
      }
    } catch {
      cameraInputRef.current?.click();
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const dataUrl = await pickFromGallery(85);
      if (dataUrl) {
        await handleProcessImage(dataUrl);
      } else {
        galleryInputRef.current?.click();
      }
    } catch {
      galleryInputRef.current?.click();
    }
  };

  const handleCameraFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await readFileAsDataUrl(file);
      await handleProcessImage(dataUrl);
      e.target.value = '';
    }
  };

  const handleGalleryFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await readFileAsDataUrl(file);
      await handleProcessImage(dataUrl);
      e.target.value = '';
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    setStoredGeminiApiKey(apiKeyInput.trim());
    setShowKeyPrompt(false);
    setErrorMsg(null);
    if (imagePreview) {
      handleProcessImage(imagePreview);
    }
  };

  const handleApply = () => {
    if (extractedData && imagePreview) {
      onApply(extractedData, imagePreview);
      onClose();
      resetScanner();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        onClose();
        resetScanner();
      }}
      title={language === 'bn' ? 'AI স্ট্যাম্প স্ক্যানার (স্বয়ংক্রিয় ফর্ম পূরণ)' : 'AI Stamp Deed Scanner (Auto-Fill)'}
      description={
        language === 'bn'
          ? 'স্ট্যাম্প বা বন্ধকনামার ছবি তুলুন — AI স্বয়ংক্রিয়ভাবে নাম, টাকা, তারিখ ও বিবরণ পড়বে'
          : 'Capture stamp deed photo — AI reads customer, amount, terms and auto-fills the form'
      }
      className="max-w-xl"
    >
      <div className="space-y-4 pt-2">
        {/* API Key prompt if missing */}
        {showKeyPrompt && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>{language === 'bn' ? 'Google Gemini API Key দিন' : 'Enter Gemini API Key'}</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              {language === 'bn'
                ? 'স্ট্যাম্প স্ক্যান করার জন্য Google AI Studio থেকে ফ্রি API Key প্রয়োজন।'
                : 'Free Gemini API Key from Google AI Studio is required for Bengali OCR.'}
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="AQ... বা AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="bg-white text-xs h-9"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSaveApiKey}
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 h-9 font-bold text-xs"
              >
                {language === 'bn' ? 'সংরক্ষণ করুন' : 'Save'}
              </Button>
            </div>
          </div>
        )}

        {/* Hidden inputs for desktop / fallback */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCameraFileInput}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGalleryFileInput}
        />

        {/* Phase 1: No image selected yet */}
        {!imagePreview && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 transition-all text-emerald-800 group active:scale-98 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Camera className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <span className="font-bold text-sm block text-emerald-950">
                    {language === 'bn' ? 'ক্যামেরা দিয়ে ছবি তুলুন' : 'Take Photo with Camera'}
                  </span>
                  <span className="text-[11px] text-emerald-700 mt-0.5 block">
                    {language === 'bn' ? 'সরাসরি স্ট্যাম্পের ছবি তুলুন' : 'Point camera directly at deed'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={handlePickFromGallery}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-all text-slate-700 group active:scale-98 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <span className="font-bold text-sm block text-slate-900">
                    {language === 'bn' ? 'গ্যালারি / ফাইল থেকে নিন' : 'Choose from Gallery'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {language === 'bn' ? 'পূর্বে তোলা ছবি সিলেক্ট করুন' : 'Select saved photo or document'}
                  </span>
                </div>
              </button>
            </div>

            {/* Helper Tips */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'bn' ? 'স্ক্যান টিপস:' : 'Scanning Tips:'}</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                <li>{language === 'bn' ? 'স্ট্যাম্পের পুরো পাতা সোজা করে ফ্রেমে রাখুন।' : 'Keep the full stamp page inside frame.'}</li>
                <li>{language === 'bn' ? 'হাতে লেখা স্পষ্ট হলে AI শতভাগ নিখুঁতভাবে নাম, টাকা ও তারিখ ধরতে পারে।' : 'Clear handwriting allows AI to detect name, cash & date accurately.'}</li>
                <li>{language === 'bn' ? 'ছবিটি স্বয়ংক্রিয়ভাবে বন্ধকের নথি হিসেবেও সেভ হয়ে যাবে।' : 'Photo will also be saved as mortgage collateral document.'}</li>
              </ul>
            </div>
          </div>
        )}

        {/* Phase 2: Image Selected - Scanning or Result */}
        {imagePreview && (
          <div className="space-y-4">
            {/* Image Preview & Scanning Status */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center max-h-56">
              <img
                src={imagePreview}
                alt="Stamp Preview"
                className={`max-h-56 w-full object-contain ${isScanning ? 'opacity-50 blur-[1px]' : ''}`}
              />

              {/* Scanning Laser / Pulse Overlay */}
              {isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 p-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-400 flex items-center justify-center mb-3 animate-spin">
                    <Loader2 className="w-6 h-6" />
                  </div>
                  <span className="text-white text-xs font-bold tracking-wide animate-pulse">
                    {language === 'bn'
                      ? '🤖 AI স্ট্যাম্প বিশ্লেষণ করছে...'
                      : '🤖 AI Analyzing Stamp Deed...'}
                  </span>
                  <span className="text-[11px] text-emerald-300 mt-1 max-w-xs">
                    {language === 'bn'
                      ? 'বাংলা হাতের লেখা, গ্রাহকের নাম, আসল টাকা ও শর্তাবলী বের করা হচ্ছে...'
                      : 'Reading handwritten Bengali text, principal amount, date & terms...'}
                  </span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && !isScanning && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">
                    {language === 'bn' ? 'স্ক্যান সম্পন্ন করা যায়নি' : 'Scanning failed'}
                  </span>
                  <span className="text-[11px] mt-0.5 block">{errorMsg}</span>
                </div>
              </div>
            )}

            {/* Success Extracted Data Summary */}
            {extractedData && !isScanning && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{language === 'bn' ? 'শনাক্তকৃত তথ্যের সারাংশ' : 'Extracted Information'}</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    AI সনাক্তকৃত
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Customer / Dātā */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-600" />
                      {language === 'bn' ? 'গ্রাহক (দাতা)' : 'Customer (Borrower)'}
                    </span>
                    <span className="font-bold text-slate-900 block text-xs">
                      {extractedData.customer_name}
                    </span>
                    {extractedData.father_name && (
                      <span className="text-[11px] text-slate-500 block">
                        পিতা: {extractedData.father_name}
                      </span>
                    )}
                  </div>

                  {/* Principal Amount */}
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200/80 space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                      <Coins className="w-3 h-3 text-emerald-600" />
                      {language === 'bn' ? 'আসল টাকা (Principal)' : 'Principal Loan'}
                    </span>
                    <span className="font-mono font-black text-emerald-900 block text-sm">
                      {extractedData.principal_amount
                        ? formatBDT(extractedData.principal_amount, language)
                        : 'উল্লেখ নেই'}
                    </span>
                    {extractedData.principal_amount_words && (
                      <span className="text-[10px] text-emerald-700 block">
                        কথায়: {extractedData.principal_amount_words}
                      </span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-600" />
                      {language === 'bn' ? 'বন্ধকের তারিখ' : 'Mortgage Date'}
                    </span>
                    <span className="font-bold text-slate-900 block text-xs">
                      {extractedData.mortgage_date || 'উল্লেখ নেই'}
                    </span>
                    {typeof extractedData.interest_rate_percent === 'number' && (
                      <span className="text-[10px] text-blue-700 font-medium block">
                        {language === 'bn'
                          ? `সুদ/কর: ${toBanglaDigits(extractedData.interest_rate_percent)}% বাৎসরিক`
                          : `Rate: ${extractedData.interest_rate_percent}% yearly`}
                      </span>
                    )}
                  </div>

                  {/* Collateral */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-600" />
                      {language === 'bn' ? 'জামানত মালামাল' : 'Collateral'}
                    </span>
                    <span className="font-bold text-slate-900 block text-xs capitalize">
                      {extractedData.collateral_type === 'land'
                        ? 'জমি (Land)'
                        : extractedData.collateral_type === 'gold'
                        ? 'স্বর্ণ (Gold)'
                        : extractedData.collateral_type}
                    </span>
                    <span className="text-[11px] text-slate-600 block line-clamp-1">
                      {extractedData.collateral_description}
                    </span>
                  </div>
                </div>

                {/* Address */}
                {extractedData.full_address && (
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700">
                    <span className="font-bold text-slate-500 mr-1">ঠিকানা:</span>
                    {extractedData.full_address}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetScanner}
                disabled={isScanning}
                className="w-full sm:w-auto text-xs font-bold gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'পুনরায় ছবি তুলুন' : 'Scan Another Photo'}</span>
              </Button>

              {extractedData && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApply}
                  className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-md shadow-emerald-700/20"
                >
                  <span>{language === 'bn' ? 'ফর্মে তথ্যগুলো বসান' : 'Apply Data to Form'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
