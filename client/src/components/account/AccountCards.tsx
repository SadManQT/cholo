import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as meApi from '../../api/me.api';
import type { FavoriteDriver, ReferralSummary } from '../../api/me.api';
import { useAuth } from '../../context/auth';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { getApiErrorCode, getApiErrorMessage } from '../../utils/apiError';
import { formatBDT } from '../../utils/format';
import { GiftIcon, ShieldIcon } from '../layout/icons';
import { Button, Card, Dialog, Input, toast } from '../ui';
import { t } from '../../i18n';

export function InviteFriendsCard() {
  const [referral, setReferral] = useState<ReferralSummary | null>(null);

  useEffect(() => {
    meApi.getReferral().then(setReferral).catch(() => {});
  }, []);

  if (!referral?.code) return null;
  const link = `${window.location.origin}/register?ref=${referral.code}`;
  const message = `Ride with Cholo and we both get ${formatBDT(referral.bonus)} after your first trip. Use my code ${referral.code}: ${link}`;

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: t('Join me on Cholo'), text: message });
      else {
        await navigator.clipboard.writeText(message);
        toast.success(t('Invite copied. Paste it into any chat.'));
      }
    } catch {
      // The user closed the share sheet.
    }
  }

  return (
    <Card>
      <div className="flex gap-3">
        <span className="mt-0.5 text-cholo-700"><GiftIcon /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{t('Invite friends, get {0}', formatBDT(referral.bonus))}</h2>
          <p className="text-sm text-ink-500">{t('When a friend signs up with your code and finishes their first ride, you both get {0} in your wallet.', formatBDT(referral.bonus))}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-dashed border-cholo-700 bg-cholo-50 px-4 py-2 font-mono text-lg font-bold tracking-widest text-cholo-700">{referral.code}</span>
            <Button variant="secondary" onClick={() => void share()}>{t('Share invite')}</Button>
          </div>
          <p className="mt-2 text-sm text-ink-500">
            {t('{0} joined · {1} rode · {2} earned', referral.invited, referral.rewarded, formatBDT(referral.earned))}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function FavoriteDriversCard() {
  const [drivers, setDrivers] = useState<FavoriteDriver[] | null>(null);

  useEffect(() => {
    meApi.listFavoriteDrivers().then(setDrivers).catch(() => setDrivers([]));
  }, []);

  async function remove(driver: FavoriteDriver) {
    try {
      await meApi.setFavoriteDriver(driver.id, false);
      setDrivers((current) => current?.filter((item) => item.id !== driver.id) ?? null);
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not remove this driver.')));
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">{t('Favourite drivers')}</h2>
      <p className="text-sm text-ink-500">{t('When one of them is nearby, they get your ride request first. Add drivers from a trip receipt.')}</p>
      {drivers && drivers.length > 0 ? (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {drivers.map((driver) => (
            <li key={driver.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              {driver.photoUrl
                ? <img src={driver.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cholo-50 font-bold text-cholo-700">{driver.name.charAt(0)}</span>}
              <span className="min-w-0 flex-1 font-medium">{driver.name} <span className="font-normal text-ink-500">· ★ {Number(driver.rating).toFixed(1)}</span></span>
              <button type="button" className="text-sm font-medium text-danger-600 hover:underline" onClick={() => void remove(driver)}>{t('Remove')}</button>
            </li>
          ))}
        </ul>
      ) : drivers && (
        <p className="mt-3 rounded-xl bg-surface-alt p-3 text-sm text-ink-500">{t('No favourites yet.')}</p>
      )}
    </Card>
  );
}

export function TwoFactorCard() {
  const [status, setStatus] = useState<{ enabled: boolean } | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    meApi.getTwoFactor().then(setStatus).catch(() => {});
  }, []);

  async function begin() {
    setBusy(true);
    try {
      setSetup(await meApi.startTwoFactorSetup());
      setCode('');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not start setup.')));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      if (disabling) {
        await meApi.disableTwoFactor(code);
        setStatus({ enabled: false });
        setDisabling(false);
        toast.info(t('Two-step login is off.'));
      } else {
        await meApi.enableTwoFactor(code);
        setStatus({ enabled: true });
        setSetup(null);
        toast.success(t('Two-step login is on. You will need your app every time you sign in.'));
      }
      setCode('');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('That code did not work.')));
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  const askingForCode = Boolean(setup) || disabling;

  return (
    <Card>
      <div className="flex gap-3">
        <span className="mt-0.5 text-cholo-700"><ShieldIcon /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{t('Two-step login')} {status.enabled ? <span className="ml-1 rounded-full bg-cholo-50 px-2 py-0.5 text-xs text-cholo-700">{t('On')}</span> : null}</h2>
          <p className="text-sm text-ink-500">
            {t('Admin accounts can refund money and suspend people. With two-step login, a stolen password is not enough: you also need a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password).')}
          </p>

          {setup && (
            <div className="mt-3 flex flex-wrap items-start gap-4 rounded-xl border border-border p-3">
              <img src={setup.qrDataUrl} alt={t('QR code for your authenticator app')} className="h-44 w-44 rounded-lg bg-white p-1" />
              <ol className="min-w-[14rem] flex-1 list-decimal space-y-1 pl-5 text-sm">
                <li>{t('Open your authenticator app and add an account.')}</li>
                <li>{t('Scan this QR code, or type this key:')} <code className="break-all rounded bg-surface-alt px-1 font-mono text-xs">{setup.secret}</code></li>
                <li>{t('Enter the 6-digit code it shows.')}</li>
              </ol>
            </div>
          )}

          {askingForCode && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Input
                label={disabling ? t('Current code from your app') : t('Code from your app')}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                containerClassName="w-44"
                autoFocus
              />
              <Button loading={busy} disabled={code.length !== 6} onClick={() => void confirm()}>{disabling ? t('Turn off') : t('Turn on')}</Button>
              <Button variant="ghost" onClick={() => { setSetup(null); setDisabling(false); setCode(''); }}>{t('Cancel')}</Button>
            </div>
          )}

          {!askingForCode && (
            <div className="mt-3">
              {status.enabled
                ? <Button variant="secondary" onClick={() => setDisabling(true)}>{t('Turn off')}</Button>
                : <Button loading={busy} onClick={() => void begin()}>{t('Set up two-step login')}</Button>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function InstallAppCard() {
  const { canInstall, install, installed } = useInstallPrompt();
  if (installed || !canInstall) return null;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold">{t('Install Cholo')}</h2>
        <p className="text-sm text-ink-500">{t('Add Cholo to your home screen. It opens like an app and loads faster.')}</p>
      </div>
      <Button variant="secondary" onClick={() => void install()}>{t('Install')}</Button>
    </Card>
  );
}

export function DeleteAccountCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    setError(undefined);
    try {
      await meApi.deleteAccount(password);
      await logout().catch(() => {});
      toast.info(t('Your account was deleted.'));
      navigate('/welcome', { replace: true });
    } catch (thrown) {
      if (getApiErrorCode(thrown) === 'CURRENT_PASSWORD_INVALID') setError(t('That password is not correct.'));
      else toast.error(getApiErrorMessage(thrown, t('Could not delete your account.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-danger-600/30">
      <h2 className="font-semibold text-danger-600">{t('Delete account')}</h2>
      <p className="text-sm text-ink-500">
        {t('Removes your name, phone, email and photo and signs you out everywhere. Trip receipts and payments stay in our records, as the law requires. Withdraw any wallet balance first; it can\'t be paid out afterwards.')}
      </p>
      <Button variant="danger" className="mt-3" onClick={() => setOpen(true)}>{t('Delete my account')}</Button>
      <Dialog
        open={open}
        title={t('Delete your account?')}
        description={t('This can\'t be undone. You can sign up again later with the same phone number, as a new account.')}
        onClose={() => { setOpen(false); setPassword(''); setError(undefined); }}
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>{t('Keep my account')}</Button>
          <Button variant="danger" loading={busy} disabled={!password} onClick={() => void remove()}>{t('Delete forever')}</Button>
        </>}
      >
        <Input variant="password" label={t('Enter your password to confirm')} value={password} error={error} onChange={(event) => setPassword(event.target.value)} autoFocus />
      </Dialog>
    </Card>
  );
}
