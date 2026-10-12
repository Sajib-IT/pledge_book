// src/lib/stampScanner.ts
// AI-powered Bengali Stamp Deed (বন্ধকনামা) OCR and Auto-Fill parser using Google Gemini Vision

export interface StampExtractedData {
  customer_name: string;
  father_name?: string | null;
  village?: string | null;
  post_office?: string | null;
  thana?: string | null;
  district?: string | null;
  full_address?: string | null;
  phone?: string | null;
  nid_no?: string | null;
  principal_amount?: number | null;
  principal_amount_words?: string | null;
  interest_or_yearly_fee?: number | null;
  interest_rate_percent?: number | null;
  mortgage_date?: string | null; // YYYY-MM-DD
  collateral_type: 'land' | 'gold' | 'vehicle' | 'electronics' | 'other';
  collateral_description: string;
  items?: Array<{
    item_type: string;
    description: string;
    quantity_or_weight?: string;
  }>;
  lender_name?: string | null;
  notes?: string | null;
}

export function getStoredGeminiApiKey(): string {
  if (typeof localStorage !== 'undefined') {
    const fromStorage = localStorage.getItem('gemini_api_key');
    if (fromStorage && fromStorage.trim()) {
      return fromStorage.trim();
    }
  }
  const fromEnv = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }
  return '';
}

