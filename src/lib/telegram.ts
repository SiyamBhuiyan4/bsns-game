// Telegram file storage: uploads go to the storage channel; the returned file_id is saved in Postgres.

const API = 'https://api.telegram.org';

function config() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID must be set');
  }
  return { token, chatId };
}

export type StoredFile = { fileId: string; fileName: string; size: number };

/** Upload a file to the storage channel and return its Telegram file_id. */
export async function uploadFile(
  data: Uint8Array,
  fileName: string,
  mimeType = 'application/octet-stream',
): Promise<StoredFile> {
  const { token, chatId } = config();
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', new Blob([data as BlobPart], { type: mimeType }), fileName);

  const res = await fetch(`${API}/bot${token}/sendDocument`, { method: 'POST', body: form });
  const json = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: { document?: { file_id: string; file_name?: string; file_size?: number } };
  };
  if (!json.ok || !json.result?.document) {
    throw new Error(`Telegram upload failed: ${json.description ?? res.status}`);
  }
  const doc = json.result.document;
  return { fileId: doc.file_id, fileName: doc.file_name ?? fileName, size: doc.file_size ?? data.byteLength };
}

/** Resolve a stored file_id to a short-lived download URL (valid about 1 hour). Bot API limit: 20 MB. */
export async function getFileUrl(fileId: string): Promise<string> {
  const { token } = config();
  const res = await fetch(`${API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const json = (await res.json()) as { ok: boolean; description?: string; result?: { file_path?: string } };
  if (!json.ok || !json.result?.file_path) {
    throw new Error(`Telegram getFile failed: ${json.description ?? res.status}`);
  }
  return `${API}/file/bot${token}/${json.result.file_path}`;
}
