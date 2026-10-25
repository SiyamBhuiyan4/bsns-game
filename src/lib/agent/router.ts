// Parses an admin chat message into a hashtag command or a plain (natural-language) message.

export interface ParsedMessage {
  /** Lower-case command name without '#', or null for a plain message. */
  command: string | null;
  args: string[];
  raw: string;
}

const ZERO_WIDTH = /[​-‍⁠﻿]/g;

/**
 * Normalizes Bangla/English input: Bangla digits become ASCII digits, odd spaces
 * (NBSP, zero-width chars) become normal spaces, and runs of whitespace collapse.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(ZERO_WIDTH, '')
    .replace(/＃/g, '#') // fullwidth number sign
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[  -   　]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseMessage(input: string): ParsedMessage {
  const raw = input;
  const text = normalizeText(input);

  if (!text.startsWith('#')) {
    return { command: null, args: [], raw };
  }

  const tokens = text.slice(1).split(' ').filter(Boolean);
  // Strip trailing sentence punctuation from the command word ("#help?" -> "help").
  const command = (tokens[0] ?? 'help').replace(/[.!?,।]+$/u, '').toLowerCase() || 'help';
  const args = tokens.slice(1);

  return { command, args, raw };
}
