// Registry of hashtag commands for the admin AI assistant.
// Write commands return a preview first; they only execute when ctx.confirm is true.

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { getDhakaDateString, DHAKA_TIMEZONE } from '@/lib/date';

export interface AgentContext {
  actorId: string;
  /** Set only when the admin explicitly confirmed a previewed write. */
  confirm: boolean;
}

export interface PendingAction {
  command: string;
  args: string[];
}

export interface AgentResult {
  reply: string;
  needsConfirmation?: boolean;
  pending?: PendingAction;
}

export interface AgentCommand {
  name: string;
  aliases: string[];
  descBn: string;
  descEn: string;
  usage: string;
  /** true when the command can write data and therefore previews first. */
  write: boolean;
  run: (args: string[], ctx: AgentContext) => Promise<AgentResult>;
}

const MAX_LINKS_PER_COMMAND = 200;
const CREATE_WORDS = new Set(['add', 'create', 'new', 'যোগ', 'তৈরি', 'নতুন']);
const LIST_WORDS = new Set(['list', 'show', 'তালিকা', 'দেখাও']);
const URL_TOKEN = /^(?:https?:\/\/|www\.)\S+$|^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?$/i;

// ---------- helpers ----------

function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function todayStartDhaka(): Date {
  // Midnight in Asia/Dhaka (UTC+6, no DST) as an absolute instant.
  return new Date(`${getDhakaDateString()}T00:00:00+06:00`);
}

function sameName(a: string, b: string): boolean {
  return a.toLocaleLowerCase('en-US') === b.toLocaleLowerCase('en-US');
}

async function findSectionByName(name: string) {
  const sections = await prisma.groupSection.findMany({});
  return sections.find((s: any) => sameName(s.name, name)) ?? null;
}

function parseEmail(value: string): string | null {
  const parsed = z.string().trim().email().safeParse(value);
  return parsed.success ? parsed.data.toLowerCase() : null;
}

function normalizeUrl(token: string): string | null {
  const withScheme = /^https?:\/\//i.test(token) ? token : `https://${token}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function ask(bn: string, en: string): string {
  return `${bn}\n${en}`;
}

const CONFIRM_BN = 'নিশ্চিত করতে "হ্যাঁ" লিখুন।';
const CONFIRM_EN = 'Reply yes to confirm.';

// ---------- #help ----------

const helpCommand: AgentCommand = {
  name: 'help',
  aliases: ['সাহায্য'],
  descBn: 'সব কমান্ডের তালিকা দেখায়',
  descEn: 'Lists all commands',
  usage: '#help',
  write: false,
  run: async () => ({ reply: helpReply() }),
};

export function helpReply(): string {
  const lines = COMMANDS.map(
    (c) => `#${c.name} - ${c.descBn} / ${c.descEn}\n   ${c.usage}`
  );
  return [
    'কমান্ড তালিকা / Command list:',
    ...lines,
    '',
    'সাধারণ বার্তা (# ছাড়া) শুধু তখনই কাজ করবে যখন AI সক্রিয় থাকবে।',
    'Plain messages (without #) need the AI to be enabled.',
  ].join('\n');
}

// ---------- #groups (sections) ----------

