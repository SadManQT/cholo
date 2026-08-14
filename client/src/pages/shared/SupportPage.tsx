import { useCallback, useEffect, useState } from 'react';
import * as supportApi from '../../api/support.api';
import { Button, Card, EmptyState, Input, Skeleton, StatePill, toast } from '../../components/ui';
import type { MyDispute, TicketDetail, TicketSummary } from '../../types/support.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime } from '../../utils/format';

const fieldClass = 'mt-1 min-h-28 w-full rounded-xl border border-border bg-surface px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700';

export function SupportPage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [disputes, setDisputes] = useState<MyDispute[]>([]);
  const [tab, setTab] = useState<'tickets' | 'disputes'>('tickets');
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category: 'ride',
    subject: '',
    description: '',
    tripId: '',
    disputeType: 'service_quality',
    disputedAmount: '',
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ticketResult, disputeResult] = await Promise.all([
        supportApi.listTickets(),
        supportApi.listDisputes(),
      ]);
      setTickets(ticketResult.data);
      setDisputes(disputeResult.data);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load support history.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseTab(nextTab: 'tickets' | 'disputes') {
    setTab(nextTab);
    setShowForm(false);
    setDetail(null);
    setReply('');
  }

  async function openTicket(ticketId: string) {
    setBusy(true);
    try {
      setDetail(await supportApi.getTicket(ticketId));
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not open this ticket.'));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!detail || !reply.trim()) return;
    setBusy(true);
    try {
      await supportApi.addMessage(detail.id, reply.trim());
      setReply('');
      setDetail(await supportApi.getTicket(detail.id));
      toast.success('Reply added to the ticket.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not send your reply.'));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!form.description.trim() || (tab === 'tickets' && !form.subject.trim())) {
      toast.error(tab === 'tickets' ? 'Add a subject and description.' : 'Add a description.');
      return;
    }
    if (tab === 'disputes' && !form.tripId.trim()) {
      toast.error('A trip code is required for a dispute.');
      return;
    }

    setBusy(true);
    try {
      if (tab === 'tickets') {
        const created = await supportApi.createTicket({
          category: form.category,
          subject: form.subject.trim(),
          description: form.description.trim(),
          ...(form.tripId ? { tripId: form.tripId.trim() } : {}),
        });
        setDetail(await supportApi.getTicket(created.id));
      } else {
        await supportApi.createDispute({
          tripPublicId: form.tripId.trim(),
          disputeType: form.disputeType,
          description: form.description.trim(),
          ...(Number(form.disputedAmount) > 0 ? { disputedAmount: Number(form.disputedAmount) } : {}),
        });
      }
      toast.success(tab === 'tickets' ? 'Support ticket created.' : 'Dispute submitted.');
      setShowForm(false);
      setForm((current) => ({ ...current, subject: '', description: '', tripId: '', disputedAmount: '' }));
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not submit your request.'));
    } finally {
      setBusy(false);
    }
  }

  const rows = tab === 'tickets' ? tickets : disputes;

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Support & disputes</h1>
          <p className="text-sm text-ink-500">Get help or formally contest a completed trip.</p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Close form' : tab === 'tickets' ? 'New ticket' : 'Raise dispute'}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'tickets' ? 'primary' : 'secondary'} onClick={() => chooseTab('tickets')}>Tickets</Button>
        <Button variant={tab === 'disputes' ? 'primary' : 'secondary'} onClick={() => chooseTab('disputes')}>Disputes</Button>
      </div>

      {showForm && (
        <Card>
          <div className="grid gap-3">
            {tab === 'tickets' ? (
              <label className="text-sm font-medium">Category
                <select value={form.category} onChange={(event) => update('category', event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3">
                  <option value="payment">Payment</option><option value="ride">Ride</option>
                  <option value="account">Account</option><option value="driver_conduct">Driver conduct</option>
                  <option value="app_issue">App issue</option><option value="other">Other</option>
                </select>
              </label>
            ) : (
              <label className="text-sm font-medium">Dispute type
                <select value={form.disputeType} onChange={(event) => update('disputeType', event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3">
                  <option value="fare_overcharge">Fare overcharge</option><option value="payment_failed">Payment failed</option>
                  <option value="behavior">Behavior</option><option value="lost_item">Lost item</option>
                  <option value="service_quality">Service quality</option>
                </select>
              </label>
            )}
            {tab === 'tickets' && <Input label="Subject" value={form.subject} onChange={(event) => update('subject', event.target.value)} />}
            <label className="text-sm font-medium">Description
              <textarea className={fieldClass} value={form.description} onChange={(event) => update('description', event.target.value)} />
            </label>
            <Input
              label={tab === 'disputes' ? 'Trip code (required)' : 'Trip code (optional)'}
              placeholder="JT-2026-000001"
              value={form.tripId}
              onChange={(event) => update('tripId', event.target.value.toUpperCase())}
            />
            {tab === 'disputes' && <Input label="Disputed amount (optional)" inputMode="decimal" value={form.disputedAmount} onChange={(event) => update('disputedAmount', event.target.value)} />}
            <Button loading={busy} onClick={() => void submit()}>Submit</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error && rows.length === 0 ? (
        <EmptyState title="Support history did not load" hint={error} action={{ label: 'Retry', onClick: load }} />
      ) : rows.length === 0 ? (
        <EmptyState title={tab === 'tickets' ? 'No support tickets' : 'No disputes'} hint="Your submitted requests will appear here." />
      ) : tab === 'tickets' ? (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="space-y-3">
            {tickets.map((row) => (
              <Card key={row.id} variant="interactive" selected={detail?.id === row.id} onClick={() => void openTicket(row.id)}>
                <div className="flex justify-between gap-2"><h2 className="font-semibold">{row.ticketNo}</h2><StatePill state={row.status} /></div>
                <p className="mt-1 text-sm">{row.subject}</p>
                <p className="text-xs text-ink-500">{row.category.replaceAll('_', ' ')} · {row.priority} · {formatDateTime(row.createdAt)}</p>
              </Card>
            ))}
          </div>
          <Card>
            {busy && !detail ? <Skeleton lines={5} /> : !detail ? (
              <EmptyState title="Choose a ticket" hint="Read replies and continue the conversation here." />
            ) : (
              <div className="space-y-4">
                <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{detail.ticketNo} · {detail.subject}</h2><StatePill state={detail.status} /></div><p className="text-xs text-ink-500">{detail.tripCode ?? 'No trip linked'}</p></div>
                <div className="max-h-96 space-y-2 overflow-auto rounded-xl bg-surface-alt p-3">
                  {detail.messages.map((message) => <div key={message.id} className="rounded-xl bg-surface p-3 text-sm"><p className="font-semibold">{message.senderName ?? 'Cholo user'}</p><p>{message.body}</p><p className="text-xs text-ink-500">{formatDateTime(message.sentAt)}</p></div>)}
                </div>
                {!['resolved', 'closed'].includes(detail.status) && <><Input label="Add a reply" value={reply} onChange={(event) => setReply(event.target.value)} /><Button loading={busy} disabled={!reply.trim()} onClick={() => void sendReply()}>Send reply</Button></>}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((row) => <Card key={row.id}><div className="flex justify-between gap-2"><h2 className="font-semibold">{row.disputeNo} · {row.tripCode}</h2><StatePill state={row.status} /></div><p className="mt-1 text-sm">{row.description}</p><p className="text-xs text-ink-500">{row.disputeType.replaceAll('_', ' ')} · {row.disputedAmount ? formatBDT(row.disputedAmount) : 'No amount'} · {formatDateTime(row.createdAt)}</p>{row.resolutionNote && <p className="mt-2 rounded-xl bg-surface-alt p-3 text-sm">Resolution: {row.resolutionNote}</p>}</Card>)}
        </div>
      )}
    </main>
  );
}
