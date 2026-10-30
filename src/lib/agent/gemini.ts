import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { executeCommand, type AgentResult } from '@/lib/agent/commands';
import { navigate, type NavLink } from '@/lib/agent/navigator';

export interface GeminiAgentInput {
  message: string;
  actorId: string;
}

export interface GeminiAgentOutput extends AgentResult {
  link?: NavLink;
  suggestions?: NavLink[];
  navigate?: boolean;
}

// Lowest-cost & highest free-tier quota models prioritized first:
// gemini-3.5-flash-lite has the highest RPM/RPD limits and the lowest cost per token.
const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash'
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

// Function Calling declarations covering the whole web application
const AGENT_TOOLS = [
  {
    name: 'navigate_to_page',
    description: 'Directs the admin to any page/feature across the web app (e.g., dashboard, employees, sections/groups, products, campaigns, leads, targets & budgets, daily report, 90-day plan, audit log, settings, manual).',
    parameters: {
      type: 'OBJECT',
      properties: {
        page_intent: {
          type: 'STRING',
          description: 'Topic keyword e.g. "team", "leads", "groups", "targets", "dashboard", "manual", "settings"'
        }
      },
      required: ['page_intent']
    }
  },
  {
    name: 'get_status_summary',
    description: 'Fetches today\'s live operational statistics: number of active employees, total sections, total links, and total completed links for today.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'list_employees',
    description: 'Lists all employees with their emails, IDs, and active status.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'create_employee',
    description: 'Creates a new employee profile or prepares a preview confirmation. Requires name, password (minimum 6 chars) and optional email & phone.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Name of the employee' },
        password: { type: 'STRING', description: 'Initial login password (min 6 chars)' },
        email: { type: 'STRING', description: 'Optional email address (defaults to name@company.com if omitted)' },
        phone: { type: 'STRING', description: 'Optional phone number' }
      },
      required: ['name', 'password']
    }
  },
  {
    name: 'reset_employee_password',
    description: 'Resets or sets a new password for an existing employee by their name or email.',
    parameters: {
      type: 'OBJECT',
      properties: {
        target: { type: 'STRING', description: 'Employee name or email address' },
        new_password: { type: 'STRING', description: 'The new password (min 6 chars)' }
      },
      required: ['target', 'new_password']
    }
  },
  {
    name: 'list_sections',
    description: 'Lists all group sections in the system along with active status.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'create_section',
    description: 'Creates a new section / group category (e.g. "Agro", "Dhaka Group", "Retailers").',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Section name (2-100 characters)' }
      },
      required: ['name']
    }
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
          description: 'List of URL strings to add'
        }
      },
      required: ['section_name', 'urls']
    }
  },
  {
    name: 'assign_employee_to_section',
    description: 'Assigns an employee to a section so they can complete the group tasks.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employee: { type: 'STRING', description: 'Employee name or email' },
        section_name: { type: 'STRING', description: 'Section name to assign to' }
      },
      required: ['employee', 'section_name']
    }
  },
  {
    name: 'set_employee_permission',
    description: 'Grants or revokes access for an employee to view all customer/leads database.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employee: { type: 'STRING', description: 'Employee name or email' },
        grant: { type: 'BOOLEAN', description: 'true to grant view all customers, false to revoke' }
      },
      required: ['employee', 'grant']
    }
  }
];

const SYSTEM_INSTRUCTION = `
You are the Executive AI Agent for "Game of Business" (Marketing Performance System).
You understand English, Bengali (বাংলা), and Banglish seamlessly.
You have full authority to assist the admin, inspect database state, navigate pages, and execute administrative actions.

When the user asks or instructs:
1. Always understand the user's intent in English, Bengali, or Banglish (e.g. "kormi banao", "notun section add koro", "ajker obostha bolo", "where are leads", "show team").
2. Call the most relevant tool to get live data, create records, or navigate to the correct page.
3. If an action mutates sensitive data (like creating an employee or changing a password), trigger the respective tool so the system creates a safe preview confirmation for the admin.
4. Always provide helpful bilingual context (Bengali + English).
`;

/**
 * Executes an AI Agent turn using Google Gemini API with fallback support.
 */
export async function runGeminiAgent(
  input: GeminiAgentInput
): Promise<GeminiAgentOutput | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const { message, actorId } = input;
  const ctx = { actorId, confirm: false };

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ],
    tools: [
      {
        functionDeclarations: AGENT_TOOLS
      }
    ]
  };

  let candidate: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
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
      case 'get_status_summary': {
        const result = await executeCommand('status', [], ctx);
        return {
          ...result,
          link: { href: '/admin/dashboard', labelBn: 'ড্যাশবোর্ডে দেখুন', labelEn: 'View in Dashboard' }
        };
      }

      case 'list_employees': {
        const result = await executeCommand('team', ['list'], ctx);
        return {
          ...result,
          link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' }
        };
      }

      case 'create_employee': {
        const cmdArgs = [
          `name=${args.name}`,
          `password=${args.password}`,
          args.email ? `email=${args.email}` : '',
          args.phone ? `phone=${args.phone}` : ''
        ].filter(Boolean);
        const result = await executeCommand('team', cmdArgs, ctx);
        return {
          ...result,
          link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' }
        };
      }

      case 'reset_employee_password': {
        const result = await executeCommand('password', [args.target, args.new_password], ctx);
        return {
          ...result,
          link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' }
        };
      }

      case 'list_sections': {
        const result = await executeCommand('groups', ['list'], ctx);
        return {
          ...result,
          link: { href: '/admin/sections', labelBn: 'গ্রুপ পেজে যান', labelEn: 'Go to Groups Page' }
        };
      }

      case 'create_section': {
        const result = await executeCommand('groups', ['add', 'section', args.name], ctx);
        return {
          ...result,
          link: { href: '/admin/sections', labelBn: 'গ্রুপ পেজে যান', labelEn: 'Go to Groups Page' }
        };
      }

      case 'add_section_links': {
        const urlList = Array.isArray(args.urls) ? args.urls : [args.urls];
        const result = await executeCommand('links', [args.section_name, ...urlList], ctx);
        return {
          ...result,
          link: { href: '/admin/sections', labelBn: 'গ্রুপ পেজে যান', labelEn: 'Go to Groups Page' }
        };
      }

      case 'assign_employee_to_section': {
        const result = await executeCommand('assign', [args.employee, 'to', args.section_name], ctx);
        return {
          ...result,
          link: { href: '/admin/sections', labelBn: 'গ্রুপ পেজে যান', labelEn: 'Go to Groups Page' }
        };
      }

      case 'set_employee_permission': {
        const permArg = args.grant ? 'grant' : 'revoke';
        const result = await executeCommand('permission', [args.employee, permArg], ctx);
        return {
          ...result,
          link: { href: '/admin/employees', labelBn: 'টিম পেজে যান', labelEn: 'Go to Team Page' }
        };
      }

      case 'navigate_to_page': {
        return await navigate(args.page_intent || message);
      }

      default:
        break;
    }
  }

  // If Gemini provided a direct textual explanation
  const textPart = parts.find((p: any) => p.text);
  if (textPart?.text) {
    const navResult = await navigate(message);
    return {
      reply: textPart.text,
      link: navResult.link,
      suggestions: navResult.suggestions
    };
  }

  return null;
}
