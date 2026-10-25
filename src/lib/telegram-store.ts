// Telegram-backed document store.
// The whole database is one JSON snapshot posted to the storage channel and pinned.
// Load: read the pinned message's document. Save: post a new snapshot, pin it, delete the old one.

const API = 'https://api.telegram.org';

export type Snapshot = {
  version: number;
  updated_at: string;
  tables: Record<string, Record<string, unknown>[]>;
};

type Cache = { snapshot: Snapshot; messageId: number | null; loadedAt: number };

const globalForStore = globalThis as unknown as { telegramStore?: Cache };

function hasTelegramConfig(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID);
}

function config() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID must be set');
  return { token, chatId };
}

async function callApi<T>(method: string, init?: RequestInit & { query?: Record<string, string> }, attempt = 0): Promise<T> {
  const { token } = config();
  const qs = init?.query ? '?' + new URLSearchParams(init.query).toString() : '';
  const res = await fetch(`${API}/bot${token}/${method}${qs}`, init);
  const json = (await res.json()) as { ok: boolean; description?: string; result: T; parameters?: { retry_after?: number } };
  if (!json.ok && json.parameters?.retry_after && attempt < 5) {
    // Rate limited by Telegram: wait as instructed, then retry.
    const waitMs = (json.parameters.retry_after + 1) * 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    return callApi<T>(method, init, attempt + 1);
  }
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  return json.result;
}

function emptySnapshot(): Snapshot {
  return { version: 0, updated_at: new Date().toISOString(), tables: {} };
}

/** Read the pinned snapshot from the channel. Returns an empty snapshot if none is pinned yet. */
async function fetchPinned(): Promise<{ snapshot: Snapshot; messageId: number | null }> {
  const { chatId } = config();
  const chat = await callApi<{ pinned_message?: { message_id: number; document?: { file_id: string } } }>(
    'getChat',
    { query: { chat_id: chatId } },
  );
  const pinned = chat.pinned_message;
  if (!pinned?.document) return { snapshot: emptySnapshot(), messageId: null };

  const file = await callApi<{ file_path: string }>('getFile', { query: { file_id: pinned.document.file_id } });
  const { token } = config();
  const res = await fetch(`${API}/file/bot${token}/${file.file_path}`);
  if (!res.ok) throw new Error(`Snapshot download failed: ${res.status}`);
  const parsed = (await res.json()) as Partial<Snapshot>;
  const snapshot: Snapshot = {
    version: parsed.version ?? 0,
    updated_at: parsed.updated_at ?? new Date().toISOString(),
    tables: parsed.tables ?? {},
  };
  return { snapshot, messageId: pinned.message_id };
}

/** Post a new snapshot, pin it, then remove the previous snapshot message. */
async function writePinned(snapshot: Snapshot, previousMessageId: number | null): Promise<number> {
  const { chatId } = config();
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append(
    'document',
    new Blob([JSON.stringify(snapshot)], { type: 'application/json' }),
    `snapshot-v${snapshot.version}.json`,
  );
  const sent = await callApi<{ message_id: number }>('sendDocument', { method: 'POST', body: form });

  await callApi<boolean>('pinChatMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: sent.message_id, disable_notification: true }),
  });

  if (previousMessageId) {
    // Best effort: an old snapshot that fails to delete is harmless.
    await callApi<boolean>('deleteMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: previousMessageId }),
    }).catch(() => undefined);
  }
  return sent.message_id;
}

/** Return the current snapshot. Cached for `maxAgeMs` to avoid hitting Telegram on every read. */
export async function readSnapshot(maxAgeMs = 5_000): Promise<Snapshot> {
  if (!hasTelegramConfig()) {
    if (!globalForStore.telegramStore) {
      globalForStore.telegramStore = { snapshot: emptySnapshot(), messageId: null, loadedAt: Date.now() };
    }
    return globalForStore.telegramStore.snapshot;
  }
  const cache = globalForStore.telegramStore;
  if (cache && Date.now() - cache.loadedAt < maxAgeMs) return cache.snapshot;
  const { snapshot, messageId } = await fetchPinned();
  globalForStore.telegramStore = { snapshot, messageId, loadedAt: Date.now() };
  return snapshot;
}

type Job = {
  fn: (snap: Snapshot) => unknown;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

// Group commit: writes that arrive while a save is running are applied together in the next save,
// so one upload + pin serves many writes. This also keeps Telegram's rate limit manageable.
// Each write runs on its own copy of the data, so a failing write cannot leave partial changes behind.
// Serverless instances are separate processes; this queue only orders writes inside one process.
let pending: Job[] = [];
let flushing = false;

async function flush() {
  flushing = true;
  try {
    while (pending.length) {
      const batch = pending;
      pending = [];

      if (!hasTelegramConfig()) {
        if (!globalForStore.telegramStore) {
          globalForStore.telegramStore = { snapshot: emptySnapshot(), messageId: null, loadedAt: Date.now() };
        }
        const snap = globalForStore.telegramStore.snapshot;
        const outcomes: { job: Job; ok: boolean; value?: unknown; error?: unknown }[] = [];
        let changed = false;
        for (const job of batch) {
          const trial: Snapshot = { ...snap, tables: structuredClone(snap.tables) };
          try {
            const value = await job.fn(trial);
            snap.tables = trial.tables;
            changed = true;
            outcomes.push({ job, ok: true, value });
          } catch (error) {
            outcomes.push({ job, ok: false, error });
          }
        }
        if (changed) {
          snap.version += 1;
          snap.updated_at = new Date().toISOString();
        }
        for (const o of outcomes) {
          if (o.ok) o.job.resolve(o.value);
          else o.job.reject(o.error);
        }
        continue;
      }

      try {
        const fresh = await fetchPinned();
        const snap = fresh.snapshot;
        const outcomes: { job: Job; ok: boolean; value?: unknown; error?: unknown }[] = [];
        let changed = false;
        for (const job of batch) {
          const trial: Snapshot = { ...snap, tables: structuredClone(snap.tables) };
          try {
            const value = await job.fn(trial);
            snap.tables = trial.tables; // commit this write's changes into the batch snapshot
            changed = true;
            outcomes.push({ job, ok: true, value });
          } catch (error) {
            outcomes.push({ job, ok: false, error });
          }
        }
        if (changed) {
          snap.version += 1;
          snap.updated_at = new Date().toISOString();
          const newMessageId = await writePinned(snap, fresh.messageId);
          globalForStore.telegramStore = { snapshot: snap, messageId: newMessageId, loadedAt: Date.now() };
        }
        for (const o of outcomes) {
          if (o.ok) o.job.resolve(o.value);
          else o.job.reject(o.error);
        }
      } catch (error) {
        for (const job of batch) job.reject(error);
      }
    }
  } finally {
    flushing = false;
  }
}

/** Apply a mutation to the snapshot and persist it. Failing mutations roll back and reject only themselves. */
export function mutateSnapshot<T>(fn: (snap: Snapshot) => T | Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    pending.push({ fn: fn as Job['fn'], resolve: resolve as Job['resolve'], reject });
    if (!flushing) void flush();
  });
}
