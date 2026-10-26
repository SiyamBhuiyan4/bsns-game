// Parses an admin chat message into a hashtag command or a plain (natural-language) message.
// Automatically recognizes natural language action instructions (e.g. "create employee name: X pass: Y",
// "set password of Siyam to 123456", "create section Agro") and maps them to agent commands.

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

/**
 * Parses natural language requests that instruct the assistant to perform an action.
 * Returns command & args if an action is requested with parameters, otherwise null.
 */
export function parseNaturalAction(text: string): { command: string; args: string[] } | null {
  const lower = text.toLowerCase();

  // 1. Employee Account Creation Action (Run before password reset to avoid collision with "name: X pass: Y")
  // Examples:
  // "create an employee acount name: John Doe pass: secret123 email: john@example.com"
  // "create an employee acount name : this pass that"
  // "creat employe acnt name: John pass: 123456"
  // "notun kormy account banao nam: Rahim pass: 123456"
  // "add employee name: Arif pass: 123456"
  const isEmployeeCreate =
    /(?:create|creat|crate|add|ad|make|register|ragister|open|new|notun|nutun|notn|নতুন|যুক্ত|যোগ|বানাও)\s+(?:an?\s+)?(?:employee|employe|emplyee|emploee|emploe|empl|staff|kormi|kormy|কর্মী|কর্মচারী)/i.test(lower) ||
    /(?:employee|employe|emplyee|kormi|kormy|কর্মী)\s*(?:account|acount|acnt|আইডি)?\s*(?:create|creat|add|make|banao|খোলো|তৈরি|বানাও)/i.test(lower);

  const hasNameToken = /(?:name|nam|নাম)\s*[:=]/i.test(lower);
  const hasPassToken = /(?:pass|password|pasword|passwrd|পাসওয়ার্ড|পাসওয়ার্ড)\s*[:=]?/i.test(lower);

  if (isEmployeeCreate && (hasNameToken || hasPassToken)) {
    // Extract key-values: name, pass, email, phone
    const nameMatch = /(?:name|nam|নাম)\s*[:=]\s*([^:=]+?)(?=\s+(?:pass|password|pasword|passwrd|email|mail|phone|মোবাইল|পাসওয়ার্ড|পাসওয়ার্ড|ইমেইল)\b|$)/i.exec(text);
    const passMatch = /(?:pass|password|pasword|passwrd|পাসওয়ার্ড|পাসওয়ার্ড)\s*[:=]?\s*([^\s:=]+)(?=\s+(?:name|nam|email|mail|phone|মোবাইল|নাম|ইমেইল)\b|$)/i.exec(text);
    const emailMatch = /(?:email|mail|ইমেইল)\s*[:=]?\s*([^\s:=]+)(?=\s+(?:name|nam|pass|password|phone|মোবাইল|নাম|পাসওয়ার্ড)\b|$)/i.exec(text);
    const phoneMatch = /(?:phone|mobile|ফোন|মোবাইল)\s*[:=]?\s*([^\s:=]+)(?=\s+(?:name|nam|pass|password|email|ইমেইল|নাম|পাসওয়ার্ড)\b|$)/i.exec(text);

    if (nameMatch && passMatch) {
      const name = nameMatch[1].trim();
      const pass = passMatch[1].trim();
      const email = emailMatch ? emailMatch[1].trim() : '';
      const phone = phoneMatch ? phoneMatch[1].trim() : '';

      const args = ['add', `name=${name}`, `password=${pass}`];
      if (email) args.push(`email=${email}`);
      if (phone) args.push(`phone=${phone}`);

      return { command: 'team', args };
    }
  }

  // 2. Password Reset / Change Action
  // Examples:
  // "set password of Siyam to secret123"
  // "reset password of siyam@example.com to secret123"
  // "change password for John to secret123"
  // "Siyam er password reset koro 123456"
  // "রহিমের পাসওয়ার্ড 123456 করে দাও"
  const passResetPatterns = [
    /(?:set|reset|change|update)\s+(?:the\s+)?(?:employee\s+)?(?:password|pass|pasword|passwrd)\s+(?:of|for)\s+([^\s:]+)\s+(?:to|as)\s+([^\s:]+)/i,
    /(?:set|reset|change|update)\s+(?:employee\s+)?([^\s:]+)(?:'s)?\s+(?:pass|password|pasword|passwrd)\s+(?:to|as)\s+([^\s:]+)/i,
    /([^\s:]+)(?:\s+(?:er|এর|'s))?\s+(?:পাসওয়ার্ড|পাসওয়ার্ড|password|pass|pasword)\s*(?:reset|change|বদল|সেট)?\s*(?:koro|করো|to|হিসেবে)?\s*([A-Za-z0-9@#$%^&*_!-]{4,30})/i,
    /([^\s:]+)(?:\s+(?:er|এর|'s))?\s+(?:পাসওয়ার্ড|পাসওয়ার্ড|password|pass|pasword)\s*([A-Za-z0-9@#$%^&*_!-]{4,30})\s*(?:দাও|করো|set|koro|বানাও|করে\s*দাও)/i,
  ];

  for (const pat of passResetPatterns) {
    const m = pat.exec(text);
    if (m && m[1] && m[2] && m[2].length >= 4) {
      let target = m[1].replace(/['",]/g, '').trim();
      target = target.replace(/(?:ের|র|er|'s)$/u, '').trim();
      // Ignore generic stopwords as targets
      if (/^(?:employee|employe|employees|staff|specific|the|a|an|কর্মী|কর্মচারী|কোনো|নির্দিষ্ট|this)$/i.test(target)) {
        continue;
      }
      const newPass = m[2].replace(/['",]/g, '').trim();
      if (target && newPass) {
        return { command: 'password', args: [target, newPass] };
      }
    }
  }

  // 3. Section Creation Action
  // "create section Agro Links" / "notun section banao Mushroom Group"
  const sectionCreateMatch = /(?:create|add|make|banao|নতুন|যোগ)\s+(?:a\s+)?(?:new\s+)?(?:section|group|সেকশন|গ্রুপ)\s+(?:named\s+|called\s+|নামে\s+)?([A-Za-z0-9\s-_]{3,40})$/i.exec(text);
  if (sectionCreateMatch && !/how|kivabe|কিভাবে|where|kothay/i.test(lower)) {
    const secName = sectionCreateMatch[1].trim();
    if (secName) {
      return { command: 'groups', args: ['create', secName] };
    }
  }

  // 4. Link Addition Action
  // "add link https://facebook.com/group/123 to section Agro Links"
  const linkAddMatch = /(?:add|insert|save)\s+(?:link\s+)?(https?:\/\/[^\s]+)\s+(?:to|in)\s+(?:section\s+)?([^\n,]+)/i.exec(text);
  if (linkAddMatch) {
    const url = linkAddMatch[1].trim();
    const secName = linkAddMatch[2].trim();
    return { command: 'links', args: [secName, url] };
  }

  return null;
}

export function parseMessage(input: string): ParsedMessage {
  const raw = input;
  const text = normalizeText(input);

  if (text.startsWith('#')) {
    const tokens = text.slice(1).split(' ').filter(Boolean);
    const command = (tokens[0] ?? 'help').replace(/[.!?,।]+$/u, '').toLowerCase() || 'help';
    const args = tokens.slice(1);
    return { command, args, raw };
  }

  // Check for natural language action commands (remote agent actions)
  const action = parseNaturalAction(text);
  if (action) {
    return { command: action.command, args: action.args, raw };
  }

  return { command: null, args: [], raw };
}
