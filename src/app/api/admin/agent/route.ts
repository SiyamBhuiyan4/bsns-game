import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { requireAdmin } from '@/lib/session';
import { parseMessage } from '@/lib/agent/router';
import { executeCommand, type AgentResult } from '@/lib/agent/commands';
import { navigate, type NavLink } from '@/lib/agent/navigator';

export const runtime = 'nodejs';

// Pending actions are sealed (encrypted) so that args such as a new employee password
// never travel to the browser in plain text. Valid for 10 minutes.
const SEAL_SECRET = createHash('sha256')
  .update(process.env.JWT_SECRET || 'super-secret-jwt-key-for-marketing-system-2026-secure-random')
  .digest();

async function sealPending(command: string, args: string[]): Promise<string> {
  return new EncryptJWT({ command, args })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .encrypt(SEAL_SECRET);
}

async function openPending(token: string): Promise<{ command: string; args: string[] } | null> {
  try {
    const { payload } = await jwtDecrypt(token, SEAL_SECRET);
    const parsed = z
      .object({ command: z.string().min(1).max(40), args: z.array(z.string().max(2000)).max(50) })
      .safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const requestSchema = z.object({
  message: z.string().trim().min(1, 'বার্তা খালি রাখা যাবে না (Message is required)').max(2000),
  // true = execute the previewed action. Only honored for the pending action or a hashtag command.
  confirm: z.boolean().optional(),
  // Echoed back from a previous preview so the exact previewed command runs (no second AI call).
  pending: z.object({ token: z.string().min(1).max(8000) }).optional(),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const forbidden = error instanceof Error && error.message === 'FORBIDDEN';
    return NextResponse.json(
      { error: forbidden ? 'অনুমতি নেই / Forbidden' : 'লগইন প্রয়োজন / Unauthorized' },
      { status: forbidden ? 403 : 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'অবৈধ অনুরোধ / Invalid JSON' }, { status: 400 });
  }

  const parse = requestSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: parse.error.issues[0]?.message || 'অবৈধ তথ্য / Invalid input' },
      { status: 400 }
    );
  }

  const { message, confirm, pending } = parse.data;
  const ctx = { actorId: session.userId, confirm: confirm === true };

  let result: AgentResult & { link?: NavLink; suggestions?: NavLink[] };
  if (confirm === true && pending) {
    // Run exactly what was previewed.
    const opened = await openPending(pending.token);
    result = opened
      ? await executeCommand(opened.command, opened.args, ctx)
      : { reply: 'এই অনুরোধের মেয়াদ শেষ বা অবৈধ। আবার কমান্ড লিখুন।\nThis request expired or is invalid. Please send the command again.' };
  } else {
    const parsed = parseMessage(message);
    if (parsed.command !== null) {
      result = await executeCommand(parsed.command, parsed.args, ctx);
    } else {
      // Plain text never executes anything: it only points the admin to the right page.
      result = await navigate(message);
    }
  }

  const response: {
    reply: string;
    needsConfirmation?: boolean;
    pending?: { command: string; token: string };
    link?: NavLink;
    suggestions?: NavLink[];
  } = { reply: result.reply, link: result.link, suggestions: result.suggestions };
  if (result.needsConfirmation && result.pending) {
    response.needsConfirmation = true;
    response.pending = {
      command: result.pending.command,
      token: await sealPending(result.pending.command, result.pending.args),
    };
  }
  return NextResponse.json(response);
}
