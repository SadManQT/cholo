import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { refreshAccessToken } from '../../api/client';
import * as driverApi from '../../api/driver.api';
import { BadgeCheckIcon, CarIcon, FileIcon } from '../../components/layout/icons';
import { Button, Input, toast } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { getApiErrorCode, getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';

const STEPS = [
  { icon: <BadgeCheckIcon />, title: 'Apply', hint: 'Your NID and driving license numbers' },
  { icon: <FileIcon />, title: 'Upload documents', hint: 'License, NID, photo and police clearance' },
  { icon: <CarIcon />, title: 'Add your vehicle', hint: 'Registration, fitness, insurance and tax token' },
];

export function DriverApplyPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nidNumber: '', licenseNumber: '', licenseExpiry: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (user?.roles.includes('DRIVER')) return <Navigate to="/driver/documents" replace />;

  function validate() {
    const next: Record<string, string> = {};
    if (![10, 13, 17].includes(form.nidNumber.length)) next.nidNumber = 'NID must have 10, 13 or 17 digits';
    if (!form.licenseNumber.trim()) next.licenseNumber = 'Enter your driving license number';
    if (!form.licenseExpiry) next.licenseExpiry = 'Enter the expiry date on your license';
    else if (form.licenseExpiry <= new Date().toISOString().slice(0, 10)) next.licenseExpiry = 'Your driving license must not be expired';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await driverApi.apply({ ...form, licenseNumber: form.licenseNumber.trim() });
      await refreshAccessToken();
      await refreshUser();
      toast.success('Application started. Next, upload your documents.');
      navigate('/driver/documents', { replace: true });
    } catch (thrown) {
      if (getApiErrorCode(thrown) === 'ALREADY_DRIVER') {
        await refreshAccessToken().catch(() => {});
        await refreshUser().catch(() => {});
        navigate('/driver/documents', { replace: true });
        return;
      }
      const fields = getApiFieldErrors(thrown);
      if (Object.keys(fields).length) setErrors(fields);
      else if (getApiErrorCode(thrown) === 'DUPLICATE') setErrors({ nidNumber: 'This NID or license is already registered to another driver.' });
      else toast.error(getApiErrorMessage(thrown, 'Could not submit your application.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-alt px-4 py-8">
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_1.1fr] md:items-start">
        <section className="space-y-5">
          <Link to="/" className="text-sm font-medium text-cholo-700 hover:underline">← Back to riding</Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Drive with Cholo</h1>
            <p className="mt-2 text-ink-500">Earn on your own schedule. Most drivers are reviewed within 48 hours of uploading their documents.</p>
          </div>
          <ol className="space-y-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${index === 0 ? 'bg-cholo-700 text-white' : 'bg-surface-alt text-ink-500'}`}>{step.icon}</span>
                <div>
                  <p className="font-semibold">{index + 1}. {step.title}</p>
                  <p className="text-sm text-ink-500">{step.hint}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-xl font-bold">Your details</h2>
            <p className="text-sm text-ink-500">Use the numbers exactly as printed on your cards.</p>
          </div>
          <Input
            label="National ID (NID) number"
            inputMode="numeric"
            value={form.nidNumber}
            error={errors.nidNumber}
            onChange={(event) => setForm({ ...form, nidNumber: event.target.value.replace(/\D/g, '').slice(0, 17) })}
            autoFocus
          />
          <Input
            label="Driving license number"
            value={form.licenseNumber}
            error={errors.licenseNumber}
            maxLength={30}
            onChange={(event) => setForm({ ...form, licenseNumber: event.target.value.toUpperCase() })}
          />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-900">License expiry date
            <input
              type="date"
              value={form.licenseExpiry}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setForm({ ...form, licenseExpiry: event.target.value })}
              aria-invalid={Boolean(errors.licenseExpiry) || undefined}
              className={`h-11 rounded-xl border bg-surface px-3.5 text-base focus-visible:outline-none focus-visible:ring-2 ${errors.licenseExpiry ? 'border-danger-600 focus-visible:ring-danger-600' : 'border-border focus-visible:ring-cholo-700'}`}
            />
            {errors.licenseExpiry && <span className="text-sm font-normal text-danger-600">{errors.licenseExpiry}</span>}
          </label>
          <Button type="submit" loading={submitting} className="w-full">Start application</Button>
          <p className="text-center text-xs text-ink-500">You can keep booking rides as a passenger while we review you.</p>
        </form>
      </div>
    </div>
  );
}
