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
  // "akkas nam er employee profile banao\nakkas@gmail.com\n000000"
  // "create an employee acount name : this pass that"
  // "creat employe acnt name: John pass: 123456"
  // "notun kormy account banao nam: Rahim pass: 123456"
  // "add employee name: Arif pass: 123456"
  const isEmployeeCreate =
    /(?:create|creat|crate|add|ad|make|register|ragister|open|new|notun|nutun|notn|নতুন|যুক্ত|যোগ|বানাও|খোল|খোলো)\s+(?:an?\s+)?(?:employee|employe|emplyee|emploee|emploe|empl|staff|kormi|kormy|কর্মী|কর্মচারী)/i.test(lower) ||
    /(?:employee|employe|emplyee|kormi|kormy|কর্মী|কর্মচারী|staff)\s*(?:account|acount|acnt|profile|প্রোফাইল|আইডি|id)?\s*(?:create|creat|add|make|banao|খোল|খোলো|তৈরি|বানাও|khulo)/i.test(lower) ||
    /(?:nam\s*er|namer|নামের|নামে|er\s*jonno|এর\s*জন্য)\s+(?:employee|employe|kormi|কর্মী|কর্মচারী)\s*(?:account|acount|acnt|profile|প্রোফাইল)?\s*(?:banao|banaw|banau|বানাও|তৈরি|create|add)/i.test(lower);

  if (isEmployeeCreate) {
    // Extract email
    const emailMatch = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.exec(text);
    const email = emailMatch ? emailMatch[1].trim() : '';

    // Extract phone
    const phoneMatch = /(?:\+?880|0)?1[3-9]\d{8}\b/.exec(text);
    const phone = phoneMatch ? phoneMatch[0].trim() : '';

    // Extract name
    let name = '';
    const explicitName = /(?:name|nam|নাম)\s*[:=]?\s*([^:=\n]+?)(?=\s+(?:pass|password|pasword|email|phone|মোবাইল|পাসওয়ার্ড)\b|\n|$)/i.exec(text);
    if (explicitName && !/^(?:banao|banaw|বানাও|koro|করো|add|create)$/i.test(explicitName[1].trim())) {
      name = explicitName[1].trim();
    } else {
      const patternName1 = /([A-Za-z\u0980-\u09ff]+)\s+(?:nam\s*er|namer|নামের|নামে)\s+(?:employee|employe|kormi|কর্মী)/i.exec(text);
      if (patternName1 && !/^(?:banao|banaw|বানাও|koro|করো|add|create|notun|নতুন)$/i.test(patternName1[1].trim())) {
        name = patternName1[1].trim();
      } else {
        const patternName2 = /([A-Za-z\u0980-\u09ff]+)\s*(?:er|এর)\s+(?:jonno\s+)?(?:employee|employe|kormi|কর্মী)/i.exec(text);
        if (patternName2 && !/^(?:banao|banaw|বানাও|koro|করো|add|create|notun|নতুন)$/i.test(patternName2[1].trim())) {
          name = patternName2[1].trim();
        } else {
          const patternName3 = /(?:create|add|make|notun|নতুন|বানাও)\s+(?:employee|employe|kormi|কর্মী)\s*(?:banao|banaw|বানাও|খোলো|খোল|profile|account|প্রোফাইল)?\s*([A-Za-z\u0980-\u09ff]+)/i.exec(text);
          if (patternName3 && !/^(?:banao|banaw|বানাও|koro|করো|add|create|pass|password|email|phone)$/i.test(patternName3[1].trim())) {
            name = patternName3[1].trim();
          }
        }
      }
    }

    // Extract password
    let pass = '';
    const explicitPass = /(?:pass|password|pasword|passwrd|পাসওয়ার্ড|পাসওয়ার্ড)\s*[:=]?\s*([^\s:=]+)(?=\s+(?:name|nam|email|mail|phone|মোবাইল|নাম|ইমেইল)\b|\n|$)/i.exec(text);
    if (explicitPass) {
      pass = explicitPass[1].trim();
    } else {
      // Check if there is a standalone token or line that looks like a password (e.g. 000000, 123456, etc.)
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line !== email && line !== phone && !line.includes(' ') && line.length >= 4 && line.length <= 32) {
          if (!/^(?:employee|kormi|profile|banao|create|account|staff|profile)$/i.test(line)) {
            pass = line;
            break;
          }
        }
      }
      if (!pass) {
        const words = text.split(/\s+/).filter(Boolean);
        for (const w of words) {
          if (w !== name && w !== email && w !== phone && w.length >= 4 && /^[A-Za-z0-9@#$%^&*_!-]+$/.test(w)) {
            if (!/^(?:employee|employe|profile|banao|create|account|staff|kormi|namer|nam|gmail|yahoo|hotmail)$/i.test(w)) {
              pass = w;
              break;
            }
          }
        }
      }
    }

    if (name && pass) {
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
