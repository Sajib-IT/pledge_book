// src/lib/stampScanner.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  scanStampDocument,
} from './stampScanner';

describe('Stamp Scanner Service', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key in store) delete store[key];
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const key in store) delete store[key];
      },
    });
    vi.restoreAllMocks();
  });

  it('stores and retrieves Gemini API key from localStorage', () => {
    expect(getStoredGeminiApiKey()).toBeDefined();

    setStoredGeminiApiKey('AIzaSyCustomKey123');
    expect(getStoredGeminiApiKey()).toBe('AIzaSyCustomKey123');

    setStoredGeminiApiKey('');
    // Falls back to empty or env
    expect(localStorage.getItem('gemini_api_key')).toBeNull();
  });

  it('throws a helpful error if no API key is provided and none in storage', async () => {
    setStoredGeminiApiKey('');
    await expect(scanStampDocument('data:image/jpeg;base64,AAAA', '')).rejects.toThrow(
      /Gemini API Key/
    );
  });

  it('successfully parses Gemini vision response and strips markdown code fences', async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: '```json\n{\n  "customer_name": "মুকুল আলী",\n  "father_name": "আজমত আলী",\n  "village": "হিন্দা",\n  "thana": "গাংনী",\n  "district": "মেহেরপুর",\n  "full_address": "গ্রাম: হিন্দা, থানা: গাংনী, জেলা: মেহেরপুর",\n  "phone": "01712345678",\n  "principal_amount": 25000,\n  "principal_amount_words": "পঁচিশ হাজার",\n  "interest_or_yearly_fee": 3000,\n  "interest_rate_percent": 12.0,\n  "mortgage_date": "2019-07-07",\n  "collateral_type": "land",\n  "collateral_description": "১০ কাঠা জমি"\n}\n```',
              },
            ],
          },
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as any)
    );

    const result = await scanStampDocument(
      'data:image/jpeg;base64,abc123xyz',
      'AIzaSyTestKey'
    );

    expect(result.customer_name).toBe('মুকুল আলী');
    expect(result.father_name).toBe('আজমত আলী');
    expect(result.principal_amount).toBe(25000);
    expect(result.interest_rate_percent).toBe(12.0);
    expect(result.mortgage_date).toBe('2019-07-07');
    expect(result.collateral_type).toBe('land');
    expect(result.collateral_description).toBe('১০ কাঠা জমি');
    expect(result.full_address).toContain('হিন্দা');
  });

  it('normalizes unknown collateral types to other', async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  customer_name: 'করিম',
                  collateral_type: 'unknown_spaceship_type',
                  collateral_description: 'বিশেষ কিছু',
                }),
              },
            ],
          },
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as any)
    );

    const result = await scanStampDocument(
      'data:image/jpeg;base64,abc123xyz',
      'AIzaSyTestKey'
    );

    expect(result.collateral_type).toBe('other');
  });

  it('throws friendly error on 401 unauthorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'API key not valid' } }),
      } as any)
    );

    await expect(
      scanStampDocument('data:image/jpeg;base64,abc123xyz', 'invalid-key')
    ).rejects.toThrow(/401 Unauthorized/);
  });
});