const groupsCommand: AgentCommand = {
  name: 'groups',
  aliases: ['group', 'section', 'sections', 'গ্রুপ', 'সেকশন'],
  descBn: 'সেকশন তৈরি বা তালিকা',
  descEn: 'Create a section or list sections',
  usage: '#groups [list] | #groups <name> add | #groups add section <name>',
  write: true,
  run: async (args, ctx) => {
    if (args.length === 0 || LIST_WORDS.has(args[0].toLowerCase())) {
      const sections = await prisma.groupSection.findMany({});
      if (sections.length === 0) {
        return { reply: ask('কোনো সেকশন নেই।', 'No sections yet.') };
      }
      const lines = sections.map((s: any) => `- ${s.name}${s.is_active ? '' : ' (inactive)'}`);
      return { reply: [`সেকশন (${sections.length}) / Sections (${sections.length}):`, ...lines].join('\n') };
    }

    // Drop one leading create word, then one leading section word, and a trailing create word.
    let tokens = [...args];
    if (CREATE_WORDS.has(tokens[0].toLowerCase())) tokens = tokens.slice(1);
    if (['section', 'group', 'সেকশন', 'গ্রুপ'].includes(tokens[0]?.toLowerCase())) tokens = tokens.slice(1);
    if (tokens.length > 0 && CREATE_WORDS.has(tokens[tokens.length - 1].toLowerCase())) tokens = tokens.slice(0, -1);

    const name = cleanName(tokens.join(' '));
    if (name.length < 2 || name.length > 100) {
      return { reply: ask('সেকশনের নাম ২-১০০ অক্ষরের হতে হবে।', 'Section name must be 2-100 characters.') };
    }

    const existing = await findSectionByName(name);
    if (existing) {
      return { reply: ask(`"${existing.name}" নামে সেকশন আগে থেকেই আছে।`, `Section "${existing.name}" already exists.`) };
    }

    if (!ctx.confirm) {
      return {
        reply: ask(
          `আমি সেকশন "${name}" তৈরি করব। ${CONFIRM_BN}`,
          `I will create section "${name}". ${CONFIRM_EN}`
        ),
        needsConfirmation: true,
        pending: { command: 'groups', args },
      };
    }

    // Re-check on confirm in case it was created in the meantime.
    const raced = await findSectionByName(name);
    if (raced) {
      return { reply: ask(`"${raced.name}" নামে সেকশন আগে থেকেই আছে।`, `Section "${raced.name}" already exists.`) };
    }

    const section = await prisma.groupSection.create({
      data: { name, description: null, is_active: true },
    });
    await createAuditLog({
      actorId: ctx.actorId,
      action: 'CREATE',
      entity: 'GroupSection',
      entityId: section.id,
      payload: { name: section.name, via: 'agent' },
    });
    return { reply: ask(`সেকশন "${section.name}" তৈরি হয়েছে।`, `Section "${section.name}" created.`) };
  },
};

// ---------- #links ----------

const linksCommand: AgentCommand = {
  name: 'links',
  aliases: ['link', 'url', 'urls', 'লিংক'],
  descBn: 'সেকশনে এক বা একাধিক লিংক যোগ করা',
  descEn: 'Add one or more links to a section',
  usage: '#links <section name> <url> [url...]',
  write: true,
  run: async (args, ctx) => {
    const nameTokens: string[] = [];
    const rawUrls: string[] = [];
    for (const token of args) {
      if (URL_TOKEN.test(token)) rawUrls.push(token);
      else nameTokens.push(token);
    }

    const sectionName = cleanName(nameTokens.join(' '));
    if (!sectionName) {
      return { reply: ask('সেকশনের নাম দিন: #links <section> <url>', 'Give a section name: #links <section> <url>') };
    }
    if (rawUrls.length === 0) {
      return { reply: ask('অন্তত একটি লিংক দিন।', 'Give at least one link.') };
    }

    const urls: string[] = [];
    const invalid: string[] = [];
    for (const token of rawUrls) {
      const normalized = normalizeUrl(token);
      if (!normalized || normalized.length > 2000) invalid.push(token);
      else if (!urls.includes(normalized)) urls.push(normalized);
    }
    if (invalid.length > 0) {
      return {
        reply: ask(`এই লিংকগুলো সঠিক নয়: ${invalid.join(', ')}`, `Invalid links: ${invalid.join(', ')}`),
      };
    }
    if (urls.length > MAX_LINKS_PER_COMMAND) {
      return {
        reply: ask(
          `একবারে সর্বোচ্চ ${MAX_LINKS_PER_COMMAND}টি লিংক যোগ করা যাবে।`,
          `At most ${MAX_LINKS_PER_COMMAND} links per command.`
        ),
      };
    }

    const section = await findSectionByName(sectionName);
    if (!section) {
      return {
        reply: ask(
          `"${sectionName}" নামে সেকশন পাওয়া যায়নি। আগে #groups দিয়ে তৈরি করুন।`,
          `Section "${sectionName}" not found. Create it first with #groups.`
        ),
      };
    }

    const existingLinks = await prisma.groupLink.findMany({ where: { section_id: section.id } });
    const existingUrls = new Set(existingLinks.map((l: any) => l.url));
    const duplicates = urls.filter((u) => existingUrls.has(u));
    const fresh = urls.filter((u) => !existingUrls.has(u));

    if (!ctx.confirm) {
      return {
        reply: ask(
          `আমি সেকশন "${section.name}" এ ${fresh.length}টি লিংক যোগ করব (${duplicates.length}টি আগে থেকেই আছে, বাদ যাবে)। ${CONFIRM_BN}`,
          `I will add ${fresh.length} links to section "${section.name}" (${duplicates.length} duplicates skipped). ${CONFIRM_EN}`
        ),
        needsConfirmation: true,
        pending: { command: 'links', args },
      };
    }

    let added = 0;
    if (fresh.length > 0) {
      const result = await prisma.groupLink.createMany({
        data: fresh.map((url) => ({
          section_id: section.id,
          url,
          title: null,
          is_active: true,
        })),
        skipDuplicates: true,
      });
      added = result.count;
    }
    const skipped = urls.length - added;

    await createAuditLog({
      actorId: ctx.actorId,
      action: 'CREATE',
      entity: 'GroupLink',
      entityId: section.id,
      payload: { section: section.name, added, skipped, via: 'agent' },
    });

    return {
      reply: ask(
        `সেকশন "${section.name}" এ ${added}টি লিংক যোগ হয়েছে, ${skipped}টি ডুপ্লিকেট বাদ গেছে।`,
        `Added ${added} links to "${section.name}", ${skipped} duplicates skipped.`
      ),
    };
  },
};

