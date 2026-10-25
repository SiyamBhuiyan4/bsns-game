'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, Loader2, Send, X } from 'lucide-react';

type Role = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: number;
  role: Role;
  text: string;
  /** The user message that produced a confirmation prompt. */
  originalMessage?: string;
  needsConfirmation?: boolean;
  /** Set once the admin answers the confirmation, so the buttons hide. */
  confirmAnswered?: boolean;
  /** Sealed token for the previewed action; sent back on "yes". */
  pending?: { token: string };
  link?: NavLink;
  suggestions?: NavLink[];
}

interface NavLink {
  href: string;
  labelBn: string;
  labelEn: string;
}

interface AgentResponse {
  reply: string;
  needsConfirmation?: boolean;
  pending?: { command: string; token: string };
  link?: NavLink;
  suggestions?: NavLink[];
  navigate?: boolean;
}

const HINTS = ['কর্মী যোগ করব কীভাবে?', 'গ্রুপে লিংক যোগ', 'আজকের রিপোর্ট', 'how do I set a target?', 'তুমি কী পারো?', '#status'];
const NETWORK_ERROR =
  'Network problem. Please check your connection and try again. / নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করে আবার চেষ্টা করুন।';

export default function AgentChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'assistant',
      text:
        'হ্যালো! কী করতে চান লিখুন, আমি সঠিক পেজে নিয়ে যাব। যেমন: "নতুন কর্মী যোগ", "রহিমের অবস্থা দেখাও"।\n' +
        'Hi! Tell me what you want to do and I will open the right page. Example: "add employee", "show Rahim".',
    },
  ]);

  const nextId = useRef(1);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Move focus into the panel on open, and back to the launcher on close.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (wasOpen.current) {
      launcherRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Keep the newest message in view.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading]);

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  };

  const callAgent = async (body: { message: string; confirm?: boolean; pending?: { token: string } }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as AgentResponse | null;
      if (!res.ok || !data || typeof data.reply !== 'string') {
        addMessage({
          role: 'assistant',
          text:
            'Something went wrong. Please try again. / কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।',
        });
        return;
      }
      addMessage({
        role: 'assistant',
        text: data.reply,
        needsConfirmation: Boolean(data.needsConfirmation),
        originalMessage: body.message,
        pending: data.pending ? { token: data.pending.token } : undefined,
        link: data.link,
        suggestions: data.suggestions,
      });
      // Take the admin straight to the page; the chat stays open (it lives in the admin layout).
      if (data.link && data.navigate) router.push(data.link.href);
    } catch {
      addMessage({ role: 'assistant', text: NETWORK_ERROR });
    } finally {
      setLoading(false);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addMessage({ role: 'user', text });
    void callAgent({ message: text });
  };

  const answerConfirmation = (msgId: number, original: string, yes: boolean, pending?: { token: string }) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, confirmAnswered: true } : m)),
    );
    if (yes) {
      addMessage({ role: 'user', text: 'Yes, do it / হ্যাঁ, করুন' });
      void callAgent({ message: original, confirm: true, pending });
    } else {
      addMessage({ role: 'user', text: 'No / না' });
      addMessage({
        role: 'assistant',
        text: 'Cancelled. Nothing was changed. / বাতিল করা হয়েছে। কিছু পরিবর্তন হয়নি।',
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant / AI সহকারী খুলুন"
          aria-expanded={open}
          aria-controls="agent-chat-panel"
          className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
        >
          <Bot className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {open && (
        <div
          id="agent-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-label="AI assistant / AI সহকারী"
          className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[560px] sm:max-h-[calc(100vh-2rem)] sm:w-[380px] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
              <h2 className="truncate text-sm font-semibold">
                AI Assistant / AI সহকারী
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close / বন্ধ করুন"
              className="rounded-lg p-1.5 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-4"
            role="log"
            aria-live="polite"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div className="max-w-[85%] space-y-2">
                  <div
                    className={
                      m.role === 'user'
                        ? 'whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-emerald-600 px-3 py-2 text-sm text-white'
                        : 'whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800'
                    }
                  >
                    {m.text}
                  </div>
                  {m.needsConfirmation && !m.confirmAnswered && m.originalMessage && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => answerConfirmation(m.id, m.originalMessage!, true, m.pending)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                      >
                        Yes, do it / হ্যাঁ, করুন
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => answerConfirmation(m.id, m.originalMessage!, false)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        No / না
                      </button>
                    </div>
                  )}
                  {(m.link || (m.suggestions && m.suggestions.length > 0)) && (
                    <div className="flex flex-wrap gap-2">
                      {[...(m.link ? [m.link] : []), ...(m.suggestions ?? [])].map((l, i) => (
                        <button
                          key={`${l.href}-${i}`}
                          type="button"
                          onClick={() => router.push(l.href)}
                          className={
                            i === 0 && m.link
                              ? 'inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700'
                              : 'inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
                          }
                        >
                          {l.labelBn}
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start" role="status">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Thinking... / ভাবছি...</span>
                </div>
              </div>
            )}
            <div ref={listEndRef} />
          </div>

          {/* Quick hints */}
          <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 pt-3">
            {HINTS.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => {
                  setInput(hint);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-emerald-300 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                {hint}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 px-4 py-3">
            <label htmlFor="agent-chat-input" className="sr-only">
              Message / বার্তা
            </label>
            <textarea
              ref={inputRef}
              id="agent-chat-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a message... / বার্তা লিখুন..."
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send / পাঠান"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
