import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as meApi from '../../api/me.api';
import { Button, Card, Input, StatePill, toast } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime } from '../../utils/format';

export function ProfilePage({ driverMode = false }: { driverMode?: boolean }) {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    photoUrl: user?.photoUrl ?? '',
    preferredLanguage: user?.preferredLanguage ?? 'en',
  });
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName,
      email: user.email ?? '',
      photoUrl: user.photoUrl ?? '',
      preferredLanguage: user.preferredLanguage,
    });
  }, [user]);

  if (!user) return null;

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile() {
    if (!form.fullName.trim()) {
      toast.error('Your name is required.');
      return;
    }
    setProfileBusy(true);
    try {
      await meApi.updateMe({
        fullName: form.fullName.trim(),
        preferredLanguage: form.preferredLanguage as 'bn' | 'en',
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.photoUrl.trim() ? { photoUrl: form.photoUrl.trim() } : {}),
      });
      await refreshUser();
      toast.success('Profile updated.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not update your profile.'));
    } finally {
      setProfileBusy(false);
    }
  }

  async function savePassword() {
    if (password.next.length < 8) {
      toast.error('The new password must be at least 8 characters.');
      return;
    }
    if (password.next !== password.confirm) {
      toast.error('New password confirmation does not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      await meApi.changePassword(password.current, password.next);
      setPassword({ current: '', next: '', confirm: '' });
      toast.success('Password changed. Other sessions were signed out.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not change your password.'));
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

  const supportPath = driverMode ? '/driver/support' : '/support';
  const initials = user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-ink-500">Personal details, language, and session security.</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          {user.photoUrl ? <img src={user.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cholo-700 text-lg font-bold text-white">{initials}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{user.fullName}</h2>
            <p className="text-sm text-ink-500">{user.phone} · Joined {formatDateTime(user.createdAt)}</p>
            <div className="mt-2 flex flex-wrap gap-2">{user.roles.map((role) => <StatePill key={role} state={role.toLowerCase()} />)}</div>
          </div>
          <p className="text-sm font-semibold">Wallet {formatBDT(user.wallet.balance)}</p>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Profile details</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Input label="Full name" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} />
          <Input label="Email" value={form.email} onChange={(event) => update('email', event.target.value)} />
          <Input label="Photo URL (optional)" value={form.photoUrl} onChange={(event) => update('photoUrl', event.target.value)} />
          <label className="text-sm font-medium">Preferred language
            <select value={form.preferredLanguage} onChange={(event) => update('preferredLanguage', event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3">
              <option value="en">English</option><option value="bn">Bangla</option>
            </select>
          </label>
        </div>
        <Button className="mt-4" loading={profileBusy} onClick={() => void saveProfile()}>Save profile</Button>
      </Card>

      <Card>
        <h2 className="font-semibold">Change password</h2>
        <p className="text-sm text-ink-500">Changing it revokes every other signed-in session.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Input variant="password" label="Current password" value={password.current} onChange={(event) => setPassword((current) => ({ ...current, current: event.target.value }))} />
          <Input variant="password" label="New password" value={password.next} onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))} />
          <Input variant="password" label="Confirm new password" value={password.confirm} onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))} />
        </div>
        <Button className="mt-4" variant="secondary" loading={passwordBusy} disabled={!password.current || !password.next || !password.confirm} onClick={() => void savePassword()}>Change password</Button>
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <Link className="flex h-11 items-center rounded-xl border border-border bg-surface px-4 font-semibold text-cholo-700" to={supportPath}>Support & disputes</Link>
        <Button variant="danger" onClick={() => void signOut()}>Sign out</Button>
      </div>
    </main>
  );
}
