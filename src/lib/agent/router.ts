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

export const STOP_WORDS = new Set([
  'create', 'creat', 'crate', 'add', 'ad', 'make', 'register', 'ragister', 'open', 'new', 'notun', 'nutun', 'notn', 'নতুন', 'যুক্ত', 'যোগ',
  'employee', 'employe', 'emplyee', 'emploee', 'emploe', 'empl', 'staff', 'kormi', 'kormy', 'কর্মী', 'কর্মচারী',
  'account', 'acount', 'acnt', 'profile', 'profaile', 'profail', 'প্রোফাইল', 'আইডি', 'id', 'একাউন্ট', 'অ্যাকাউন্ট',
  'banao', 'banaw', 'banau', 'বানাও', 'খোল', 'খোলো', 'খুলুন', 'তৈরি', 'toiri', 'koro', 'করো', 'korun', 'করুন', 'dao', 'দাও', 'khulo', 'khulun', 'khol',
  'name', 'nam', 'namer', 'নাম', 'নামের', 'নামে', 'er', 'এর', 'ের', 'ke', 'কে', 'jonno', 'জন্য', 'hisebe', 'হিসেবে',
  'pass', 'password', 'pasword', 'passwrd', 'pswd', 'পাসওয়ার্ড', 'পাসওয়ার্ড', 'পাস',
  'email', 'mail', 'ইমেইল', 'phone', 'mobile', 'ফোন', 'মোবাইল', 'gmail', 'yahoo', 'hotmail', 'outlook',
  'kivabe', 'kibhabe', 'kemne', 'কিভাবে', 'কীভাবে', 'কেমনে', 'how', 'where', 'kothay', 'koi', 'কই', 'কোথায়', 'কোথায়', 'korbo', 'করব', 'করবো', 'chai', 'চাই'
]);

/**
 * Normalizes Bangla/English multiline input: converts Bangla digits to ASCII digits,
 * collapses spaces while preserving newline structure.
 */
