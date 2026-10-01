// src/lib/imageCompressor.test.ts
import { describe, it, expect } from 'vitest';
import { getBase64SizeInBytes, formatBytes } from './imageCompressor';

describe('Image Compressor Utilities', () => {
  it('correctly calculates base64 byte size', () => {
    // 4 base64 characters = 3 bytes
    const sampleDataUrl = 'data:image/jpeg;base64,AAAA';
    expect(getBase64SizeInBytes(sampleDataUrl)).toBe(3);

    // Padding test
    const sampleWithPadding = 'data:image/jpeg;base64,AA==';
    expect(getBase64SizeInBytes(sampleWithPadding)).toBe(1);

    expect(getBase64SizeInBytes('')).toBe(0);
    expect(getBase64SizeInBytes('invalid_string')).toBe(0);
  });

  it('formats byte sizes into readable units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(50 * 1024)).toBe('50 KB');
    expect(formatBytes(85.4 * 1024)).toBe('85.4 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  it('handles simulated large photo string calculation', () => {
    // A 100,000 character base64 string ~ 75 KB
    const simulatedBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(100000);
    const size = getBase64SizeInBytes(simulatedBase64);
    expect(size).toBe(75000);
    expect(formatBytes(size)).toBe('73.2 KB');
  });
});
