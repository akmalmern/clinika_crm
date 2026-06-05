import { randomInt } from 'node:crypto';

// Chalkashtirmaslik uchun o'xshash belgilar (0/O, 1/l/I) chiqarib tashlangan.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%*?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

/**
 * Kriptografik jihatdan xavfsiz tasodifiy parol generatsiya qiladi.
 * Har bir toifadan kamida bittadan belgi kafolatlanadi (kuchli parol siyosati).
 * Klinika admini birinchi marta yaratilganda ishlatiladi.
 */
export function generatePassword(length = 16): string {
  if (length < 8) length = 8;

  const chars: string[] = [
    UPPER[randomInt(UPPER.length)],
    LOWER[randomInt(LOWER.length)],
    DIGITS[randomInt(DIGITS.length)],
    SYMBOLS[randomInt(SYMBOLS.length)],
  ];

  for (let i = chars.length; i < length; i++) {
    chars.push(ALL[randomInt(ALL.length)]);
  }

  // Fisher–Yates aralashtirish (kafolatlangan belgilar boshda turmasin).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/**
 * Nomdan URL-do'st slug yasaydi (lotin harf/raqam + tire).
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
