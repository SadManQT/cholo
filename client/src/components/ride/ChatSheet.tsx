import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import * as tripsApi from '../../api/trips.api';
import type { TripMessage } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatDateTime } from '../../utils/format';
import { EASE_OUT } from '../../utils/motion';
import { BottomSheet, Button, EmptyState, Input, Skeleton, toast } from '../ui';

const QUICK_REPLIES = ['I am here', 'Coming in 2 minutes', 'Please call me'];

interface ChatSheetProps {
  open: boolean;
  tripCode: string;
  currentUserId: string;
  onClose: () => void;
}

export function ChatSheet({ open, tripCode, currentUserId, onClose }: ChatSheetProps) {
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const nextMessages = await tripsApi.listMessages(tripCode);
      setMessages(nextMessages);
      setError(null);
    } catch (thrown) {
      if (!silent) setError(getApiErrorMessage(thrown, 'Could not load trip messages.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tripCode]);

  useEffect(() => {
    if (!open) return;
    void loadMessages();
    const interval = window.setInterval(() => loadMessages(true), 3_000);
    return () => window.clearInterval(interval);
  }, [loadMessages, open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function submitMessage(event: FormEvent, quickReply?: string) {
    event.preventDefault();
    const message = (quickReply ?? body).trim();
    if (!message) return;
    setSending(true);
    try {
      const sent = await tripsApi.sendMessage(tripCode, message, quickReply ? 'quick_reply' : 'text');
      setMessages((current) => current.some((item) => item.id === sent.id) ? current : [...current, sent]);
      setBody('');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Message could not be sent.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet open={open} snapPoint="full" onSnapPointChange={() => {}} onClose={onClose}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-lg font-bold">Trip chat</h2>
            <p className="text-xs text-ink-500">Messages are kept for safety.</p>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
          ) : error ? (
            <EmptyState title="Messages did not load" hint={error} action={{ label: 'Retry', onClick: loadMessages }} />
          ) : messages.length === 0 ? (
            <EmptyState title="No messages yet" hint="Send a quick update to the other rider." />
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const mine = message.senderId === currentUserId;
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, transform: 'translateY(8px)' }}
                    animate={{ opacity: 1, transform: 'translateY(0px)' }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${mine ? 'bg-cholo-700 text-white' : 'bg-surface-alt text-ink-900'}`}>
                      {!mine && <p className="mb-0.5 text-xs font-semibold opacity-70">{message.senderName}</p>}
                      <p className="text-sm">{message.body}</p>
                      <p className="mt-1 text-[10px] opacity-70">{formatDateTime(message.sentAt)}</p>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-border pt-3">
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {QUICK_REPLIES.map((reply) => (
              <Button key={reply} variant="secondary" disabled={sending} onClick={(event) => submitMessage(event, reply)} className="shrink-0 text-sm">
                {reply}
              </Button>
            ))}
          </div>
          <form onSubmit={submitMessage} className="flex items-end gap-2">
            <Input
              aria-label="Message"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Type a message"
              maxLength={1000}
              containerClassName="min-w-0 flex-1"
            />
            <Button type="submit" loading={sending} disabled={!body.trim()}>Send</Button>
          </form>
        </div>
      </div>
    </BottomSheet>
  );
}
