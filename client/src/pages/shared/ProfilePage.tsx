import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as meApi from '../../api/me.api';
import { ACCEPTED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, uploadFile } from '../../api/uploads.api';
import { BanknoteIcon, CarIcon, FileIcon, LifebuoyIcon, PinIcon, SirenIcon, TagIcon } from '../../components/layout/icons';
import { Button, Card, Input, StatePill, toast } from '../../components/ui';
import { useAuth } from '../../context/auth';
import type { EmergencyContact } from '../../types/place.types';
import { getApiErrorCode, getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';
import { formatBDT, formatDate } from '../../utils/format';

interface MenuRow {
  to: string;
  label: string;
  hint: string;
  icon: ReactNode;
}

const PASSENGER_MENU: MenuRow[] = [
  { to: '/account/places', label: 'Saved places', hint: 'Home, university and other shortcuts', icon: <PinIcon /> },
  { to: '/promos', label: 'Promos', hint: 'Codes available in your city', icon: <TagIcon /> },
  { to: '/support', label: 'Support & disputes', hint: 'Get help or contest a fare', icon: <LifebuoyIcon /> },
];

const DRIVER_MENU: MenuRow[] = [
  { to: '/driver/documents', label: 'Documents', hint: 'License, NID, photo and police clearance', icon: <FileIcon /> },
  { to: '/driver/vehicles', label: 'Vehicles', hint: 'Add a vehicle or choose which one is on duty', icon: <CarIcon /> },
  { to: '/driver/withdrawals', label: 'Withdrawals', hint: 'Payout accounts and cash-out requests', icon: <BanknoteIcon /> },
  { to: '/driver/support', label: 'Support & disputes', hint: 'Get help from the Cholo team', icon: <LifebuoyIcon /> },
];

function ChevronRight() {
  return (
    <svg className="h-4 w-4 text-ink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmergencyContacts() {
  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [draft, setDraft] = useState({ name: '', phone: '', relationship: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    meApi.listEmergencyContacts().then(setContacts).catch(() => setContacts([]));
  }, []);
  useEffect(load, [load]);

  async function add() {
    setBusy(true);
    setErrors({});
    try {
      const created = await meApi.addEmergencyContact({
        name: draft.name.trim(),
        phone: draft.phone,
        ...(draft.relationship.trim() ? { relationship: draft.relationship.trim() } : {}),
      });
      setContacts((current) => [...(current ?? []), created]);
      setDraft({ name: '', phone: '', relationship: '' });
      setAdding(false);
      toast.success(`${created.name} will be alerted if you send an SOS.`);
    } catch (thrown) {
      const fields = getApiFieldErrors(thrown);
      if (Object.keys(fields).length) setErrors(fields);
      else toast.error(getApiErrorMessage(thrown, 'Could not add this contact.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(contact: EmergencyContact) {
    try {
      await meApi.removeEmergencyContact(contact.id);
      setContacts((current) => current?.filter((item) => item.id !== contact.id) ?? null);
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not remove this contact.'));
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="mt-0.5 text-danger-600"><SirenIcon /></span>
          <div>
            <h2 className="font-semibold">Emergency contacts</h2>
            <p className="text-sm text-ink-500">We alert them if you send an SOS during a trip. Up to 5.</p>
          </div>
        </div>
        {!adding && (contacts?.length ?? 0) < 5 && <Button variant="secondary" onClick={() => setAdding(true)}>Add</Button>}
      </div>
      {contacts && contacts.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div>
                <p className="font-medium">{contact.name}{contact.relationship ? <span className="font-normal text-ink-500"> · {contact.relationship}</span> : null}</p>
                <p className="text-ink-500">{contact.phone}</p>
              </div>
              <button type="button" className="text-sm font-medium text-danger-600 hover:underline" onClick={() => void remove(contact)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {contacts?.length === 0 && !adding && <p className="mt-3 rounded-xl bg-surface-alt p-3 text-sm text-ink-500">No emergency contacts yet. Add someone you trust.</p>}
      {adding && (
        <div className="mt-3 grid gap-3 rounded-xl border border-border p-3 md:grid-cols-3">
          <Input label="Name" value={draft.name} error={errors.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus />
          <Input variant="phone" label="Phone" value={draft.phone} error={errors.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
          <Input label="Relationship (optional)" placeholder="Mother, friend…" value={draft.relationship} onChange={(event) => setDraft({ ...draft, relationship: event.target.value })} />
          <div className="flex gap-2 md:col-span-3">
            <Button loading={busy} onClick={() => void add()}>Save contact</Button>
            <Button variant="secondary" onClick={() => { setAdding(false); setErrors({}); }}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ProfilePage({ driverMode = false }: { driverMode?: boolean }) {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const photoInput = useRef<HTMLInputElement>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    preferredLanguage: user?.preferredLanguage ?? 'en',
  });
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    if (!user) return;
    setForm({ fullName: user.fullName, email: user.email ?? '', preferredLanguage: user.preferredLanguage });
  }, [user]);

  if (!user) return null;

  async function saveProfile() {
    if (!form.fullName.trim()) {
      setProfileErrors({ fullName: 'Enter your full name' });
      return;
    }
    setProfileBusy(true);
    setProfileErrors({});
    try {
      await meApi.updateMe({
        fullName: form.fullName.trim(),
        preferredLanguage: form.preferredLanguage as 'bn' | 'en',
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
      });
      await refreshUser();
      toast.success('Profile updated.');
    } catch (thrown) {
      const fields = getApiFieldErrors(thrown);
      if (Object.keys(fields).length) setProfileErrors(fields);
      else toast.error(getApiErrorMessage(thrown, 'Could not update your profile.'));
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePhoto(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_UPLOAD_TYPES.includes(file.type) || file.type === 'application/pdf' || file.size > MAX_UPLOAD_BYTES) {
      toast.error('Choose a JPG, PNG or WebP photo up to 5 MB.');
      return;
    }
    setPhotoBusy(true);
    try {
      await meApi.updateMe({ photoUrl: await uploadFile(file) });
      await refreshUser();
      toast.success('Photo updated.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not update your photo.'));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function savePassword() {
    const errors: Record<string, string> = {};
    if (!password.current) errors.currentPassword = 'Enter your current password';
    if (password.next.length < 8) errors.newPassword = 'Password must be at least 8 characters';
    if (password.next !== password.confirm) errors.confirm = 'Passwords do not match';
    setPasswordErrors(errors);
    if (Object.keys(errors).length) return;

    setPasswordBusy(true);
    try {
      await meApi.changePassword(password.current, password.next);
      setPassword({ current: '', next: '', confirm: '' });
      toast.success('Password changed. Other sessions were signed out.');
    } catch (thrown) {
      const fields = getApiFieldErrors(thrown);
      if (Object.keys(fields).length) setPasswordErrors(fields);
      else if (getApiErrorCode(thrown) === 'CURRENT_PASSWORD_INVALID') setPasswordErrors({ currentPassword: getApiErrorMessage(thrown) });
      else toast.error(getApiErrorMessage(thrown, 'Could not change your password.'));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function signOut() {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not sign out.'));
    }
  }

  const initials = user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const switchRow: MenuRow | null = driverMode && user.roles.includes('PASSENGER')
    ? { to: '/', label: 'Switch to riding', hint: 'Book a ride as a passenger', icon: <PinIcon /> }
    : !driverMode && user.roles.includes('DRIVER')
      ? { to: '/driver', label: 'Switch to driving', hint: 'Go online and receive ride offers', icon: <CarIcon /> }
      : !driverMode
        ? { to: '/driver/apply', label: 'Drive with Cholo', hint: 'Earn on your own schedule', icon: <CarIcon /> }
        : null;
  const menu = [...(driverMode ? DRIVER_MENU : PASSENGER_MENU), ...(switchRow ? [switchRow] : [])];

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Account</h1>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 focus-visible:ring-offset-2"
            aria-label="Change profile photo"
          >
            {user.photoUrl
              ? <img src={user.photoUrl} alt="" className="h-full w-full object-cover" />
              : <span className="flex h-full w-full items-center justify-center bg-cholo-700 text-lg font-bold text-white">{initials}</span>}
            <span className={`absolute inset-0 flex items-center justify-center bg-ink-900/55 text-[11px] font-semibold text-white transition-opacity ${photoBusy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>
              {photoBusy ? '…' : 'Change'}
            </span>
          </button>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void changePhoto(event.target.files?.[0]); event.target.value = ''; }} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{user.fullName}</h2>
            <p className="text-sm text-ink-500">{user.phone} · Member since {formatDate(user.createdAt)}</p>
            <div className="mt-2 flex flex-wrap gap-2">{user.roles.map((role) => <StatePill key={role} state={role.toLowerCase()} />)}</div>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Wallet</p>
            <p className="text-lg font-bold tabular-nums">{formatBDT(user.wallet.balance)}</p>
          </div>
        </div>
      </Card>

      <nav aria-label="Account" className="overflow-hidden rounded-2xl border border-border bg-surface">
        {menu.map((row) => (
          <Link key={row.to} to={row.to} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0 hover:bg-surface-alt focus-visible:bg-surface-alt focus-visible:outline-none">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cholo-50 text-cholo-700">{row.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink-900">{row.label}</span>
              <span className="block truncate text-sm text-ink-500">{row.hint}</span>
            </span>
            <ChevronRight />
          </Link>
        ))}
      </nav>

      <EmergencyContacts />

      <Card>
        <h2 className="font-semibold">Profile details</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Input label="Full name" value={form.fullName} error={profileErrors.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          <Input label="Email (optional)" inputMode="email" value={form.email} error={profileErrors.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <label className="text-sm font-medium md:col-span-2">Preferred language
            <select value={form.preferredLanguage} onChange={(event) => setForm({ ...form, preferredLanguage: event.target.value as 'bn' | 'en' })} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 md:w-1/2">
              <option value="en">English</option><option value="bn">বাংলা (Bangla)</option>
            </select>
          </label>
        </div>
        <Button className="mt-4" loading={profileBusy} onClick={() => void saveProfile()}>Save profile</Button>
      </Card>

      <Card>
        <h2 className="font-semibold">Change password</h2>
        <p className="text-sm text-ink-500">Changing it signs you out on every other device.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Input variant="password" label="Current password" value={password.current} error={passwordErrors.currentPassword} onChange={(event) => setPassword({ ...password, current: event.target.value })} />
          <Input variant="password" label="New password" value={password.next} error={passwordErrors.newPassword} onChange={(event) => setPassword({ ...password, next: event.target.value })} />
          <Input variant="password" label="Confirm new password" value={password.confirm} error={passwordErrors.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} />
        </div>
        <Button className="mt-4" variant="secondary" loading={passwordBusy} onClick={() => void savePassword()}>Change password</Button>
      </Card>

      <Button variant="danger" className="w-full md:w-auto" onClick={() => void signOut()}>Sign out</Button>
    </main>
  );
}
