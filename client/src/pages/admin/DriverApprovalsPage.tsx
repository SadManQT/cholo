import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import { expiryFlag } from '../../utils/documents';
import { FileIcon } from '../../components/layout/icons';
import { Button, Card, Dialog, EmptyState, Skeleton, StatePill, toast } from '../../components/ui';
import type { DriverApplication, ReviewDocument, VehicleApplication } from '../../types/admin.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatDate, formatDateTime } from '../../utils/format';
import { EASE_OUT } from '../../utils/motion';
import { staggerDelaySeconds } from '../../utils/stagger';

const FLAG_TONE = { danger: 'bg-danger-600/10 text-danger-600', warn: 'bg-marigold-500/15 text-marigold-500', muted: 'bg-surface-alt text-ink-500' };

type RejectTarget =
  | { kind: 'document'; document: ReviewDocument; vehicle: boolean; title: string }
  | { kind: 'driver' | 'vehicle'; id: string; title: string };

function isPdf(url: string) {
  return /\.pdf($|\?)/i.test(url);
}

function DocumentPreview({ document }: { document: ReviewDocument }) {
  const [broken, setBroken] = useState(false);
  if (isPdf(document.fileUrl) || broken) {
    return (
      <a href={document.fileUrl} target="_blank" rel="noreferrer" className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface-alt text-xs font-medium text-cholo-700 hover:underline">
        <FileIcon className="h-6 w-6" />
        {isPdf(document.fileUrl) ? 'Open PDF' : 'Open file'}
      </a>
    );
  }
  return (
    <a href={document.fileUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border bg-surface-alt">
      <img src={document.fileUrl} alt={`${document.docType} document`} loading="lazy" onError={() => setBroken(true)} className="h-28 w-full object-cover transition-transform duration-200 hover:scale-105" />
    </a>
  );
}

function DocumentGrid({ documents, vehicle, busy, onApprove, onReject, single = false }: {
  documents: ReviewDocument[];
  vehicle: boolean;
  busy: string | null;
  onApprove: (document: ReviewDocument, vehicle: boolean) => void;
  onReject: (target: RejectTarget) => void;
  single?: boolean;
}) {
  if (documents.length === 0) return <p className="mt-3 rounded-xl bg-surface-alt p-3 text-sm text-ink-500">No documents uploaded yet.</p>;
  return (
    <div className={`mt-3 grid gap-3 ${single ? '' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
      {documents.map((document) => {
        const flag = expiryFlag(document.expiryDate);
        return (
          <div key={document.id} className="flex flex-col gap-2 rounded-xl border border-border p-2.5">
            <DocumentPreview document={document} />
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold capitalize">{document.docType.replaceAll('_', ' ')}</p>
              <StatePill state={document.status} />
            </div>
            <p className="text-xs text-ink-500">{document.docNumber ?? 'No number given'}</p>
            {flag && <span className={`self-start rounded-md px-2 py-0.5 text-[11px] font-semibold ${FLAG_TONE[flag.tone]}`}>{flag.text}</span>}
            {document.rejectionReason && <p className="text-xs text-danger-600">Rejected: {document.rejectionReason}</p>}
            {document.status === 'pending' && (
              <div className="mt-auto flex flex-wrap gap-1.5 [&>*]:flex-1">
                <Button className="h-9 px-2 text-sm" variant="secondary" disabled={busy !== null} onClick={() => onReject({ kind: 'document', document, vehicle, title: `Reject ${document.docType.replaceAll('_', ' ')}?` })}>Reject</Button>
                <Button className="h-9 px-2 text-sm" loading={busy === `doc-${document.id}`} disabled={busy !== null || flag?.tone === 'danger'} onClick={() => onApprove(document, vehicle)}>Approve</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RejectDialog({ target, onClose, onConfirm }: { target: RejectTarget; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (reason.trim().length < 3) return setError('Tell the driver what to fix, in at least 3 characters.');
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={target.title} description="The driver sees this reason and can upload a corrected copy."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void confirm()}>Reject</Button></>}>
      <div className="flex flex-wrap gap-2">
        {['Photo is blurry or cut off', 'Document is expired', 'Details don’t match the application'].map((preset) => (
          <button key={preset} type="button" onClick={() => { setReason(preset); setError(null); }} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-500 hover:border-cholo-700 hover:text-ink-900">{preset}</button>
        ))}
      </div>
      <textarea value={reason} onChange={(event) => { setReason(event.target.value); setError(null); }} rows={3} maxLength={255} autoFocus placeholder="What should the driver fix?" className={`w-full resize-none rounded-xl border bg-surface px-3.5 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 ${error ? 'border-danger-600' : 'border-border'}`} />
      {error && <p className="text-sm text-danger-600">{error}</p>}
    </Dialog>
  );
}

const cardMotion = (index: number) => ({
  layout: true,
  initial: { opacity: 0, transform: 'translateY(8px)' },
  animate: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.2, ease: EASE_OUT, delay: staggerDelaySeconds(index) } },
  exit: { opacity: 0, transform: 'translateY(-8px)', transition: { duration: 0.2, ease: EASE_OUT } },
});

export function DriverApprovalsPage({ documentsOnly = false }: { documentsOnly?: boolean }) {
  const [drivers, setDrivers] = useState<DriverApplication[]>([]);
  const [vehicles, setVehicles] = useState<VehicleApplication[]>([]);
  const [tab, setTab] = useState<'drivers' | 'vehicles'>('drivers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RejectTarget | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [driverResult, vehicleResult] = await Promise.all([adminApi.listDriverApplications(), adminApi.listVehicleApplications()]);
      setDrivers(driverResult.data);
      setVehicles(vehicleResult.data);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load approval queues.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function approveDocument(document: ReviewDocument, vehicle: boolean) {
    setBusy(`doc-${document.id}`);
    try {
      await adminApi.reviewDocument(document.id, 'approved', undefined, vehicle);
      toast.success('Document approved. The driver was notified.');
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Document review failed.'));
    } finally {
      setBusy(null);
    }
  }

  async function approve(kind: 'driver' | 'vehicle', id: string) {
    setBusy(`${kind}-${id}`);
    try {
      if (kind === 'driver') await adminApi.decideDriver(id, 'approve'); else await adminApi.decideVehicle(id, 'approve');
      toast.success(`${kind === 'driver' ? 'Driver' : 'Vehicle'} approved. The driver was notified.`);
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, `Could not approve this ${kind}.`));
    } finally {
      setBusy(null);
    }
  }

  async function confirmReject(reason: string) {
    if (!rejecting) return;
    try {
      if (rejecting.kind === 'document') await adminApi.reviewDocument(rejecting.document.id, 'rejected', reason, rejecting.vehicle);
      else if (rejecting.kind === 'driver') await adminApi.decideDriver(rejecting.id, 'reject', reason);
      else await adminApi.decideVehicle(rejecting.id, 'reject', reason);
      toast.success('Rejected. The driver was told what to fix.');
      setRejecting(null);
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not record the rejection.'));
    }
  }

  const pendingDocs = [
    ...drivers.flatMap((driver) => driver.documents.filter((doc) => doc.status === 'pending').map((doc) => ({ doc, owner: driver.fullName, detail: driver.phone, vehicle: false }))),
    ...vehicles.flatMap((vehicle) => vehicle.documents.filter((doc) => doc.status === 'pending').map((doc) => ({ doc, owner: vehicle.driverName, detail: vehicle.registrationNo, vehicle: true }))),
  ];

  const header = documentsOnly
    ? { title: 'Document review', hint: `${pendingDocs.length} document${pendingDocs.length === 1 ? '' : 's'} waiting. Check each one against the details on file.` }
    : { title: 'Driver approvals', hint: 'Approve a driver or vehicle once every required document is approved.' };

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{header.title}</h1>
        <p className="text-sm text-ink-500">{header.hint}</p>
      </div>

      {!documentsOnly && (
        <div className="inline-flex rounded-xl border border-border bg-surface p-1">
          {(['drivers', 'vehicles'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${tab === value ? 'bg-cholo-700 text-white' : 'text-ink-500 hover:text-ink-900'}`}>
              {value === 'drivers' ? `Drivers (${drivers.length})` : `Vehicles (${vehicles.length})`}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error ? (
        <EmptyState title="Queue did not load" hint={error} action={{ label: 'Retry', onClick: () => void load() }} />
      ) : documentsOnly ? (
        pendingDocs.length === 0 ? <EmptyState title="Nothing to review" hint="New uploads from drivers appear here." /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingDocs.map(({ doc, owner, detail, vehicle }) => (
              <Card key={`${vehicle ? 'v' : 'd'}-${doc.id}`} className="p-3">
                <p className="text-sm font-semibold">{owner}</p>
                <p className="text-xs text-ink-500">{detail}</p>
                <DocumentGrid single documents={[doc]} vehicle={vehicle} busy={busy} onApprove={(d, v) => void approveDocument(d, v)} onReject={setRejecting} />
              </Card>
            ))}
          </div>
        )
      ) : (tab === 'drivers' ? drivers : vehicles).length === 0 ? (
        <EmptyState title="Nothing pending" hint={`There are no pending ${tab}.`} />
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {tab === 'drivers' ? drivers.map((row, index) => (
              <motion.div key={row.id} {...cardMotion(index)}>
                <Card>
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{row.fullName}</h2>
                      <p className="text-sm text-ink-500">{row.phone} · NID {row.nidNumber} · License {row.licenseNumber}{row.licenseExpiry ? ` (expires ${formatDate(row.licenseExpiry)})` : ''}</p>
                      <p className="text-xs text-ink-500">Applied {formatDateTime(row.appliedAt)}</p>
                    </div>
                    <StatePill state={row.verificationStatus} />
                  </div>
                  <DocumentGrid documents={row.documents} vehicle={false} busy={busy} onApprove={(d, v) => void approveDocument(d, v)} onReject={setRejecting} />
                  <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                    <Button variant="secondary" disabled={busy !== null} onClick={() => setRejecting({ kind: 'driver', id: row.id, title: `Reject ${row.fullName}'s application?` })}>Reject driver</Button>
                    <Button loading={busy === `driver-${row.id}`} disabled={busy !== null} onClick={() => void approve('driver', row.id)}>Approve driver</Button>
                  </div>
                </Card>
              </motion.div>
            )) : vehicles.map((row, index) => (
              <motion.div key={row.id} {...cardMotion(index)}>
                <Card>
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{row.registrationNo} · {row.categoryName}</h2>
                      <p className="text-sm text-ink-500">{row.driverName} · {row.driverPhone}</p>
                      <p className="text-xs text-ink-500">{[row.color, row.brand, row.model, row.modelYear].filter(Boolean).join(' ') || 'No make or model given'}</p>
                    </div>
                    <StatePill state={row.verificationStatus} />
                  </div>
                  <DocumentGrid documents={row.documents} vehicle busy={busy} onApprove={(d, v) => void approveDocument(d, v)} onReject={setRejecting} />
                  <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                    <Button variant="secondary" disabled={busy !== null} onClick={() => setRejecting({ kind: 'vehicle', id: row.id, title: `Reject vehicle ${row.registrationNo}?` })}>Reject vehicle</Button>
                    <Button loading={busy === `vehicle-${row.id}`} disabled={busy !== null} onClick={() => void approve('vehicle', row.id)}>Approve vehicle</Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {rejecting && <RejectDialog target={rejecting} onClose={() => setRejecting(null)} onConfirm={confirmReject} />}
    </main>
  );
}