// ---------- #team (employees) ----------

const employeeInputSchema = z.object({
  name: z.string().trim().min(2, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে (Name must be at least 2 chars)').max(100),
  email: z.string().trim().email('সঠিক ইমেইল ঠিকানা দিন (Valid email required)'),
  password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (Password must be at least 6 chars)').max(100),
  phone: z.string().optional().nullable(),
});

const FIELD_ALIASES: Record<string, 'name' | 'email' | 'password' | 'phone'> = {
  name: 'name',
  নাম: 'name',
  nam: 'name',
  email: 'email',
  ইমেইল: 'email',
  mail: 'email',
  password: 'password',
  pass: 'password',
  পাসওয়ার্ড: 'password',
  passwrd: 'password',
  pasword: 'password',
  pswd: 'password',
  phone: 'phone',
  ফোন: 'phone',
  mobile: 'phone',
  মোবাইল: 'phone',
};

/** Parses "email=a@b.com name=Rahim Uddin password=secret1" or "name: John pass: secret1 email: john@gm.com" */
function parseEmployeeFields(tokens: string[]): Record<string, string> {
  const fields: Record<string, string[]> = {};
  let current: string | null = null;
  const unassigned: string[] = [];

  for (const token of tokens) {
    const match = /^([^=:]+)[=:](.*)$/u.exec(token);
    const key = match ? FIELD_ALIASES[match[1].toLowerCase()] : undefined;
    if (match && key) {
      current = key;
      fields[key] = match[2] ? [match[2]] : [];
    } else if (current) {
      fields[current].push(token);
    } else {
      unassigned.push(token);
    }
  }

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = v.join(' ').trim();

  // Positional fallback for unassigned tokens
  if (unassigned.length > 0) {
    for (const t of unassigned) {
      if (!out.email && t.includes('@')) {
        out.email = t;
      } else if (!out.phone && /(?:\+?880|0)?1[3-9]\d{8}\b/.test(t)) {
        out.phone = t;
      } else if (!out.password && /^\d{6,}$/.test(t)) {
        out.password = t;
      }
    }
    const remaining = unassigned.filter(
      (t) => t !== out.email && t !== out.phone && t !== out.password
    );
    if (remaining.length > 0) {
      if (!out.name) {
        if (!out.password && remaining.length >= 2) {
          const passIdx = remaining.findIndex((r) => /^\d{6,}$/.test(r) || r.length >= 6);
          if (passIdx !== -1) {
            out.password = remaining[passIdx];
            remaining.splice(passIdx, 1);
          }
        }
        out.name = remaining.join(' ').trim();
      } else if (!out.password) {
        out.password = remaining[0];
      }
    }
  }

  return out;
}

const teamCommand: AgentCommand = {
  name: 'team',
  aliases: ['employee', 'employees', 'staff', 'কর্মী', 'টিম'],
  descBn: 'কর্মী তালিকা বা নতুন কর্মী যোগ',
  descEn: 'List employees or create one',
  usage: '#team [list] | #team add email=<email> name=<name> password=<password>',
  write: true,
  run: async (args, ctx) => {
    const isCreate = args.length > 0 && (CREATE_WORDS.has(args[0].toLowerCase()) || args.some((a) => a.includes('=')));

    if (!isCreate) {
      const employees = await prisma.user.findMany({ where: { role: 'EMPLOYEE' } });
      if (employees.length === 0) {
        return { reply: ask('কোনো কর্মী নেই।', 'No employees yet.') };
      }
      const active = employees.filter((e: any) => e.is_active).length;
      const lines = employees
        .slice(0, 50)
        .map((e: any) => `- ${e.name} <${e.email}>${e.is_active ? '' : ' (inactive)'}`);
      const more = employees.length > 50 ? [`... আরও ${employees.length - 50}জন / and ${employees.length - 50} more`] : [];
      return {
        reply: [
          `কর্মী: ${employees.length}জন (সক্রিয়: ${active}) / Employees: ${employees.length} (active: ${active})`,
          ...lines,
          ...more,
        ].join('\n'),
      };
    }

    const fields = parseEmployeeFields(CREATE_WORDS.has(args[0].toLowerCase()) ? args.slice(1) : args);
    let resolvedEmail = fields.email ?? '';
    if (!resolvedEmail && fields.name) {
      const cleanSlug = fields.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'staff';
      resolvedEmail = `${cleanSlug}@company.com`;
    }

    const parsed = employeeInputSchema.safeParse({
      name: fields.name ?? '',
      email: resolvedEmail,
      password: fields.password ?? '',
      phone: fields.phone ?? null,
    });
    if (!parsed.success) {
      return {
        reply: ask(
          'তথ্য অসম্পূর্ণ: নাম (name) এবং পাসওয়ার্ড (password) দিন।',
          `Missing or invalid fields: ${parsed.error.issues[0]?.message ?? 'check name and password'}`
        ),
      };
    }

    const name = parsed.data.name.replace(/\s+/g, ' ');
    const email = parsed.data.email.toLowerCase();
    const phone = parsed.data.phone || null;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { reply: ask(`${email} ইমেইল আগে থেকেই ব্যবহৃত।`, `Email ${email} is already in use.`) };
    }

    if (!ctx.confirm) {
      // Never echo the password back, not even masked.
      return {
        reply: ask(
          `আমি কর্মী "${name}" (${email}${phone ? ', ফোন: ' + phone : ''}) তৈরি করব। পাসওয়ার্ড সেট হবে (দেখানো হবে না)। ${CONFIRM_BN}`,
          `I will create employee "${name}" (${email}${phone ? ', phone: ' + phone : ''}) with the password set (hidden). ${CONFIRM_EN}`
        ),
        needsConfirmation: true,
        pending: { command: 'team', args },
      };
    }

    const password_hash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password_hash,
        role: 'EMPLOYEE',
        is_active: true,
      },
    });

    await createAuditLog({
      actorId: ctx.actorId,
      action: 'CREATE',
      entity: 'User',
      entityId: user.id,
      payload: { name: user.name, email: user.email, role: 'EMPLOYEE', via: 'agent' },
    });

    return { reply: ask(`কর্মী "${user.name}" (${user.email}) তৈরি হয়েছে।`, `Employee "${user.name}" (${user.email}) created.`) };
  },
};

