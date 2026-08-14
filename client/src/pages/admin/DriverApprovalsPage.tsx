import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import { Button, Card, EmptyState, Skeleton, StatePill, toast } from '../../components/ui';
import type { DriverApplication, ReviewDocument, VehicleApplication } from '../../types/admin.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatDateTime } from '../../utils/format';

function DocumentRows({ documents, vehicle, busy, onDone }: { documents: ReviewDocument[]; vehicle: boolean; busy: string | null; onDone: () => void }) {
  async function decide(document: ReviewDocument, status: 'approved' | 'rejected') {
    const reason = status === 'rejected' ? window.prompt('Why is this document rejected?')?.trim() : undefined;
    if (status === 'rejected' && !reason) return;
    try {
      await adminApi.reviewDocument(document.id, status, reason, vehicle);
      toast.success(`Document ${status}.`);
      onDone();
    } catch (thrown) { toast.error(getApiErrorMessage(thrown, 'Document review failed.')); }
  }
  return <div className="mt-3 divide-y divide-border rounded-xl border border-border">
    {documents.length === 0 ? <p className="p-3 text-sm text-ink-500">No documents uploaded.</p> : documents.map((document) => (
      <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
        <div><a className="font-semibold text-cholo-700 underline" href={document.fileUrl} target="_blank" rel="noreferrer">{document.docType.replaceAll('_', ' ')}</a><p className="text-xs text-ink-500">{document.docNumber ?? 'No document number'} · expires {document.expiryDate ?? 'not set'}</p></div>
        <div className="flex items-center gap-2"><StatePill state={document.status} />{document.status === 'pending' && <><Button className="h-9 px-3 text-sm" variant="secondary" disabled={busy != null} onClick={() => void decide(document, 'rejected')}>Reject</Button><Button className="h-9 px-3 text-sm" disabled={busy != null} onClick={() => void decide(document, 'approved')}>Approve</Button></>}</div>
      </div>
    ))}
  </div>;
}

export function DriverApprovalsPage() {
  const [drivers, setDrivers] = useState<DriverApplication[]>([]);
  const [vehicles, setVehicles] = useState<VehicleApplication[]>([]);
  const [tab, setTab] = useState<'drivers' | 'vehicles'>('drivers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [driverResult, vehicleResult] = await Promise.all([adminApi.listDriverApplications(), adminApi.listVehicleApplications()]);
      setDrivers(driverResult.data); setVehicles(vehicleResult.data);
    } catch (thrown) { setError(getApiErrorMessage(thrown, 'Could not load approval queues.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function decide(kind: 'driver' | 'vehicle', id: string, decision: 'approve' | 'reject') {
    const reason = decision === 'reject' ? window.prompt(`Why is this ${kind} rejected?`)?.trim() : undefined;
    if (decision === 'reject' && !reason) return;
    setBusy(`${kind}-${id}`);
    try {
      if (kind === 'driver') await adminApi.decideDriver(id, decision, reason); else await adminApi.decideVehicle(id, decision, reason);
      toast.success(`${kind === 'driver' ? 'Driver' : 'Vehicle'} ${decision}d.`); await load();
    } catch (thrown) { toast.error(getApiErrorMessage(thrown, `${kind} decision failed.`)); }
    finally { setBusy(null); }
  }

  const rows = tab === 'drivers' ? drivers : vehicles;
  return <main className="mx-auto max-w-5xl space-y-5">
    <div><h1 className="text-2xl font-bold">Approval queue</h1><p className="text-sm text-ink-500">Review every required document before approving a profile.</p></div>
    <div className="flex gap-2"><Button variant={tab === 'drivers' ? 'primary' : 'secondary'} onClick={() => setTab('drivers')}>Drivers ({drivers.length})</Button><Button variant={tab === 'vehicles' ? 'primary' : 'secondary'} onClick={() => setTab('vehicles')}>Vehicles ({vehicles.length})</Button></div>
    {loading ? <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div> : error && rows.length === 0 ? <EmptyState title="Queue did not load" hint={error} action={{ label: 'Retry', onClick: load }} /> : rows.length === 0 ? <EmptyState title="Nothing pending" hint={`There are no pending ${tab}.`} /> : <div className="space-y-4">
      {tab === 'drivers' ? drivers.map((row) => <Card key={row.id}>
        <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{row.fullName}</h2><p className="text-sm text-ink-500">{row.phone} · NID {row.nidNumber} · License {row.licenseNumber}</p><p className="text-xs text-ink-500">Applied {formatDateTime(row.appliedAt)}</p></div><StatePill state={row.verificationStatus} /></div>
        <DocumentRows documents={row.documents} vehicle={false} busy={busy} onDone={load} />
        <div className="mt-3 flex justify-end gap-2"><Button variant="secondary" disabled={busy != null} onClick={() => void decide('driver', row.id, 'reject')}>Reject</Button><Button loading={busy === `driver-${row.id}`} onClick={() => void decide('driver', row.id, 'approve')}>Approve driver</Button></div>
      </Card>) : vehicles.map((row) => <Card key={row.id}>
        <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{row.registrationNo} · {row.categoryName}</h2><p className="text-sm text-ink-500">{row.driverName} · {row.driverPhone}</p><p className="text-xs text-ink-500">{[row.color, row.brand, row.model, row.modelYear].filter(Boolean).join(' ')}</p></div><StatePill state={row.verificationStatus} /></div>
        <DocumentRows documents={row.documents} vehicle busy={busy} onDone={load} />
        <div className="mt-3 flex justify-end gap-2"><Button variant="secondary" disabled={busy != null} onClick={() => void decide('vehicle', row.id, 'reject')}>Reject</Button><Button loading={busy === `vehicle-${row.id}`} onClick={() => void decide('vehicle', row.id, 'approve')}>Approve vehicle</Button></div>
      </Card>)}
    </div>}
  </main>;
}
