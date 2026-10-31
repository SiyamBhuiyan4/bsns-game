import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { executeCommand, type AgentResult } from '@/lib/agent/commands';
import { navigate, type NavLink } from '@/lib/agent/navigator';
import { resolveDateString } from '@/lib/agent/date-parser';
import { OFF_TOPIC } from '@/lib/agent/knowledge';
import {
  getDhakaDateString,
  parseDateOnly,
  formatTaka,
  toBengaliDigits,
  formatBstDateTime,
} from '@/lib/date';
import { calculateEffectiveTargetsForRange } from '@/lib/targets';
import { calculateEmployeeScore, selectEmployeeTargets, readSectionWeights } from '@/lib/scoring';
import { MetricType, AuditAction } from '@prisma/client';

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface GeminiAgentInput {
  message: string;
  actorId: string;
  history?: ChatHistoryTurn[];
}

export interface GeminiAgentOutput extends AgentResult {
  link?: NavLink;
  suggestions?: NavLink[];
  navigate?: boolean;
}

// Lowest-cost & highest free-tier quota models prioritized first:
// gemini-3.5-flash-lite has the highest RPM/RPD limits and lowest cost per token.
const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

/**
 * Reads GEMINI_API_KEY from environment or directly from .env.local / .env file if needed.
 */
function getGeminiApiKey(): string {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const cwd = process.cwd();
    const envLocalPath = path.join(cwd, '.env.local');
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, 'utf-8');
      const match = content.match(/^GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        process.env.GEMINI_API_KEY = match[1].trim();
        return match[1].trim();
      }
    }
    const envPath = path.join(cwd, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/^GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        process.env.GEMINI_API_KEY = match[1].trim();
        return match[1].trim();
      }
    }
  } catch (err) {
    console.error('[GeminiAgent] Failed reading env file:', err);
  }
  return '';
}