// ---------- #assign ----------

const assignCommand: AgentCommand = {
  name: 'assign',
  aliases: ['অ্যাসাইন', 'বরাদ্দ'],
  descBn: 'কর্মীকে সেকশনে যুক্ত করা (নাম বা ইমেইল দিয়ে)',
  descEn: 'Assign an employee (by name or email) to a section',
  usage: '#assign <name/email> to <section name>',
  write: true,
  run: async (args, ctx) => {
    let employee = null;
    let sectionName = '';

    const emailIndex = args.findIndex((a) => a.includes('@'));
    if (emailIndex !== -1) {
      const email = parseEmail(args[emailIndex]);
      if (!email) {
        return { reply: ask('সঠিক ইমেইল দিন।', 'Enter a valid email.') };
      }
      employee = await prisma.user.findUnique({ where: { email } });
      const rest = args.filter((_, i) => i !== emailIndex);
      if (rest.length > 0 && ['to', 'কে', 'তে', 'section', 'সেকশনে', '-'].includes(rest[0].toLowerCase())) {
        rest.shift();
      }
      sectionName = cleanName(rest.join(' '));
    } else {
      const sepIndex = args.findIndex((a) => ['to', 'কে', 'তে', 'in'].includes(a.toLowerCase()));
      if (sepIndex > 0) {
        const empName = cleanName(args.slice(0, sepIndex).join(' '));
        sectionName = cleanName(
          args
            .slice(sepIndex + 1)
            .filter((w) => !['section', 'সেকশন', 'সেকশনে'].includes(w.toLowerCase()))
            .join(' ')
        );
        employee = await prisma.user.findFirst({
          where: { role: 'EMPLOYEE', name: { contains: empName, mode: 'insensitive' } },
        });
      } else if (args.length >= 2) {
        const empName = cleanName(args[0]);
        sectionName = cleanName(
          args
            .slice(1)
            .filter((w) => !['section', 'সেকশন', 'সেকশনে'].includes(w.toLowerCase()))
            .join(' ')
        );
        employee = await prisma.user.findFirst({
          where: { role: 'EMPLOYEE', name: { contains: empName, mode: 'insensitive' } },
        });
      }
    }

    if (!employee || employee.role !== 'EMPLOYEE') {
      return { reply: ask('কর্মীকে পাওয়া যায়নি। নাম বা ইমেইল সঠিকভাবে দিন: #assign <name/email> to <section>', 'Employee not found. Please provide name or email: #assign <name/email> to <section>') };
    }

    if (!sectionName) {
      return { reply: ask('সেকশনের নাম দিন।', 'Give the section name.') };
    }

    const section = await findSectionByName(sectionName);
    if (!section) {
      return { reply: ask(`"${sectionName}" সেকশন পাওয়া যায়নি।`, `Section "${sectionName}" not found.`) };
    }

    const existing = await prisma.assignment.findMany({
      where: { employee_id: employee.id, section_id: section.id },
    });
    if (existing.length > 0) {
      return {
        reply: ask(
          `${employee.name} আগে থেকেই "${section.name}" সেকশনে আছে।`,
          `${employee.name} is already assigned to "${section.name}".`
        ),
      };
    }

    if (!ctx.confirm) {
      return {
        reply: ask(
          `আমি ${employee.name} (${employee.email || employee.phone || 'কর্মী'}) কে সেকশন "${section.name}" এ যুক্ত করব। ${CONFIRM_BN}`,
          `I will assign ${employee.name} (${employee.email || employee.phone || 'Employee'}) to section "${section.name}". ${CONFIRM_EN}`
        ),
        needsConfirmation: true,
        pending: { command: 'assign', args },
      };
    }

    const assignment = await prisma.assignment.create({
      data: { employee_id: employee.id, section_id: section.id, assigned_by: ctx.actorId },
    });
    await createAuditLog({
      actorId: ctx.actorId,
      action: 'ASSIGN',
      entity: 'Assignment',
      entityId: assignment.id,
      payload: { employee: employee.name, section: section.name, via: 'agent' },
    });

    return {
      reply: ask(
        `${employee.name} কে সেকশন "${section.name}" এ যুক্ত করা হয়েছে।`,
        `${employee.name} assigned to "${section.name}".`
      ),
    };
  },
};

