import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as driverApi from '../../api/driver.api';
import * as referenceApi from '../../api/reference.api';
import { DocumentSlot } from '../../components/driver/DocumentSlot';
import { CarIcon } from '../../components/layout/icons';
import { Button, Card, EmptyState, Input, Skeleton, StatePill, toast } from '../../components/ui';
import type { DriverDocument, DriverVehicle, VehicleCategory, VehicleDocType } from '../../types/ride.types';
import { getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';
import { t } from '../../i18n';

const VEHICLE_DOCS: { type: VehicleDocType; label: string; hint: string; askExpiry?: boolean }[] = [
  { type: 'registration', label: t('Registration certificate'), hint: t('BRTA registration (blue book or smart card).') },
  { type: 'fitness', label: t('Fitness certificate'), hint: t('Current BRTA fitness certificate.'), askExpiry: true },
  { type: 'insurance', label: t('Insurance'), hint: t('Valid third-party insurance.'), askExpiry: true },
  { type: 'tax_token', label: t('Tax token'), hint: t('Current year tax token.'), askExpiry: true },
];

function VehicleDocuments({ vehicle, onChanged }: { vehicle: DriverVehicle; onChanged: () => void }) {
  const [documents, setDocuments] = useState<DriverDocument[] | null>(null);
  const load = useCallback(() => {
    driverApi.listVehicleDocuments(vehicle.id).then(setDocuments).catch(() => setDocuments([]));
  }, [vehicle.id]);
  useEffect(load, [load]);

  if (!documents) return <Skeleton lines={2} />;
  const latest = new Map<string, DriverDocument>();
  for (const document of documents) if (!latest.has(document.docType)) latest.set(document.docType, document);

  return (
    <div className="space-y-3">
      {VEHICLE_DOCS.map((doc) => (
        <DocumentSlot
          key={doc.type}
          label={doc.label}
          hint={doc.hint}
          askNumber
          askExpiry={doc.askExpiry}
          latest={latest.get(doc.type)}
          onSubmit={async (input) => { await driverApi.addVehicleDocument(vehicle.id, doc.type, input); load(); onChanged(); }}
        />
      ))}
    </div>
  );
}

function AddVehicleForm({ categories, onAdded, onCancel }: { categories: VehicleCategory[]; onAdded: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ categoryId: categories[0]?.id ?? 0, registrationNo: '', brand: '', model: '', modelYear: '', color: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (form.registrationNo.trim().length < 3) return setErrors({ registrationNo: t('Enter the registration number, e.g. DHAKA METRO GA 12-3456') });
    setBusy(true);
    setErrors({});
    try {
      await driverApi.addVehicle({
        categoryId: Number(form.categoryId),
        registrationNo: form.registrationNo.trim(),
        ...(form.brand.trim() ? { brand: form.brand.trim() } : {}),
        ...(form.model.trim() ? { model: form.model.trim() } : {}),
        ...(form.modelYear ? { modelYear: Number(form.modelYear) } : {}),
        ...(form.color.trim() ? { color: form.color.trim() } : {}),
      });
      toast.success(t('Vehicle added. Upload its documents next.'));
      onAdded();
    } catch (thrown) {
      const fields = getApiFieldErrors(thrown);
      if (Object.keys(fields).length) setErrors(fields);
      else setErrors({ registrationNo: getApiErrorMessage(thrown, t('Could not add this vehicle.')) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">{t('Add a vehicle')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">{t('Type')}
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: Number(event.target.value) })} className="h-11 rounded-xl border border-border bg-surface px-3">
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <Input label={t('Registration number')} value={form.registrationNo} error={errors.registrationNo} onChange={(event) => setForm({ ...form, registrationNo: event.target.value.toUpperCase() })} />
        <Input label={t('Brand (optional)')} value={form.brand} placeholder={t('Toyota')} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
        <Input label={t('Model (optional)')} value={form.model} placeholder={t('Axio')} onChange={(event) => setForm({ ...form, model: event.target.value })} />
        <Input label={t('Year (optional)')} inputMode="numeric" value={form.modelYear} error={errors.modelYear} onChange={(event) => setForm({ ...form, modelYear: event.target.value.replace(/\D/g, '').slice(0, 4) })} />
        <Input label={t('Colour (optional)')} value={form.color} placeholder={t('White')} onChange={(event) => setForm({ ...form, color: event.target.value })} />
      </div>
      <div className="flex gap-2">
        <Button loading={busy} onClick={() => void submit()}>{t('Add vehicle')}</Button>
        <Button variant="secondary" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </Card>
  );
}

export function DriverVehiclesPage() {
  const [vehicles, setVehicles] = useState<DriverVehicle[] | null>(null);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextVehicles, nextCategories] = await Promise.all([driverApi.listVehicles(), referenceApi.listVehicleCategories()]);
      setVehicles(nextVehicles.filter((vehicle) => vehicle.isActive));
      setCategories(nextCategories);
      setExpanded((current) => current ?? nextVehicles.find((vehicle) => vehicle.verificationStatus !== 'approved')?.id ?? null);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, t('Could not load your vehicles.')));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function putOnDuty(vehicle: DriverVehicle) {
    setBusy(vehicle.id);
    try {
      await driverApi.activateVehicle(vehicle.id);
      toast.success(t('{0} is now your on-duty vehicle.', vehicle.registrationNo));
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not switch vehicles.')));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <EmptyState title={t('Vehicles did not load')} hint={error} action={{ label: t('Retry'), onClick: () => void load() }} />;
  if (!vehicles) return <main className="mx-auto max-w-3xl space-y-3 p-4"><Skeleton variant="card" /><Skeleton variant="card" /></main>;

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/driver/account" className="text-sm font-medium text-cholo-700 hover:underline">{t('← Account')}</Link>
          <h1 className="mt-1 text-2xl font-bold">{t('Vehicles')}</h1>
          <p className="text-sm text-ink-500">{t('Each vehicle is approved separately. Only one is on duty at a time.')}</p>
        </div>
        {!adding && <Button variant="secondary" onClick={() => setAdding(true)}>{t('Add vehicle')}</Button>}
      </div>

      {adding && <AddVehicleForm categories={categories} onCancel={() => setAdding(false)} onAdded={() => { setAdding(false); void load(); }} />}

      {vehicles.length === 0 && !adding ? (
        <EmptyState icon={<CarIcon className="h-10 w-10" />} title={t('No vehicles yet')} hint={t('Add the vehicle you\'ll drive to finish your application.')} action={{ label: t('Add vehicle'), onClick: () => setAdding(true) }} />
      ) : (
        <div className="space-y-3">
          {vehicles.map((vehicle) => (
            <Card key={vehicle.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{vehicle.registrationNo}</h2>
                    <StatePill state={vehicle.verificationStatus} />
                    {vehicle.isOnDuty && <span className="rounded-full bg-cholo-700 px-2.5 py-1 text-xs font-semibold text-white">{t('On duty')}</span>}
                  </div>
                  <p className="text-sm text-ink-500">{[vehicle.categoryName, vehicle.color, vehicle.brand, vehicle.model, vehicle.modelYear].filter(Boolean).join(' · ')}</p>
                  {vehicle.verificationStatus === 'rejected' && vehicle.rejectionReason && (
                    <p className="mt-2 text-sm text-danger-600">{t('Reviewer note:')} {vehicle.rejectionReason}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {vehicle.verificationStatus === 'approved' && !vehicle.isOnDuty && (
                    <Button loading={busy === vehicle.id} onClick={() => void putOnDuty(vehicle)}>{t('Put on duty')}</Button>
                  )}
                  <Button variant="secondary" onClick={() => setExpanded(expanded === vehicle.id ? null : vehicle.id)}>
                    {expanded === vehicle.id ? t('Hide documents') : t('Documents')}
                  </Button>
                </div>
              </div>
              {expanded === vehicle.id && <div className="mt-4 border-t border-border pt-4"><VehicleDocuments vehicle={vehicle} onChanged={() => void load()} /></div>}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