// Function Calling declarations covering the entire business suite
const AGENT_TOOLS = [
  {
    name: 'get_employee_assigned_tasks',
    description:
      'Fetches and displays the specific sections, link tasks, daily post limits, and targets assigned to an employee. ALWAYS call this tool when the user asks to see tasks or sections assigned to an employee (e.g. "or upor assign kora task dekhte chaitasi", "siyam er task dekhao", "show his assigned tasks", "what tasks are assigned to him"). Remember: pronouns like "or" (ওর), "tar" (তার), "him" refer to the employee discussed previously!',
    parameters: {
      type: 'OBJECT',
      properties: {
        employee: {
          type: 'STRING',
          description:
            'The name or email of the employee. If referring to someone mentioned in previous turns (e.g. "or", "him"), supply their name directly (e.g. "siyam").',
        },
      },
      required: ['employee'],
    },
  },
  {
    name: 'get_employee_report',
    description:
      'Fetches and calculates the detailed performance report for a specific employee on a specific date (posts done, sales, profit, new clients, B2B, targets, score, pass/fail status, and daily reflection/issues). Call this when user asks for an employee\'s report (e.g. "siyam er kalker report dekhao", "yesterday report of siyam", "show his daily report", "siyam er ajker obostha").',
    parameters: {
      type: 'OBJECT',
      properties: {
        employee: {
          type: 'STRING',
          description:
            'The name or email of the employee (e.g. "siyam", "abu"). Resolve pronouns ("or", "tar") to the discussed person.',
        },
        date: {
          type: 'STRING',
          description:
            'The target date or relative date phrase: "yesterday", "kalker", "today", "ajker", "poroshur", or YYYY-MM-DD.',
        },
      },
      required: ['employee'],
    },
  },
  {
    name: 'get_audit_logs',
    description:
      'Queries system audit activity logs (who logged in, who created/updated employees, sections, links, targets, leads, passwords). Call this when user asks "ke login korse", "audit log dekhao", "who changed what", "show recent activity".',
    parameters: {
      type: 'OBJECT',
      properties: {
        actor: { type: 'STRING', description: 'Optional user name or email filter' },
        action: { type: 'STRING', description: 'Optional action filter like LOGIN, CREATE, UPDATE, DELETE, ASSIGN' },
        limit: { type: 'INTEGER', description: 'Number of logs to fetch (default 8)' },
      },
    },
  },
  {
    name: 'get_lead_stats',
    description:
      'Queries customer leads pipeline, conversion numbers, total sales from orders, expected values, and stalled qualified leads. Call when user asks "leads kemon", "customer obostha", "koyta order hoise".',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: { type: 'STRING', description: '"today", "yesterday", "7d", "30d", or "all"' },
        marketer: { type: 'STRING', description: 'Optional employee / marketer name' },
      },
    },
  },
  {
    name: 'list_products',
    description: 'Lists all available products in catalog with selling prices and units.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'list_campaigns',
    description: 'Lists active marketing campaigns, budgets, and channel sources.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'navigate_to_page',
    description:
      'Directly opens and navigates the user to a page across the web app whenever the user wants to visit, open, or switch to a page (e.g. employees / team, dashboard, sections/groups, products, campaigns, leads, targets, daily report, 90-day plan, audit log, settings, manual).',
    parameters: {
      type: 'OBJECT',
      properties: {
        page_intent: {
          type: 'STRING',
          enum: [
            'team',
            'groups',
            'leads',
            'products',
            'campaigns',
            'targets',
            'dashboard',
            'reports_daily',
            'reports_weekly',
            'reports_monthly',
            'plan',
            'audit',
            'settings',
            'manual',
          ],
          description:
            'The specific page to navigate to: team (employees), groups (sections/links), leads, products, campaigns, targets, dashboard, reports_daily, plan, audit, settings, manual.',
        },
      },
      required: ['page_intent'],
    },
  },
  {
    name: 'get_status_summary',
    description:
      'Fetches today\'s live operational statistics: number of active employees, total sections, total links, and total completed links for today.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'list_employees',
    description: 'Lists all employees with their emails, IDs, and active status.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'check_employee_exists',
    description: 'Checks if an employee with a given name or email exists in the system.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Name or email of the employee to check' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_employee',
    description:
      'Creates a new employee profile with safe preview confirmation. Requires name and password.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Name of the employee' },
        password: { type: 'STRING', description: 'Initial login password (min 6 chars)' },
        email: { type: 'STRING', description: 'Optional email address' },
        phone: { type: 'STRING', description: 'Optional phone number' },
      },
      required: ['name', 'password'],
    },
  },
  {
    name: 'reset_employee_password',
    description: 'Resets or sets a new password for an existing employee by their name or email.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', description: 'Employee name or email address' },
        new_password: { type: 'STRING', description: 'The new password (min 6 chars)' },
      },
      required: ['target', 'new_password'],
    },
  },
  {
    name: 'list_sections',
    description: 'Lists all group sections in the system along with active status.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'create_section',
    description: 'Creates a new section / group category (e.g. "Agro", "Dhaka Group", "Retailers").',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Section name (2-100 characters)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_section_links',
    description: 'Adds one or multiple Facebook / web URLs to a specific section.',
    parameters: {
      type: 'OBJECT',
      properties: {
        section_name: { type: 'STRING', description: 'Name of the destination section' },
        urls: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'List of URL strings to add',
        },
      },
      required: ['section_name', 'urls'],
    },
  },
  {
    name: 'assign_employee_to_section',
    description: 'Assigns an employee to a section so they can complete the group tasks.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employee: { type: 'STRING', description: 'Employee name or email' },
        section_name: { type: 'STRING', description: 'Section name to assign to' },
      },
      required: ['employee', 'section_name'],
    },
  },
  {
    name: 'set_employee_permission',
    description: 'Grants or revokes access for an employee to view all customer/leads database.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employee: { type: 'STRING', description: 'Employee name or email' },
        grant: { type: 'BOOLEAN', description: 'true to grant view all customers, false to revoke' },
      },
      required: ['employee', 'grant'],
    },
  },
  {
    name: 'clarify_and_offer_options',
    description:
      'ALWAYS call this tool when the user request is broad, ambiguous, has multiple possibilities, or when the user should pick an option before executing an action (e.g. "কর্মী দেখতে চাই", "রিপোর্ট দেখাও", "টার্গেট বদলাবো", "সিয়ামের কাজ করব", "নতুন এন্ট্রি দেব", "লিড বা কাস্টমার দেখাও"). Provides clarification text and interactive clickable option buttons (each with label and the action query to run on click).',
    parameters: {
      type: 'OBJECT',
      properties: {
        clarification: {
          type: 'STRING',
          description:
            'Clarifying message in Bengali & English explaining the possibilities or asking which specific item/action the user wants to execute.',
        },
        options: {
          type: 'ARRAY',
          description: 'Array of clickable options that will be executed when clicked.',
          items: {
            type: 'OBJECT',
            properties: {
              labelBn: { type: 'STRING', description: 'Short button label in Bengali' },
              labelEn: { type: 'STRING', description: 'Short button label in English' },
              actionQuery: { type: 'STRING', description: 'The exact query to execute when clicked (e.g. "সিয়ামের অ্যাসাইন করা টাস্ক দেখাও", "আজকের দৈনিক রিপোর্ট দেখাও")' },
              href: { type: 'STRING', description: 'Optional page route to open' },
            },
            required: ['labelBn', 'labelEn', 'actionQuery'],
          },
        },
      },
      required: ['clarification', 'options'],
    },
  },
  {
    name: 'refuse_off_topic',
    description:
      'MUST be called when the user asks an off-topic question unrelated to the Game of Business marketing platform (e.g. general programming code like C++ or Python, hello world, homework, sports, cooking, jokes, etc.).',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING', description: 'The off-topic subject detected (e.g. "C++ code", "cooking", "trivia")' },
      },
    },
  },
  {
    name: 'get_today_targets',
    description:
      'Fetches today\'s active performance targets and achievement overview across all sections and employees.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

const SYSTEM_INSTRUCTION = `
You are the Executive AI Agent for "Game of Business" (Marketing Performance Management System).
You understand English, Bengali (বাংলা), and Banglish seamlessly.
You have full authority to assist the admin, inspect database records, calculate performance, navigate pages, and execute administrative actions.

STRICT BOUNDARY & OFF-TOPIC REFUSAL RULE (HIGHEST PRIORITY):
1. You are EXCLUSIVELY the internal AI Agent for this Marketing Performance Platform.
2. You are ONLY permitted to assist with topics directly within this web application:
   - Employees & Team Management (list, tasks, add, reset password, permissions)
   - Customers & Leads Pipeline (check leads, stats, status, customer list, search phone)
   - Group Sections & Link Tasks (sections, links, assign marketer)
   - Tasks & Targets (set section target, set employee target, today targets, scores)
   - Performance Reports (daily, weekly, monthly reports, sales, profit, B2B)
   - 90-Day Action Plan (phases, milestones, tasks)
   - Products Catalog (prices, products list, units)
   - Marketing Campaigns & Ad Spend (budgets, campaign status, ROAS)
   - System Settings & Audit Logs (activity, who did what, logins)
   - System Page Navigation
3. STRICTLY FORBIDDEN:
   - Writing general programming code (e.g. C++, Java, Python, C#, PHP, algorithms, hello world).
   - Answering school/college homework, math puzzles, recipes/cooking, poems, movie/song queries, sports scores, politics, or general chit-chat.
4. When an off-topic query is asked (e.g. "c++ code deo", "hello world code", "write python script", "ranna recipe"):
   You MUST call "refuse_off_topic" or decline politely in bilingual format and offer valid platform options! NEVER write C++ or non-platform code.

INTERACTIVE CLARIFICATION & OPTIONS RULE:
1. When a user asks something broad, general, ambiguous, or multi-step (e.g. "কর্মী দেখতে চাই", "রিপোর্ট দেখাও", "টার্গেট বদলাবো", "সিয়ামের কাজ করব", "নতুন এন্ট্রি দেব", "লিড বা কাস্টমার দেখাও"):
   You MUST call "clarify_and_offer_options"!
2. Clarify clearly what options exist in Bengali & English, and provide 2-5 clickable options with explicit "actionQuery".
3. When the user clicks an option, the system sends that exact actionQuery to you, and you MUST execute the action immediately and show the full data in the chat!

AUTONOMOUS EXECUTION & DATA RETRIEVAL RULE:
1. Multi-turn Entity Memory & Pronouns:
   - In Bengali/Banglish: "or" (ওর), "tar" (তার), "o" (ও), "uni" (উনি), "his", "him", "her", "that person" REFER TO THE PERSON DISCUSSED IN THE IMMEDIATELY PRECEDING TURNS.
   - Example:
     Turn 1: User says "siyam kar nam bolo to" -> Agent answers about "siyam".
     Turn 2: User says "to ami or upor assign kora task dekhte chaitasi" -> "or" MEANS "siyam"!
     You MUST call get_employee_assigned_tasks(employee: "siyam").
     NEVER navigate to generic "groups" or "team" when the user wants to see an employee's assigned tasks or performance!
   - Example:
     User says "siyam er kalker report dekhao" -> Call get_employee_report(employee: "siyam", date: "yesterday").
     User says "ami or report dekhte chaisi specifically" -> Call get_employee_report(employee: "siyam", date: "yesterday").

2. Provide Specific Data First:
   - When the user asks for specific reports, tasks, audit trails, leads, products, campaigns, or employee status, ALWAYS call the corresponding specific tool so the user gets actual data and answers directly in the chat!
   - Do NOT just navigate away to a generic page unless the user solely instructed to open or view a page without data query intent.

3. Dates & Relative Time:
   - "kalker", "kalke", "yesterday", "গতকাল" means yesterday (Asia/Dhaka).
   - "ajker", "aj", "today", "আজ" means today (Asia/Dhaka).
   - "poroshur", "poroshu", "day before yesterday", "গত পরশু" means 2 days ago.

4. Bilingual Output:
   - Always respond clearly with helpful Bengali and English details.
`;

/**
 * Fallback helper to discover the last employee mentioned in history turns
 */
function findLastMentionedEmployee(history: ChatHistoryTurn[], fallback: string): string {
  const pronounTokens = new Set([
    'or', 'tar', 'o', 'uni', 'take', 'tader', 'him', 'her', 'his', 'he', 'she', 'they', 'them',
    'কর্মী', 'ওর', 'তার', 'তাকে', 'তাদের', 'তিনি', 'উনি'
  ]);
  const trimmedFallback = fallback.trim();
  if (trimmedFallback && !pronounTokens.has(trimmedFallback.toLowerCase())) {
    return trimmedFallback;
  }

  for (let i = history.length - 1; i >= 0; i--) {
    const text = history[i].text;
    // Check for common names, emails, or name tokens in recent history
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
    if (emailMatch) return emailMatch[0];

    const nameMatch = text.match(/\b(?:siyam|siam|abu|sumaiya|hasan|jamal|rahim|karim|tanvir|nafis|rony|সিয়াম|সিয়াম|আবু|সুহেনা|হাসান|জামাল|রহিম|করিম)\b/i);
    if (nameMatch) {
      return nameMatch[0];
    }
  }
  return fallback;
}

/**
 * Detects if a message is asking for something completely outside the scope
 * of the internal Game of Business marketing management platform (e.g. C++, Python,
 * recipes, weather, general homework, sports).
 */
export function isOffTopicQuery(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();

  // Explicit off-topic regex patterns
  const offTopicPatterns = [
    // Programming languages / coding requests
    /\b(?:c\+\+|cpp|csharp|c#|python|java|javascript|typescript|golang|rust|ruby|php|swift|kotlin|html|css|sql\s*injection)\b/i,
    /\b(?:hello\s*world|leetcode|hackerrank|algorithm|source\s*code|print\s*code|write\s*code|coding|programmer|programming)\b/i,
    /\b(?:কোডিং|কোড|প্রোগ্রাম|প্রোগ্রামিং|অ্যালগরিদম|সোর্স\s*কোড)\b/i,
    // General sports / entertainment / non-platform topics
    /\b(?:cricket|football|world\s*cup|weather|rain|temperature|recipe|cooking|movie|cinema|song|music|joke|jokes|poem|poetry)\b/i,
    /\b(?:ফুটবল|ক্রিকেট|খেলা|আবহাওয়া|বৃষ্টি|তাপমাত্রা|রান্না|রেসিপি|সিনেমা|গান|কবিতা|জোকস|কৌতুক)\b/i,
    // Other off-topic domains
    /\b(?:bitcoin|cryptocurrency|crypto|diet|gym|homework|essay|president|capital\s*city)\b/i,
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(lower)) {
      return true;
    }
  }

  // Token matching against OFF_TOPIC (excluding emails and numbers)
  const sanitized = lower.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
  const tokens = sanitized.split(/[^a-zA-Z0-9\u0980-\u09FF+#]+/);
  for (const t of tokens) {
    if (t && OFF_TOPIC.has(t)) {
      return true;
    }
  }

  return false;
}

export function createOffTopicRefusal(): GeminiAgentOutput {
  return {
    reply: `দুঃখিত, আমি শুধুমাত্র এই মার্কেটিং পারফরম্যান্স ম্যানেজমেন্ট সিস্টেমের (Game of Business) অভ্যন্তরীণ কাজ, কর্মী, রিপোর্ট, টাস্ক, লিড, পণ্য এবং ক্যাম্পেইন সংক্রান্ত বিষয়ে সহায়তা করতে পারি। সাধারণ কোডিং (C++, Python), সাধারণ জ্ঞান বা প্ল্যাটফর্মের বাইরের কোনো প্রশ্নের উত্তর দিতে আমি অনুমোদিত নই।\n\nSorry, I can only assist with internal operations of this Marketing Performance Management System (Game of Business), including employees, reports, tasks, targets, leads, products, and campaigns. I am restricted from answering external questions, general coding (C++, Python), homework, or off-topic queries.`,
    suggestions: [
      {
        labelBn: 'আজকের দৈনিক রিপোর্ট',
        labelEn: "Today's Daily Report",
        actionQuery: 'আজকের দৈনিক রিপোর্ট দেখাও',
        href: '/admin/reports/daily',
      },
      {
        labelBn: 'সকল কর্মী তালিকা',
        labelEn: 'All Employees List',
        actionQuery: 'সকল কর্মীর তালিকা দেখাও',
        href: '/admin/employees',
      },
      {
        labelBn: 'আজকের টার্গেট সামারি',
        labelEn: "Today's Target Summary",
        actionQuery: 'আজকের টার্গেট সামারি দেখাও',
        href: '/admin/targets',
      },
      {
        labelBn: 'কাস্টমার ও লিড পাইপলাইন',
        labelEn: 'Customers & Leads',
        actionQuery: 'লিড স্ট্যাটিস্টিক্স দেখাও',
        href: '/admin/leads',
      },
    ],
  };
}

/**
 * Executes an AI Agent turn using Google Gemini API with fallback support.
 */
export async function runGeminiAgent(
  input: GeminiAgentInput
): Promise<GeminiAgentOutput | null> {
  const { message, actorId, history = [] } = input;

  // Immediate deterministic guardrail against off-topic queries (zero-latency refusal)
  if (isOffTopicQuery(message)) {
    return createOffTopicRefusal();
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const ctx = { actorId, confirm: false };

  // Prepare multi-turn conversation contents strictly adhering to Gemini API rules:
  // Starts with 'user', strictly alternates 'user' -> 'model' -> 'user'
  const contentsPayload: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  const candidateTurns = history.slice(-6);
  for (const turn of candidateTurns) {
    if (!turn.text || !turn.text.trim()) continue;
    const mappedRole = turn.role === 'assistant' ? 'model' : 'user';

    // Must start with 'user'
    if (contentsPayload.length === 0 && mappedRole !== 'user') {
      continue;
    }

    // Avoid consecutive same-role turns
    const last = contentsPayload[contentsPayload.length - 1];
    if (last && last.role === mappedRole) {
      last.parts[0].text += '\n' + turn.text.trim();
    } else {
      contentsPayload.push({
        role: mappedRole,
        parts: [{ text: turn.text.trim() }],
      });
    }
  }

  // Append current user message
  const last = contentsPayload[contentsPayload.length - 1];
  if (last && last.role === 'user') {
    last.parts[0].text += '\n' + message;
  } else {
    contentsPayload.push({
      role: 'user',
      parts: [{ text: message }],
    });
  }

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: contentsPayload,
    tools: [
      {
        functionDeclarations: AGENT_TOOLS,
      },
    ],
  };

  let candidate: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        const data = await res.json();
        candidate = data.candidates?.[0];
        if (candidate) break;
      } else {
        const errText = await res.text();
        console.warn(`[GeminiAgent] Model ${model} returned ${res.status}: ${errText}`);
      }
    } catch (err) {
      console.warn(`[GeminiAgent] Model ${model} fetch failed:`, err);
    }
  }

  if (!candidate) {
    return null;
  }

  const parts = candidate.content?.parts || [];
  const callPart = parts.find((p: any) => p.functionCall);

  if (callPart?.functionCall) {
    const call = callPart.functionCall;
    const fnName = call.name;
    const args = call.args || {};

    switch (fnName) {
      // 1. Employee Assigned Tasks & Sections
      case 'get_employee_assigned_tasks':
      case 'get_employee_tasks': {
        const rawTarget = (args.employee || args.name || '').trim();
        const resolvedName = findLastMentionedEmployee(history, rawTarget);

        if (!resolvedName) {
          return {
            reply: 'অনুগ্রহ করে কর্মীর নাম উল্লেখ করুন (যেমন: "সিয়াম")।\nPlease specify which employee you want to inspect (e.g. "siyam").',
            link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' },
          };
        }

        const employee = await prisma.user.findFirst({
          where: {
            role: 'EMPLOYEE',
            OR: [
              { name: { contains: resolvedName, mode: 'insensitive' } },
              { email: { contains: resolvedName, mode: 'insensitive' } },
            ],
          },
          include: {
            assignments_as_employee: {
              include: {
                section: true,
              },
            },
          },
        });

        if (!employee) {
          return {
            reply: `"${resolvedName || rawTarget}" নামে কোনো কর্মী খুঁজে পাওয়া যায়নি।\nNo employee found with name "${resolvedName || rawTarget}".`,
            link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' },
          };
        }

        // Fetch Dhaka day bounds
        const todayStr = getDhakaDateString();
        const startOfDhakaDay = new Date(`${todayStr}T00:00:00+06:00`);
        const endOfDhakaDay = new Date(`${todayStr}T23:59:59.999+06:00`);

        // Fetch today's completions for this employee
        const todayCompletions = await prisma.linkCompletion.findMany({
          where: {
            employee_id: employee.id,
            undone_at: null,
            completed_at: { gte: startOfDhakaDay, lte: endOfDhakaDay },
          },
          include: {
            group_link: true,
          },
        });

        const activeAssignments = employee.assignments_as_employee.filter((a: any) => a.section?.is_active);

        const lines: string[] = [
          `👤 **${employee.name} (${employee.email}) - এর দায়িত্ব ও টাস্ক বিবরণ:**`,
          `📅 আজকের তারিখ: ${todayStr}`,
          `✅ আজ সম্পন্ন লিংক পোস্ট: ${toBengaliDigits(todayCompletions.length)} টি`,
          '',
          `📂 **বরাদ্দকৃত সেকশনসমূহ (${activeAssignments.length}টি):**`,
        ];

        if (activeAssignments.length === 0) {
          lines.push('• বর্তমানে কোনো সেকশন বরাদ্দ করা নেই (No active sections assigned).');
        } else {
          for (const a of activeAssignments) {
            const completedForSection = todayCompletions.filter(
              (c) => c.group_link?.section_id === a.section_id
            ).length;
            const quota = a.post_limit ? `${a.post_limit}টি/দিন` : 'অনির্দিষ্ট (No limit)';
            lines.push(
              `• **${a.section.name}**: আজ সম্পন্ন: ${toBengaliDigits(completedForSection)} টি | কোটা: ${quota}`
            );
          }
        }

        return {
          reply: lines.join('\n'),
          link: {
            href: `/admin/employees?q=${encodeURIComponent(employee.name)}`,
            labelBn: `${employee.name}-এর প্রোফাইল দেখুন`,
            labelEn: `View ${employee.name}'s Profile`,
          },
          suggestions: [
            {
              href: `/admin/reports/daily?date=${todayStr}&q=${encodeURIComponent(employee.name)}`,
              labelBn: `${employee.name}-এর আজকের রিপোর্ট`,
              labelEn: `${employee.name}'s Today Report`,
            },
            {
              href: '/admin/sections',
              labelBn: 'গ্রুপ ও লিংক পেজ',
              labelEn: 'Groups & Links Page',
            },
          ],
        };
      }

      // 2. Specific Employee Daily Report
      case 'get_employee_report':
      case 'get_employee_daily_report': {
        const rawTarget = (args.employee || args.name || '').trim();
        const resolvedName = findLastMentionedEmployee(history, rawTarget);
        const dateInput = (args.date || message).toString();
        const targetDateStr = resolveDateString(dateInput);
        const targetDate = parseDateOnly(targetDateStr);

        if (!resolvedName) {
          return {
            reply: 'অনুগ্রহ করে কর্মীর নাম উল্লেখ করুন (যেমন: "সিয়াম")।\nPlease specify which employee\'s report you want to view (e.g. "siyam").',
            link: { href: `/admin/reports/daily?date=${targetDateStr}`, labelBn: 'দৈনিক রিপোর্ট পেজে যান', labelEn: 'Go to Daily Reports' },
          };
        }

        const employee = await prisma.user.findFirst({
          where: {
            role: 'EMPLOYEE',
            OR: [
              { name: { contains: resolvedName, mode: 'insensitive' } },
              { email: { contains: resolvedName, mode: 'insensitive' } },
            ],
          },
          include: {
            assignments_as_employee: {
              include: { section: true },
            },
          },
        });

        if (!employee) {
          return {
            reply: `"${resolvedName || rawTarget}" নামে কোনো কর্মী খুঁজে পাওয়া যায়নি।\nNo employee found with name "${resolvedName || rawTarget}".`,
            link: { href: `/admin/reports/daily?date=${targetDateStr}`, labelBn: 'দৈনিক রিপোর্ট পেজ', labelEn: 'Daily Reports' },
          };
        }

        const dayStartUtc = new Date(`${targetDateStr}T00:00:00+06:00`);
        const dayEndUtc = new Date(`${targetDateStr}T23:59:59.999+06:00`);

        const [allTargets, postsCount, entries, dailyText, settings] = await Promise.all([
          prisma.sectionTarget.findMany(),
          prisma.linkCompletion.count({
            where: {
              employee_id: employee.id,
              completed_at: { gte: dayStartUtc, lte: dayEndUtc },
              undone_at: null,
            },
          }),
          prisma.dailyEntry.findMany({
            where: { employee_id: employee.id, entry_date: targetDate },
          }),
          prisma.dailyText.findUnique({
            where: {
              employee_id_entry_date: { employee_id: employee.id, entry_date: targetDate },
            },
          }),
          prisma.scoringSettings.findUnique({ where: { id: 'default' } }),
        ]);

        const assignedSectionIds = employee.assignments_as_employee.map((a: any) => a.section_id);
        const empTargets = selectEmployeeTargets(allTargets, employee.id, assignedSectionIds);
        const dailyTargets = calculateEffectiveTargetsForRange(empTargets, targetDate, targetDate);

        const metricMap: Record<string, number> = {
          POSTS_DONE: postsCount,
          SALES_AMOUNT: 0,
          PROFIT_AMOUNT: 0,
          NEW_CLIENTS: 0,
          B2B_ORDERS: 0,
          RETENTION_COUNT: 0,
          FOLLOWUPS_DONE: 0,
        };

        for (const e of entries) {
          if (e.metric_type !== MetricType.POSTS_DONE) {
            metricMap[e.metric_type] = Number(e.value);
          }
        }

        const cap = settings ? Number(settings.achievement_cap) : 1.0;
        const failingThreshold = settings ? Number(settings.failing_threshold) : 0.8;
        const sectionWeights = readSectionWeights(settings);

        const scoringInput = {
          [MetricType.POSTS_DONE]: { target: dailyTargets.POSTS_DONE || null, achieved: metricMap.POSTS_DONE },
          [MetricType.SALES_AMOUNT]: { target: dailyTargets.SALES_AMOUNT || null, achieved: metricMap.SALES_AMOUNT },
          [MetricType.PROFIT_AMOUNT]: { target: dailyTargets.PROFIT_AMOUNT || null, achieved: metricMap.PROFIT_AMOUNT },
          [MetricType.NEW_CLIENTS]: { target: dailyTargets.NEW_CLIENTS || null, achieved: metricMap.NEW_CLIENTS },
          [MetricType.B2B_ORDERS]: { target: dailyTargets.B2B_ORDERS || null, achieved: metricMap.B2B_ORDERS },
          [MetricType.RETENTION_COUNT]: { target: dailyTargets.RETENTION_COUNT || null, achieved: metricMap.RETENTION_COUNT },
          [MetricType.FOLLOWUPS_DONE]: { target: dailyTargets.FOLLOWUPS_DONE || null, achieved: metricMap.FOLLOWUPS_DONE },
        };

        const scoreResult = calculateEmployeeScore(scoringInput, {
          achievementCap: cap,
          failingThreshold,
          sectionWeights,
          lang: 'bn',
        });

        const statusLabel = scoreResult.isFailing ? 'উন্নতি প্রয়োজন (Fail)' : 'পাস (Pass)';

        const reportLines = [
          `📊 **${employee.name}-এর দৈনিক পারফরম্যান্স রিপোর্ট (${targetDateStr}):**`,
          `• মোট স্কোর: **${scoreResult.totalScore}/১০০** (${statusLabel})`,
          `• পোস্ট সম্পন্ন: **${toBengaliDigits(metricMap.POSTS_DONE)}** টি ${dailyTargets.POSTS_DONE ? `(টার্গেট: ${toBengaliDigits(dailyTargets.POSTS_DONE)})` : ''}`,
          `• বিক্রয়: **${formatTaka(metricMap.SALES_AMOUNT)}** | মুনাফা: **${formatTaka(metricMap.PROFIT_AMOUNT)}**`,
          `• নতুন কাস্টমার / লিড: **${toBengaliDigits(metricMap.NEW_CLIENTS)}** টি | B2B অর্ডার: **${toBengaliDigits(metricMap.B2B_ORDERS)}** টি`,
          `• ফলোআপ সম্পন্ন: **${toBengaliDigits(metricMap.FOLLOWUPS_DONE)}** টি | রিটেনশন: **${toBengaliDigits(metricMap.RETENTION_COUNT)}** টি`,
        ];

        if (dailyText?.main_issue) {
          reportLines.push(`• প্রধান সমস্যা / বাধা: "${dailyText.main_issue}"`);
        }
        if (dailyText?.next_priorities) {
          reportLines.push(`• পরবর্তী অগ্রাধিকার: "${dailyText.next_priorities}"`);
        }

        return {
          reply: reportLines.join('\n'),
          link: {
            href: `/admin/reports/daily?date=${targetDateStr}&q=${encodeURIComponent(employee.name)}`,
            labelBn: `${employee.name}-এর রিপোর্ট পেজে দেখুন`,
            labelEn: `View ${employee.name}'s Report Page`,
          },
          suggestions: [
            {
              href: `/admin/employees?q=${encodeURIComponent(employee.name)}`,
              labelBn: `${employee.name}-এর প্রোফাইল ও কাজ`,
              labelEn: `${employee.name}'s Profile & Tasks`,
            },
          ],
        };
      }

      // 3. Audit Activity Logs
      case 'get_audit_logs':
      case 'query_audit_logs': {
        const where: any = {};
        if (args.actor) {
          where.actor = {
            OR: [
              { name: { contains: args.actor, mode: 'insensitive' } },
              { email: { contains: args.actor, mode: 'insensitive' } },
            ],
          };
        }
        if (args.action && Object.values(AuditAction).includes(args.action)) {
          where.action = args.action;
        }

        const takeLimit = Math.max(1, Math.min(20, args.limit || 8));
        const logs = await prisma.auditLog.findMany({
          where,
          take: takeLimit,
          orderBy: { created_at: 'desc' },
          include: {
            actor: {
              select: { name: true, email: true, role: true },
            },
          },
        });

        if (logs.length === 0) {
          return {
            reply: 'কোনো অডিট লগ পাওয়া যায়নি।\nNo audit logs found.',
            link: { href: '/admin/audit', labelBn: 'অডিট লগ পেজে যান', labelEn: 'Go to Audit Log' },
          };
        }

        const logLines = [
          `🛡️ **সাম্প্রতিক অডিট লগ (${logs.length}টি রেকর্ড):**`,
          ...logs.map((l, i) => {
            const time = formatBstDateTime(l.created_at, 'en');
            const who = l.actor?.name || 'System';
            return `${toBengaliDigits(i + 1)}. [${time}] **${who}**: ${l.action} (${l.entity})`;
          }),
        ];

        return {
          reply: logLines.join('\n'),
          link: { href: '/admin/audit', labelBn: 'সম্পূর্ণ অডিট লগ দেখুন', labelEn: 'View Full Audit Log' },
        };
      }

      // 4. Lead and Customer Pipeline Stats
      case 'get_lead_stats': {
        const [total, ordered, qualified, contact, newLeads, orderedSum] = await Promise.all([
          prisma.lead.count(),
          prisma.lead.count({ where: { status: 'ORDERED' } }),
          prisma.lead.count({ where: { status: 'QUALIFIED' } }),
          prisma.lead.count({ where: { status: 'CONTACTED' } }),
          prisma.lead.count({ where: { status: 'NEW' } }),
          prisma.lead.aggregate({ where: { status: 'ORDERED' }, _sum: { order_amount: true } }),
        ]);

        const totalSales = Number(orderedSum._sum.order_amount || 0);
        const conversion = total > 0 ? ((ordered / total) * 100).toFixed(1) : '0';

        const leadLines = [
          `👥 **কাস্টমার ও লিড পাইপলাইন সারসংক্ষেপ:**`,
          `• মোট লিড: **${toBengaliDigits(total)}** টি`,
          `• নিশ্চিত অর্ডার: **${toBengaliDigits(ordered)}** টি (${conversion}% কনভার্সন)`,
          `• অর্ডারকৃত মোট বিক্রয়: **${formatTaka(totalSales)}**`,
          `• সক্রিয় স্ট্যাটাস: নতুন ${toBengaliDigits(newLeads)} | যোগাযোগ ${toBengaliDigits(contact)} | কোয়ালিফাইড ${toBengaliDigits(qualified)}`,
        ];

        return {
          reply: leadLines.join('\n'),
          link: { href: '/admin/leads', labelBn: 'লিড ম্যানেজমেন্ট পেজে যান', labelEn: 'Go to Leads Management' },
        };
      }

      // 5. Product Catalog
      case 'list_products': {
        const products = await prisma.product.findMany({
          where: { is_active: true },
          take: 15,
          orderBy: { name_bn: 'asc' },
          include: {
            sales: {
              select: { quantity: true, amount: true },
            },
          },
        });

        if (products.length === 0) {
          return {
            reply: 'কোনো সক্রিয় পণ্য তালিকাভুক্ত নেই।\nNo active products in catalog.',
            link: { href: '/admin/products', labelBn: 'পণ্য পেজে যান', labelEn: 'Go to Products Page' },
          };
        }

        const lines = [
          `📦 **পণ্য ও সেলস টার্গেট তালিকা (${toBengaliDigits(products.length)}টি পণ্য):**`,
          ...products.map((p: any, i: number) => {
            const tQty = p.target_quantity ? Number(p.target_quantity) : 0;
            const soldQty = Array.isArray(p.sales)
              ? p.sales.reduce((sum: number, s: any) => sum + Number(s.quantity || 0), 0)
              : 0;
            const targetInfo = tQty > 0
              ? ` | 🎯 টার্গেট: ${toBengaliDigits(soldQty)}/${toBengaliDigits(tQty)} ${p.unit} (${Math.round((soldQty / tQty) * 100)}%)`
              : '';
            const deadlineInfo = p.target_deadline
              ? ` [মেয়াদ: ${new Date(p.target_deadline).toISOString().split('T')[0]}]`
              : '';

            return `${toBengaliDigits(i + 1)}. **${p.name_bn}** (${p.name_en}) - ${formatTaka(Number(p.selling_price))}/${p.unit}${targetInfo}${deadlineInfo}`;
          }),
        ];

        return {
          reply: lines.join('\n'),
          link: { href: '/admin/products', labelBn: 'পণ্য ও টার্গেট পেজে দেখুন', labelEn: 'View Products & Targets' },
        };
      }

      // 6. Marketing Campaigns
      case 'list_campaigns': {
        const campaigns = await prisma.campaign.findMany({
          take: 10,
          orderBy: { created_at: 'desc' },
        });

        if (campaigns.length === 0) {
          return {
            reply: 'কোনো ক্যাম্পেইন পাওয়া যায়নি।\nNo campaigns found.',
            link: { href: '/admin/campaigns', labelBn: 'ক্যাম্পেইন পেজে যান', labelEn: 'Go to Campaigns Page' },
          };
        }

        const lines = [
          `📢 **মার্কেটিং ক্যাম্পেইনসমূহ (${campaigns.length}টি):**`,
          ...campaigns.map(
            (c, i) =>
              `${toBengaliDigits(i + 1)}. **${c.name}** (বাজেট: ${formatTaka(Number(c.budget))}, স্ট্যাটাস: ${c.status})`
          ),
        ];

        return {
          reply: lines.join('\n'),
          link: { href: '/admin/campaigns', labelBn: 'ক্যাম্পেইন পেজে দেখুন', labelEn: 'View Campaigns Page' },
        };
      }

      case 'get_status_summary': {
        const result = await executeCommand('status', [], ctx);
        return {
          ...result,
          link: { href: '/admin/dashboard', labelBn: 'ড্যাশবোর্ডে দেখুন', labelEn: 'View in Dashboard' },
        };
      }

      case 'list_employees': {
        const result = await executeCommand('team', ['list'], ctx);
        return {
          ...result,
          link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' },
        };
      }

      case 'check_employee_exists': {
        const search = (args.query || args.name || '').trim();
        const employees = await prisma.user.findMany({
          where: {
            role: 'EMPLOYEE',
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        });
        if (employees.length > 0) {
          const names = employees.map((e) => `${e.name} (${e.email})`).join(', ');
          return {
            reply: `হ্যাঁ, "${search}" নামে কর্মী আছেন:\n${names}\n\nYes, employee exists: ${names}`,
            link: {
              href: `/admin/employees?q=${encodeURIComponent(search)}`,
              labelBn: `${search}-এর প্রোফাইল দেখুন`,
              labelEn: `View ${search}'s Profile`,
            },
            suggestions: [
              {
                href: `/admin/reports/daily?date=${getDhakaDateString()}&q=${encodeURIComponent(search)}`,
                labelBn: `${search}-এর রিপোর্ট দেখুন`,
                labelEn: `View ${search}'s Report`,
              },
            ],
          };
        } else {
          return {
            reply: `না, "${search}" নামে কোনো কর্মী খুঁজে পাওয়া যায়নি।\nNo employee found with name "${search}".`,
            link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' },
          };
        }
      }

      case 'create_employee': {
        const cmdArgs = [
          `name=${args.name}`,
          `password=${args.password}`,
          args.email ? `email=${args.email}` : '',
          args.phone ? `phone=${args.phone}` : '',
        ].filter(Boolean);
        const result = await executeCommand('team', cmdArgs, ctx);
        return {
          ...result,
          link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' },
        };
      }

      case 'reset_employee_password': {
        const result = await executeCommand('password', [args.target, args.new_password], ctx);
        return {
          ...result,
          link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' },
        };
      }

      case 'list_sections': {
        const result = await executeCommand('groups', ['list'], ctx);
        return {
          ...result,
          link: { href: '/admin/sections', labelBn: 'গ্রুপ পেজে যান', labelEn: 'Go to Groups Page' },
        };
      }

      case 'create_section': {
        const result = await executeCommand('groups', ['add', 'section', args.name], ctx);
        return {
          ...result,
          link: { href: '/admin/sections', labelBn: 'গ্রুপ পেজে যান', labelEn: 'Go to Groups Page' },
        };
      }

      case 'add_section_links': {
        const urlList = Array.isArray(args.urls) ? args.urls : [args.urls];
        const result = await executeCommand('links', [args.section_name, ...urlList], ctx);
        return {
          ...result,
          link: { href: '/admin/sections', labelBn: 'গ্রুপ পেজে যান', labelEn: 'Go to Groups Page' },
        };
      }

      case 'assign_employee_to_section': {
        const result = await executeCommand('assign', [args.employee, 'to', args.section_name], ctx);
        return {
          ...result,
          link: { href: '/admin/sections', labelBn: 'গ্রুপ পেজে যান', labelEn: 'Go to Groups Page' },
        };
      }

      case 'set_employee_permission': {
        const permArg = args.grant ? 'grant' : 'revoke';
        const result = await executeCommand('permission', [args.employee, permArg], ctx);
        return {
          ...result,
          link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' },
        };
      }

      case 'navigate_to_page': {
        const pageKey = (args.page_intent || args.page || '').toLowerCase();
        const PAGE_MAP: Record<string, { href: string; labelBn: string; labelEn: string }> = {
          team: { href: '/admin/employees', labelBn: 'টিম পেজ', labelEn: 'Team Page' },
          employees: { href: '/admin/employees', labelBn: 'টিম পেজ', labelEn: 'Team Page' },
          groups: { href: '/admin/sections', labelBn: 'গ্রুপ পেজ', labelEn: 'Groups Page' },
          sections: { href: '/admin/sections', labelBn: 'গ্রুপ পেজ', labelEn: 'Groups Page' },
          leads: { href: '/admin/leads', labelBn: 'লিড পেজ', labelEn: 'Leads Page' },
          products: { href: '/admin/products', labelBn: 'পণ্য পেজ', labelEn: 'Products Page' },
          campaigns: { href: '/admin/campaigns', labelBn: 'ক্যাম্পেইন পেজ', labelEn: 'Campaigns Page' },
          targets: { href: '/admin/targets', labelBn: 'টার্গেট ও বাজেট পেজ', labelEn: 'Targets Page' },
          dashboard: { href: '/admin/dashboard', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard' },
          reports_daily: { href: '/admin/reports/daily', labelBn: 'দৈনিক রিপোর্ট', labelEn: 'Daily Report' },
          reports_weekly: { href: '/admin/reports/weekly', labelBn: 'সাপ্তাহিক রিপোর্ট', labelEn: 'Weekly Report' },
          reports_monthly: { href: '/admin/reports/monthly', labelBn: 'মাসিক রিপোর্ট', labelEn: 'Monthly Report' },
          plan: { href: '/admin/plan', labelBn: '৯০ দিনের প্ল্যান', labelEn: '90-Day Plan' },
          audit: { href: '/admin/audit', labelBn: 'অডিট লগ', labelEn: 'Audit Log' },
          settings: { href: '/admin/settings', labelBn: 'সেটিংস', labelEn: 'Settings' },
          manual: { href: '/admin/manual', labelBn: 'নির্দেশিকা', labelEn: 'Manual' },
        };

        const targetNav = PAGE_MAP[pageKey];
        if (targetNav) {
          return {
            reply: `পেজটি ওপেন করা হচ্ছে: ${targetNav.labelBn} / Opening ${targetNav.labelEn}...`,
            link: targetNav,
            navigate: true,
          };
        }

        const navRes = await navigate(args.page_intent || message);
        return {
          ...navRes,
          navigate: true,
        };
      }

      case 'clarify_and_offer_options': {
        const clarification =
          args.clarification ||
          'অনুগ্রহ করে নিচের একটি অপশন বেছে নিন / Please choose an option below:';
        const rawOptions = Array.isArray(args.options) ? args.options : [];
        const suggestions: NavLink[] = rawOptions.map((opt: any) => ({
          labelBn: opt.labelBn || opt.actionQuery || 'বাছাই করুন',
          labelEn: opt.labelEn || opt.actionQuery || 'Select',
          actionQuery: opt.actionQuery,
          href: opt.href,
        }));

        return {
          reply: clarification,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        };
      }

      case 'refuse_off_topic': {
        return createOffTopicRefusal();
      }

      case 'get_today_targets': {
        const todayStr = getDhakaDateString();
        const targetDate = parseDateOnly(todayStr);

        const [targets, sections] = await Promise.all([
          prisma.sectionTarget.findMany({
            include: { section: true, employee: true },
          }),
          prisma.groupSection.findMany({
            where: { is_active: true },
            select: { id: true, name: true },
          }),
        ]);

        const effective = calculateEffectiveTargetsForRange(targets, targetDate, targetDate);

        const lines: string[] = [
          `🎯 **আজকের (${todayStr}) টার্গেট সামারি / Today's Target Summary:**`,
          '',
        ];

        let totalTargetPosts = 0;
        let totalTargetSales = 0;
        let totalTargetProfit = 0;
        let totalTargetClients = 0;

        for (const [secId, metricObj] of Object.entries(effective)) {
          const sec = sections.find((s) => s.id === secId);
          const secName = sec ? sec.name : 'Unknown Section';
          const posts = (metricObj as any)[MetricType.POSTS_DONE] || 0;
          const sales = (metricObj as any)[MetricType.SALES_AMOUNT] || 0;
          const profit = (metricObj as any)[MetricType.PROFIT_AMOUNT] || 0;
          const clients = (metricObj as any)[MetricType.NEW_CLIENTS] || 0;

          totalTargetPosts += posts;
          totalTargetSales += sales;
          totalTargetProfit += profit;
          totalTargetClients += clients;

          if (posts > 0 || sales > 0 || profit > 0 || clients > 0) {
            lines.push(
              `• **${secName}**: পোস্ট: ${posts}, সেলস: ${formatTaka(sales)}, লাভ: ${formatTaka(profit)}, নতুন ক্লায়েন্ট: ${clients}`
            );
          }
        }

        lines.push('');
        lines.push(
          `📊 **মোট লক্ষ্যমাত্রা (Total Targets)**: পোস্ট: ${totalTargetPosts}, সেলস: ${formatTaka(totalTargetSales)}, মুনাফা: ${formatTaka(totalTargetProfit)}`
        );

        return {
          reply: lines.join('\n'),
          link: { href: '/admin/targets', labelBn: 'টার্গেট ও বাজেট পেজে দেখুন', labelEn: 'View Targets Page' },
          suggestions: [
            {
              labelBn: 'আজকের দৈনিক রিপোর্ট',
              labelEn: "Today's Daily Report",
              actionQuery: 'আজকের দৈনিক রিপোর্ট দেখাও',
              href: '/admin/reports/daily',
            },
            {
              labelBn: 'টার্গেট ম্যানেজমেন্ট পেজ',
              labelEn: 'Targets Page',
              href: '/admin/targets',
            },
          ],
        };
      }

      default:
        break;
    }
  }

  // If Gemini provided a direct textual explanation
  const textPart = parts.find((p: any) => p.text);
  if (textPart?.text) {
    if (isOffTopicQuery(textPart.text)) {
      return createOffTopicRefusal();
    }
    return {
      reply: textPart.text,
    };
  }

  return null;
}