export function normalizePreservingLines(input: string): string {
  return input
    .normalize('NFC')
    .replace(ZERO_WIDTH, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/＃/g, '#') // fullwidth number sign
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[  -   　]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

/**
 * Normalizes Bangla/English input: Bangla digits become ASCII digits, odd spaces
 * (NBSP, zero-width chars) become normal spaces, and runs of whitespace collapse.
 */
export function normalizeText(input: string): string {
  return normalizePreservingLines(input)
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCandidateName(cand: string, pass: string, email: string): string {
  let cleaned = cand.replace(/^[,;:\s]+|[,;:\s]+$/g, '').trim();
  cleaned = cleaned.replace(/^(?:create|creat|add|make|notun|nutun|নতুন|বানাও|যোগ|খোল|খোলো)\s+/i, '').trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const validTokens: string[] = [];
  for (const t of tokens) {
    const cleanT = t.replace(/^[,;:]+|[,;:]+$/g, '');
    if (!cleanT) continue;
    if (cleanT === pass || cleanT === email || /^\d+$/.test(cleanT)) break;
    if (STOP_WORDS.has(cleanT.toLowerCase())) break;
    validTokens.push(cleanT);
  }
  const result = validTokens.join(' ').trim();
  if (!result || STOP_WORDS.has(result.toLowerCase())) {
    return '';
  }
  return result;
}

/**
 * Parses natural language requests that instruct the assistant to perform an action.
 * Returns command & args if an action is requested with parameters, otherwise null.
 */
export function parseNaturalAction(text: string, raw?: string): { command: string; args: string[] } | null {
  const lower = text.toLowerCase();
  const normalizedRaw = raw ? normalizePreservingLines(raw) : text;

  // 1. Employee Account Creation Action (Run before password reset to avoid collision with "name: X pass: Y")
  // Examples:
  // "create an employee acount name: John Doe pass: secret123 email: john@example.com"
  // "akkas nam er employee profile banao\nakkas@gmail.com\n000000"
  // "create employee akkas pass 000000 email akkas@gmail.com"
  // "notun kormi banao rofik password 123456"
  // "রফিক নামে কর্মী বানাও পাস 123456 rofik@gmail.com"
  const isEmployeeCreate =
    /(?:create|creat|crate|add|ad|make|register|ragister|open|new|notun|nutun|notn|নতুন|যুক্ত|যোগ|বানাও|খোল|খোলো|খুলুন|তৈরি)\s*(?::\s*)?(?:an?\s+)?(?:employee|employe|emplyee|emploee|emploe|empl|staff|kormi|kormy|কর্মী|কর্মচারী)/i.test(lower) ||
    /(?:employee|employe|emplyee|kormi|kormy|কর্মী|কর্মচারী|staff)\s*(?:account|acount|acnt|profile|প্রোফাইল|আইডি|id|একাউন্ট|অ্যাকাউন্ট)?\s*(?:create|creat|add|make|banao|খোল|খোলো|খুলুন|তৈরি|বানাও|khulo)/i.test(lower) ||
    /(?:nam\s*er|namer|নামের|নামে|er\s*jonno|এর\s*জন্য|er|এর|ের)\s+(?:employee|employe|kormi|কর্মী|কর্মচারী|staff)\s*(?:account|acount|acnt|profile|প্রোফাইল|আইডি|id|একাউন্ট|অ্যাকাউন্ট)?\s*(?:banao|banaw|banau|বানাও|তৈরি|খোল|খোলো|খুলুন|create|add)/i.test(lower);

  if (isEmployeeCreate) {
    const isQuestion = /(?:how|kivabe|kibhabe|kemne|কিভাবে|কীভাবে|কেমনে|kothay|where|কই|কোথায়|কোথায়)/i.test(lower);
    if (isQuestion && !/(?:pass|password|email|phone|পাসওয়ার্ড|পাসওয়ার্ড|ইমেইল|মোবাইল)/i.test(text) && !/[a-zA-Z0-9._%+-]+@/.test(text)) {
      return null;
    }

    // Extract email
    const emailMatch = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.exec(text);
    const email = emailMatch ? emailMatch[1].trim() : '';

    // Extract phone
    const phoneMatch = /(?:\+?880|0)?1[3-9]\d{8}\b/.exec(text);
    const phone = phoneMatch ? phoneMatch[0].trim() : '';

    // Extract password: Password '000000' (6 zeros) must NEVER be mistaken for name
    let pass = '';
    // Priority A: Explicit label
    const explicitPass = /(?:\b(?:password|pasword|passwrd|pswd|pass)\b|পাসওয়ার্ড|পাসওয়ার্ড|পাস)\s*[:=]?\s*([^\s,;]+)/i.exec(text);
    if (explicitPass) {
      const candidate = explicitPass[1].replace(/^[=:]+/, '').replace(/[,;.]+$/, '').trim();
      if (candidate && !STOP_WORDS.has(candidate.toLowerCase())) {
        pass = candidate;
      }
    }

    // Priority B: Check standalone lines in multiline raw (e.g. "000000" or standalone password line)
    if (!pass) {
      const lines = normalizedRaw.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line === email || line === phone) continue;
        // Pure digits of 4-32 characters is always the password
        if (/^\d{4,32}$/.test(line)) {
          pass = line;
          break;
        }
        if (!line.includes(' ') && line.length >= 4 && line.length <= 32) {
          if (!STOP_WORDS.has(line.toLowerCase())) {
            pass = line;
            break;
          }
        }
      }
    }

    // Priority C: Check standalone tokens in text (digits/symbols take priority over pure alphabetic words)
    if (!pass) {
      const words = text.split(/\s+/).map((w) => w.replace(/^[,;:]+|[,;:]+$/g, '')).filter(Boolean);
      // 1. Pure digits first (e.g. 000000, 123456)
      for (const w of words) {
        if (w === email || w === phone) continue;
        if (/^\d{4,32}$/.test(w)) {
          pass = w;
          break;
        }
      }
      // 2. Alphanumeric containing digits or symbols (e.g. secret123, Karim@2026)
      if (!pass) {
        for (const w of words) {
          if (w === email || w === phone) continue;
          if (w.length >= 4 && /(?=.*[0-9@#$%^&*_!-])[A-Za-z0-9@#$%^&*_!-]{4,32}/.test(w)) {
            if (!STOP_WORDS.has(w.toLowerCase())) {
              pass = w;
              break;
            }
          }
        }
      }
      // 3. Fallback: remaining candidate token
      if (!pass) {
        for (const w of words) {
          if (w === email || w === phone) continue;
          if (w.length >= 4 && /^[A-Za-z0-9@#$%^&*_!-]+$/.test(w)) {
            if (!STOP_WORDS.has(w.toLowerCase())) {
              pass = w;
              break;
            }
          }
        }
      }
    }

    // Extract name: Name 'akkas' must NEVER be mistaken for password
    let name = '';
    // Priority A: Explicit label (requires : or =) so words like "নামে" or "নামের" are never falsely matched
    const explicitName = /(?:^|[\s,;])(?:name|nam|নাম)\s*[:=]\s*([A-Za-z\u0980-\u09ff\s.'-]+?)(?=$|[\n,;]|(?:\s+(?:(?:\b(?:pass|password|pasword|passwrd|pswd|email|mail|phone|name|nam)\b|\d+|[a-zA-Z0-9._%+-]+@|মোবাইল|পাসওয়ার্ড|পাসওয়ার্ড|পাস)\b)))/iu.exec(text);
    if (explicitName) {
      const cand = cleanCandidateName(explicitName[1], pass, email);
      if (cand) name = cand;
    }

    // Priority B: Grammar pattern 1: <Name> (nam er|namer|নামের|নামে) (employee|kormi|কর্মী)
    if (!name) {
      const m = /(?:^|[\n,;])\s*(?:(?:create|creat|add|make|notun|nutun|নতুন|বানাও|যোগ|খোল|খোলো)\s+)?([A-Za-z\u0980-\u09ff\s.'-]+?)\s+(?:nam\s*er|namer|নামের|নামে)\s+(?:employee|employe|kormi|কর্মী|কর্মচারী|staff)/iu.exec(text);
      if (m) {
        const cand = cleanCandidateName(m[1], pass, email);
        if (cand) name = cand;
      }
    }

    // Priority C: Grammar pattern 2: <Name> (er|এর) (jonno|জন্য)? (employee|kormi|কর্মী)
    if (!name) {
      const m = /(?:^|[\n,;])\s*(?:(?:create|creat|add|make|notun|nutun|নতুন|বানাও|যোগ|খোল|খোলো)\s+)?([A-Za-z\u0980-\u09ff\s.'-]+?)(?:\s*(?:er|এর)|ের)\s+(?:jonno\s+|জন্য\s+)?(?:employee|employe|kormi|কর্মী|কর্মচারী|staff)/iu.exec(text);
      if (m) {
        const cand = cleanCandidateName(m[1], pass, email);
        if (cand) name = cand;
      }
    }

    // Priority D: Grammar pattern 3: Action verb + employee + <Name>
    // e.g. "create employee akkas pass 000000 email akkas@gmail.com"
    // e.g. "notun kormi banao rofik password 123456"
    if (!name) {
      const m = /(?:create|creat|crate|add|ad|make|notun|nutun|নতুন|বানাও|যুক্ত\s*করো)\s*(?::\s*)?(?:an?\s+)?(?:employee|employe|kormi|কর্মী|কর্মচারী|staff)\s*(?::\s*)?(?:banao|banaw|বানাও|খোলো|খোল|profile|account|প্রোফাইল)?\s*(?::\s*)?([A-Za-z\u0980-\u09ff\s.'-]+?)(?=$|[\n,;]|(?:\s+(?:(?:\b(?:pass|password|pasword|passwrd|pswd|email|mail|phone)\b|\d+|[a-zA-Z0-9._%+-]+@|মোবাইল|পাসওয়ার্ড|পাসওয়ার্ড|পাস)\b)))/iu.exec(text);
      if (m) {
        const cand = cleanCandidateName(m[1], pass, email);
        if (cand) name = cand;
      }
    }

    // Priority E: Multiline standalone line candidate (if raw is multiline)
    if (!name && normalizedRaw.includes('\n')) {
      const lines = normalizedRaw.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line === email || line === phone || line === pass) continue;
        if (/^\d+$/.test(line)) continue;
        if (STOP_WORDS.has(line.toLowerCase())) continue;
        if (/(?:employee|employe|emplyee|kormi|kormy|কর্মী|কর্মচারী|profile|banao|banaw|বানাও|create|account|staff|worker)/i.test(line)) continue;
        if (/^[A-Za-z\u0980-\u09ff\s.'-]+$/.test(line)) {
          const cand = cleanCandidateName(line, pass, email);
          if (cand) {
            name = cand;
            break;
          }
        }
      }
    }

    // Priority F: Token fallback (pick remaining alphabetic token)
    if (!name) {
      const words = text.split(/\s+/).map((w) => w.replace(/^[,;:]+|[,;:]+$/g, '')).filter(Boolean);
      for (const w of words) {
        if (w === email || w === phone || w === pass) continue;
        if (/^\d+$/.test(w)) continue;
        if (STOP_WORDS.has(w.toLowerCase())) continue;
        if (/^[A-Za-z\u0980-\u09ff]+$/.test(w)) {
          name = w;
          break;
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

  // 1b. Plain Multiline Employee Credentials (e.g. name on line 1, email/phone on line 2, password on line 3)
  const rawLines = normalizedRaw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length >= 2 && rawLines.length <= 5) {
    let mEmail = '';
    let mPhone = '';
    let mPass = '';
    let mName = '';

    for (const line of rawLines) {
      const emailTest = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.exec(line);
      const emailLabeled = /^(?:email|mail|ইমেইল)\s*[:=]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/i.exec(line);
      if (emailTest) {
        mEmail = emailTest[0];
        continue;
      }
      if (emailLabeled) {
        mEmail = emailLabeled[1];
        continue;
      }

      const phoneTest = /^(?:\+?880|0)?1[3-9]\d{8}$/.exec(line);
      const phoneLabeled = /^(?:phone|mobile|ফোন|মোবাইল)\s*[:=]\s*((?:\+?880|0)?1[3-9]\d{8})$/i.exec(line);
      if (phoneTest) {
        mPhone = phoneTest[0];
        continue;
      }
      if (phoneLabeled) {
        mPhone = phoneLabeled[1];
        continue;
      }

      const passLabeled = /^(?:pass|password|pasword|passwrd|পাসওয়ার্ড|পাসওয়ার্ড)\s*[:=]\s*([A-Za-z0-9@#$%^&*_!-]{4,32})$/i.exec(line);
      if (passLabeled) {
        mPass = passLabeled[1];
        continue;
      }
      // Password token: pure digits of 4-32 characters or alphanumeric token containing digits/special chars
      if (!mPass && (/^\d{4,32}$/.test(line) || (/^[A-Za-z0-9@#$%^&*_!-]{6,32}$/.test(line) && /[\d@#$%^&*_!-]/.test(line)))) {
        mPass = line;
        continue;
      }

      const nameLabeled = /^(?:name|nam|নাম)\s*[:=]\s*([A-Za-z\u0980-\u09ff\s.]{2,40})$/i.exec(line);
      if (nameLabeled) {
        mName = nameLabeled[1].trim();
        continue;
      }

      // Skip lines that contain action / command words
      if (/(?:employee|employe|emplyee|kormi|kormy|কর্মী|কর্মচারী|staff|profile|banao|banaw|বানাও|create|account|acount|খোল|খোলো|নতুন|notun)/i.test(line)) {
        continue;
      }

      if (!mName && /^[A-Za-z\u0980-\u09ff\s.]{2,40}$/.test(line)) {
        if (!STOP_WORDS.has(line.toLowerCase())) {
          mName = line;
          continue;
        }
      }
    }

    if (mName && mPass && (mEmail || mPhone)) {
      const args = ['add', `name=${mName}`, `password=${mPass}`];
      if (mEmail) args.push(`email=${mEmail}`);
      if (mPhone) args.push(`phone=${mPhone}`);
      return { command: 'team', args };
    }
  }

  // 2. Password Reset / Change Action
  // Examples:
  // "set password of akkas to 654321"
  // "set password of Siyam to secret123"
  // "reset password of siyam@example.com to secret123"
  // "change password for John to secret123"
  // "Siyam er password reset koro 123456"
  // "রহিমের পাসওয়ার্ড 123456 করে দাও"
  const passResetPatterns = [
    /(?:set|reset|change|update)\s+(?:the\s+)?(?:employee\s+)?(?:password|pass|pasword|passwrd|পাসওয়ার্ড|পাসওয়ার্ড)\s+(?:of|for)\s+(.+?)\s+(?:to|as|হিসেবে)\s+([^\s:]+)/i,
    /(?:set|reset|change|update)\s+(?:employee\s+)?(.+?)(?:'s)?\s+(?:pass|password|pasword|passwrd|পাসওয়ার্ড|পাসওয়ার্ড)\s+(?:to|as|হিসেবে)\s+([^\s:]+)/i,
    /(.+?)(?:\s+(?:er|এর|'s))\s+(?:পাসওয়ার্ড|পাসওয়ার্ড|password|pass|pasword)\s*(?:reset|change|বদল|সেট)?\s*(?:koro|করো|to|হিসেবে)?\s*([A-Za-z0-9@#$%^&*_!-]{4,30})$/i,
    /(.+?)(?:\s+(?:er|এর|'s))\s+(?:পাসওয়ার্ড|পাসওয়ার্ড|password|pass|pasword)\s*([A-Za-z0-9@#$%^&*_!-]{4,30})\s*(?:দাও|করো|set|koro|বানাও|করে\s*দাও)/i,
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
  const sectionCreateMatch = /(?:create|add|make|banao|নতুন|যোগ)\s+(?:a\s+)?(?:new\s+)?(?:section|group|সেকশন|গ্রুপ)\s+(?:named\s+|called\s+|নামে\s+)?([A-Za-z0-9\s-_]{2,40})$/i.exec(text);
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

  // 5. Section Assignment Action
  // "assign Arif to Dhaka Farmers" / "Arif ke Dhaka Farmers e assign koro"
  // "assign Sumaiya to Dhaka Farmers" / "Sumaiya ke Dhaka Farmers e assign koro"
  const assignMatch =
    /(?:assign|সেকশন\s*বরাদ্দ|যুক্ত\s*করো)\s+(?:employee\s+|কর্মী\s+)?(.+?)\s+(?:to|in|সেকশনে|এ)\s+(?:section\s+|সেকশন\s+)?([^\n,]+)/i.exec(text) ||
    /(.+?)(?:-?কে|\s+ke)\s+(.+?)(?:\s+সেকশন|\s+section)?(?:\s+এ|\s+e)?\s*(?:assign|বরাদ্দ|যুক্ত\s*করো|দাও|koro|করো)/iu.exec(text);

  if (assignMatch && !/how|kivabe|কিভাবে|where|kothay/i.test(lower)) {
    let empTarget = assignMatch[1].trim();
    const secTarget = assignMatch[2].replace(/(?:সেকশন|section)\s*$/i, '').trim();
    empTarget = empTarget.replace(/^(?:employee|kormi|কর্মী)\s+/i, '').trim();
    if (empTarget && secTarget && !/^(?:task|টাস্ক|link|লিংক|links)$/i.test(empTarget)) {
      return { command: 'assign', args: [empTarget, 'to', secTarget] };
    }
  }

  // 6. Customer Access Permission Toggle Action
  // "give Arif permission to view all customers" / "Arif ke sob customer dekhar access dao"
  // "Arif er customer access bondho koro" / "Sumaiya er customer view permission bondho koro"
  const permGrantMatch =
    /(?:give|grant|allow)\s+(.+?)\s+(?:permission\s+to\s+view\s+all\s+customers|full\s+customer\s+access|access\s+to\s+all\s+customers|customer\s+(?:view\s+)?access|all\s+customer\s+access)/i.exec(text) ||
    /(.+?)(?:-?কে|-?ের|\s+ke|\s*er)\s+(?:(?:sob|সকল|সব)\s+)?(?:customer|কাস্টমার)\s*(?:dekhar\s+access|দেখার\s+অনুমতি|access|permission|ভিউ\s*অ্যাক্সেস)\s*(?:dao|দাও|open|চালু\s*koro|চালু\s*করো)/iu.exec(text);

  const permRevokeMatch =
    /(?:revoke|remove|disable|block)\s+(?:all\s+)?(?:customer\s+(?:view\s+)?access|permission\s+to\s+view\s+all\s+customers)\s+(?:for|from)\s+(.+)/i.exec(text) ||
    /(?:revoke|remove|disable|block)\s+(.+?)(?:'s)?\s+(?:customer\s+(?:view\s+)?access|customer\s+access)/i.exec(text) ||
    /(.+?)(?:-?ের|\s*er)\s+(?:(?:sob|সকল|সব)\s+)?(?:customer|কাস্টমার)\s*(?:view\s+)?(?:access|অনুমতি|permission)\s*(?:bondho\s+koro|বন্ধ\s+করো|revoke|off)/iu.exec(text);

  if (permGrantMatch) {
    const emp = permGrantMatch[1].replace(/^(?:employee|kormi|কর্মী)\s+/i, '').trim();
    if (emp) return { command: 'permission', args: [emp, 'grant'] };
  }
  if (permRevokeMatch) {
    const emp = permRevokeMatch[1].replace(/^(?:employee|kormi|কর্মী)\s+/i, '').trim();
    if (emp) return { command: 'permission', args: [emp, 'revoke'] };
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
  const action = parseNaturalAction(text, raw);
  if (action) {
    return { command: action.command, args: action.args, raw };
  }

  return { command: null, args: [], raw };
}