// ---------- #status ----------

const statusCommand: AgentCommand = {
  name: 'status',
  aliases: ['stats', 'আজ', 'অবস্থা'],
  descBn: 'আজকের সংক্ষিপ্ত অবস্থা',
  descEn: "Today's short status",
  usage: '#status',
  write: false,
  run: async () => {
    const [activeEmployees, sections, links, completedToday] = await Promise.all([
      prisma.user.count({ where: { role: 'EMPLOYEE', is_active: true } }),
      prisma.groupSection.count({}),
      prisma.groupLink.count({}),
      prisma.linkCompletion.count({
        where: { undone_at: null, completed_at: { gte: todayStartDhaka() } },
      }),
    ]);
    return {
      reply: [
        `আজকের অবস্থা (${getDhakaDateString()}, ${DHAKA_TIMEZONE}):`,
        `সক্রিয় কর্মী: ${activeEmployees} | সেকশন: ${sections} | লিংক: ${links} | আজ সম্পন্ন: ${completedToday}`,
        `Today: active employees ${activeEmployees}, sections ${sections}, links ${links}, completed today ${completedToday}`,
      ].join('\n'),
    };
  },
};

// ---------- #password (reset/set password) ----------

const passwordCommand: AgentCommand = {
  name: 'password',
  aliases: ['reset-password', 'set-password', 'resetpass', 'pass', 'পাসওয়ার্ড', 'রিসেট-পাসওয়ার্ড', 'পাসওয়ার্ড-রিসেট'],
  descBn: 'কর্মীর পাসওয়ার্ড সেট বা রিসেট করা',
  descEn: 'Set or reset an employee password',
  usage: '#password <email or name> <new-password>',
  write: true,
  run: async (args, ctx) => {
    let target = '';
    let newPassword = '';
    if (args.some((a) => a.includes('=') || a.includes(':'))) {
      const kv = parseEmployeeFields(args);
      target = kv.email || kv.name || '';
      newPassword = kv.password || '';
    } else if (args.length >= 2) {
      target = args.slice(0, -1).join(' ').trim();
      newPassword = args[args.length - 1].trim();
    }

    if (!target || !newPassword) {
      return {
        reply: ask(
          'কর্মীর নাম/ইমেইল এবং নতুন পাসওয়ার্ড দিন: #password <name/email> <new-password>',
          'Provide employee name/email and new password: #password <name/email> <new-password>'
        ),
      };
    }

    if (newPassword.length < 6) {
      return {
        reply: ask(
          'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
          'Password must be at least 6 characters long.'
        ),
      };
    }

    const allEmployees = await prisma.user.findMany({ where: { role: 'EMPLOYEE' } });
    const targetLower = target.toLowerCase();
    const employee = allEmployees.find(
      (e: any) =>
        e.email.toLowerCase() === targetLower ||
        e.name.toLowerCase() === targetLower ||
        e.name.toLowerCase().includes(targetLower)
    );

    if (!employee) {
      return {
        reply: ask(
          `কর্মী "${target}" খুঁজে পাওয়া যায়নি। #team লিখে তালিকা দেখুন।`,
          `Employee "${target}" not found. Type #team to see the employee list.`
        ),
      };
    }

    if (!ctx.confirm) {
      return {
        reply: ask(
          `আমি কর্মী "${employee.name}" (${employee.email})-এর পাসওয়ার্ড পরিবর্তন করব। পাসওয়ার্ড সেট হবে (দেখানো হবে না)। ${CONFIRM_BN}`,
          `I will change the password for employee "${employee.name}" (${employee.email}) (hidden). ${CONFIRM_EN}`
        ),
        needsConfirmation: true,
        pending: { command: 'password', args: [employee.email, newPassword] },
      };
    }

    const password_hash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: employee.id },
      data: { password_hash, password_changed_at: new Date() },
    });

    await createAuditLog({
      actorId: ctx.actorId,
      action: 'UPDATE',
      entity: 'User',
      entityId: employee.id,
      payload: { action: 'PASSWORD_RESET', name: employee.name, email: employee.email, role: 'EMPLOYEE', via: 'agent' },
    });

    return {
      reply: ask(
        `কর্মী "${employee.name}" (${employee.email})-এর পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।`,
        `Password updated successfully for employee "${employee.name}" (${employee.email}).`
      ),
    };
  },
};