export function setStoredGeminiApiKey(key: string): void {
  if (typeof localStorage !== 'undefined') {
    if (key && key.trim()) {
      localStorage.setItem('gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }
}

/**
 * Clean data URL or raw base64 string
 */
function parseImageData(dataUrlOrBase64: string): { mimeType: string; base64: string } {
  if (dataUrlOrBase64.startsWith('data:')) {
    const matches = dataUrlOrBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      return {
        mimeType: matches[1] || 'image/jpeg',
        base64: matches[2],
      };
    }
  }
  return {
    mimeType: 'image/jpeg',
    base64: dataUrlOrBase64,
  };
}

/**
 * Scan a Bangladeshi Stamp Deed / Promissory Note (বন্ধকনামা) using Gemini Vision API
 */
export async function scanStampDocument(
  imageData: string,
  overrideApiKey?: string
): Promise<StampExtractedData> {
  const apiKey = (overrideApiKey !== undefined ? overrideApiKey : getStoredGeminiApiKey()).trim();

  if (!apiKey) {
    throw new Error(
      'Gemini API Key পাওয়া যায়নি। সেটিংস পেজে অথবা .env ফাইলে আপনার API Key যুক্ত করুন।'
    );
  }

  const { mimeType, base64 } = parseImageData(imageData);

  const promptText = `
You are an expert OCR and document analysis AI specializing in Bangladeshi mortgage deeds (বন্ধকনামা / নন-জুডিশিয়াল স্ট্যাম্প / অঙ্গীকারনামা).
Analyze this stamp deed image and extract structured data in JSON.

Important Context:
- "দাতা" (Dātā) is the BORROWER/CUSTOMER who is taking money and pledging property. Extract their name as "customer_name", father as "father_name", village, thana, district, and combine into "full_address".
- "গ্রহীতা" (Grohītā) is the LENDER/SHOP OWNER who gives the money.
- Look for principal loan amount ("আসল টাকা", "বিনিময়ে ... টাকা") as "principal_amount" in integer numbers (convert Bengali numerals ০-৯ to digits 0-9).
- Look for interest or annual return ("বাৎসরিক কর", "প্রতি বছর কর বাবদ", "সুদ", "মুনাফা") as "interest_or_yearly_fee".
- Calculate or detect "interest_rate_percent":
  * If yearly fee is stated (e.g. 3000 tk per year on 25000 tk principal), calculate annual percentage = (3000 / 25000) * 100 = 12.0.
  * If monthly interest is stated (e.g. ২% per month), convert to yearly percentage = 24.0.
- Detect "mortgage_date" in YYYY-MM-DD format from the deed date at bottom or top (convert Bangla dates e.g. ৭/৭/২০১৯ -> 2019-07-07, ০৪/০৪/২০১১ -> 2011-04-04). If only year/month is discernible, fill best estimate.
- Detect "collateral_type":
  * "land" if property is জমি, ভিটা, বাগান, কাঠা, শতাংশ, বিঘা
  * "gold" if property is স্বর্ণ, সোনা, গহনা, ভরি, আনা, রতি
  * "vehicle" if motorcycle, auto, car, tractor
  * "electronics" if phone, laptop, TV
  * "other" for silver, livestock, or other items
- Detect "collateral_description": Detailed description of what is pledged (e.g. "১০ কাঠা নিজ দখলকৃত জমি").
- Detect any mobile phone number ("phone") or NID ("nid_no") if written.

Return ONLY a JSON object with this exact structure:
{
  "customer_name": "দাতার নাম",
  "father_name": "দাতার পিতার নাম",
  "village": "দাতার গ্রাম",
  "post_office": "ডাকঘর",
  "thana": "থানা",
  "district": "জেলা",
  "full_address": "গ্রাম, ডাকঘর, থানা, জেলা সহ পূর্ণ ঠিকানা",
  "phone": "মোবাইল নম্বর বা null",
  "nid_no": "জাতীয় পরিচয়পত্র বা null",
  "principal_amount": 25000,
  "principal_amount_words": "টাকার পরিমাণ কথায়",
  "interest_or_yearly_fee": 3000,
  "interest_rate_percent": 12.0,
  "mortgage_date": "2019-07-07",
  "collateral_type": "land",
  "collateral_description": "১০ কাঠা নিজ দখলকৃত জমি",
  "items": [
    {
      "item_type": "Land",
      "description": "নিজ দখলকৃত জমি",
      "quantity_or_weight": "১০ কাঠা"
    }
  ],
  "lender_name": "গ্রহীতার নাম",
  "notes": "শর্তাবলী ও অন্যান্য বিবরণ"
}
Output strictly valid JSON. Do not include markdown code fences or explanatory text.
`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
    },
  };

  // Try modern models with automatic failover if one model experiences high demand (503/429)
  const modelsToTry = [
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
  ];

  let lastError: Error | null = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const modelName = modelsToTry[i];
    const isLastModel = i === modelsToTry.length - 1;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || response.statusText;

        // If 503 (High demand), 429 (Rate limit), 404, or 500+, automatically try next model!
        if (
          !isLastModel &&
          (response.status === 503 ||
            response.status === 429 ||
            response.status === 404 ||
            response.status >= 500)
        ) {
          console.warn(
            `Model ${modelName} returned HTTP ${response.status} (${errMsg}). Falling back to next model...`
          );
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }

        if (response.status === 503) {
          throw new Error(
            'Google AI সার্ভারে এই মুহূর্তে সাময়িক উচ্চ চাপ (503 High Demand) রয়েছে। অনুগ্রহ করে ৫-১০ সেকেন্ড পর আবার স্ক্যান করুন।'
          );
        }

        throw new Error(`Google AI API Error (${response.status}): ${errMsg}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        if (!isLastModel) {
          continue;
        }
        throw new Error('AI থেকে কোনো তথ্য পাওয়া যায়নি। অনুগ্রহ করে স্পষ্ট ছবি তুলুন।');
      }

      // Clean markdown code blocks if returned
      let cleanedJsonText = rawText.trim();
      if (cleanedJsonText.startsWith('```json')) {
        cleanedJsonText = cleanedJsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedJsonText.startsWith('```')) {
        cleanedJsonText = cleanedJsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanedJsonText.trim());

      // Validate and sanitize parsed values
      const collateralType = (['gold', 'land', 'vehicle', 'electronics', 'other'].includes(
        parsed.collateral_type
      )
        ? parsed.collateral_type
        : 'other') as 'land' | 'gold' | 'vehicle' | 'electronics' | 'other';

      return {
        customer_name: parsed.customer_name || 'অজ্ঞাত দাতা',
        father_name: parsed.father_name || null,
        village: parsed.village || null,
        post_office: parsed.post_office || null,
        thana: parsed.thana || null,
        district: parsed.district || null,
        full_address:
          parsed.full_address ||
          [
            parsed.father_name ? `পিতা: ${parsed.father_name}` : '',
            parsed.village ? `গ্রাম: ${parsed.village}` : '',
            parsed.post_office ? `ডাকঘর: ${parsed.post_office}` : '',
            parsed.thana ? `থানা: ${parsed.thana}` : '',
            parsed.district ? `জেলা: ${parsed.district}` : '',
          ]
            .filter(Boolean)
            .join(', '),
        phone: parsed.phone ? String(parsed.phone).replace(/\s+/g, '') : null,
        nid_no: parsed.nid_no ? String(parsed.nid_no) : null,
        principal_amount: typeof parsed.principal_amount === 'number' ? parsed.principal_amount : null,
        principal_amount_words: parsed.principal_amount_words || null,
        interest_or_yearly_fee:
          typeof parsed.interest_or_yearly_fee === 'number' ? parsed.interest_or_yearly_fee : null,
        interest_rate_percent:
          typeof parsed.interest_rate_percent === 'number' ? parsed.interest_rate_percent : null,
        mortgage_date: parsed.mortgage_date || null,
        collateral_type: collateralType,
        collateral_description:
          parsed.collateral_description ||
          (collateralType === 'land' ? 'জমি বন্ধক' : 'জামানত মালামাল'),
        items: parsed.items || [],
        lender_name: parsed.lender_name || null,
        notes: parsed.notes || null,
      };
    } catch (err: any) {
      lastError = err;
      if (!isLastModel) {
        console.warn(
          `Attempt with ${modelName} encountered error: ${err.message}. Trying next fallback model...`
        );
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('স্ট্যাম্প বিশ্লেষণ করতে সমস্যা হয়েছে।');
}