const permissionCommand: AgentCommand = {
  name: 'permission',
  aliases: ['access', 'পারমিশন', 'অনুমতি'],
  descBn: 'কর্মীকে সব কাস্টমার দেখার অনুমতি দেওয়া বা বন্ধ করা',
  descEn: 'Grant or revoke full customer view permission for an employee',
  usage: '#permission <name or email> <grant/revoke>',
  write: true,
  run: async (args, ctx) => {
    if (!args.length) {
      return {
        reply: ask(
          'কর্মীর নাম বা ইমেইল এবং অনুমতি উল্লেখ করুন: #permission <name/email> <grant/revoke>',
          'Specify employee and action: #permission <name/email> <grant/revoke>'
        ),
      };
    }
    const isRevoke = args.some((a) =>
      ['revoke', 'remove', 'off', 'disable', 'bondho', 'বন্ধ'].includes(a.toLowerCase())
    );
    const grant = !isRevoke;
    const cleanArgs = args.filter(
      (a) =>
        ![
          'grant',
          'allow',
          'on',
          'enable',
          'dao',
          'দাও',
          'revoke',
          'remove',
          'off',
          'disable',
          'bondho',
          'বন্ধ',
        ].includes(a.toLowerCase())
    );
    const target = cleanName(cleanArgs.join(' '));
    if (!target) {
      return { reply: ask('কর্মীর নাম বা ইমেইল দিন।', 'Enter employee name or email.') };
    }

    const employee = await prisma.user.findFirst({
      where: {
        role: 'EMPLOYEE',
        OR: [{ email: target }, { name: { contains: target, mode: 'insensitive' } }],
      },
    });

    if (!employee) {
      return { reply: ask(`"${target}" নামের কর্মী পাওয়া যায়নি।`, `Employee "${target}" not found.`) };
    }

    if (!ctx.confirm) {
      return {
        reply: ask(
          `আমি ${employee.name} (${employee.email || employee.phone || 'কর্মী'}) কে সম্পূর্ণ কাস্টমার ডেটাবেস দেখার অনুমতি ${
            grant ? 'প্রদান' : 'বন্ধ'
          } করব। ${CONFIRM_BN}`,
          `I will ${grant ? 'grant' : 'revoke'} full customer database view access for ${employee.name}. ${CONFIRM_EN}`
        ),
        needsConfirmation: true,
        pending: { command: 'permission', args },
      };
    }

    await prisma.user.update({
      where: { id: employee.id },
      data: { can_view_all_customers: grant },
    });

    await createAuditLog({
      actorId: ctx.actorId,
      action: 'UPDATE',
      entity: 'User',
      entityId: employee.id,
      payload: { name: employee.name, can_view_all_customers: grant, via: 'agent' },
    });

    return {
      reply: ask(
        `${employee.name} এর জন্য সম্পূর্ণ কাস্টমার ডেটাবেস দেখার অনুমতি ${
          grant ? 'চালু' : 'বন্ধ'
        } করা হয়েছে।`,
        `Full customer database view access ${grant ? 'granted' : 'revoked'} for ${employee.name}.`
      ),
    };
  },
};

// ---------- registry ----------

export const COMMANDS: AgentCommand[] = [
  helpCommand,
  groupsCommand,
  linksCommand,
  teamCommand,
  assignCommand,
  permissionCommand,
  statusCommand,
  passwordCommand,
];

export function findCommand(name: string): AgentCommand | null {
  const key = name.trim().toLowerCase();
  return COMMANDS.find((c) => c.name === key || c.aliases.some((a) => a.toLowerCase() === key)) ?? null;
}

/** Runs a command by name. Never throws: failures become a short reply. */
export async function executeCommand(name: string, args: string[], ctx: AgentContext): Promise<AgentResult> {
  const command = findCommand(name);
  if (!command) {
    return {
      reply: ask(`"#${name}" নামে কোনো কমান্ড নেই। #help লিখে তালিকা দেখুন।`, `Unknown command "#${name}". Type #help for the list.`),
    };
  }
  try {
    return await command.run(args, ctx);
  } catch (error) {
    console.error(`Agent command #${command.name} failed:`, error);
    return { reply: ask('কাজটি সম্পন্ন করা যায়নি।', 'The action could not be completed.') };
  }
}
