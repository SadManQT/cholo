import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as authApi from '../../api/auth.api';
import { Button, Input, OtpInput, toast } from '../../components/ui';
import { useCountdown } from '../../hooks/useCountdown';
import { getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';

type Step = 'phone' | 'code' | 'password';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const MIN_PASSWORD_LENGTH = 8;

const STEP_COPY: Record<Step, { title: string; hint: (phone: string) => string }> = {
  phone: { title: 'Reset your password', hint: () => 'Enter the phone number on your account and we’ll text you a code.' },
  code: { title: 'Enter the code', hint: (phone) => `We sent a 6-digit code to ${phone}.` },
  password: { title: 'Choose a new password', hint: () => 'You’ll be signed out everywhere else once it’s saved.' },
};

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState(searchParams.get('phone') ?? '');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const resend = useCountdown();

  function fail(thrown: unknown, fallback: string) {
    const fields = getApiFieldErrors(thrown);
    setErrors(Object.keys(fields).length ? fields : { form: getApiErrorMessage(thrown, fallback) });
  }

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      setErrors({ phone: phone.length < 11 ? `Phone number is incomplete (${phone.length} of 11 digits)` : 'Phone number format is invalid' });
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      await authApi.requestPasswordReset(phone);
      setStep('code');
      setCode('');
      resend.start(RESEND_COOLDOWN_SECONDS);
      if (step === 'code') toast.success('A new code is on its way.');
    } catch (thrown) {
      fail(thrown, 'Could not send a code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(otp: string) {
    if (submitting) return;
    setSubmitting(true);
    setErrors({});
    try {
      setResetToken(await authApi.verifyPasswordResetCode(phone, otp));
      setStep('password');
    } catch (thrown) {
      fail(thrown, 'That code didn’t work. Please try again.');
      setCode('');
    } finally {
      setSubmitting(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (password.length < MIN_PASSWORD_LENGTH) nextErrors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    if (confirm !== password) nextErrors.confirmPassword = 'Passwords do not match';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword(resetToken, password, confirm);
      toast.success('Password updated. Log in with your new password.');
      navigate(`/login?phone=${phone}`, { replace: true });
    } catch (thrown) {
      fail(thrown, 'Could not save your new password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const copy = STEP_COPY[step];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <ol className="mb-4 flex gap-1.5" aria-label={`Step ${['phone', 'code', 'password'].indexOf(step) + 1} of 3`}>
          {(['phone', 'code', 'password'] as Step[]).map((item, index) => (
            <li
              key={item}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${index <= ['phone', 'code', 'password'].indexOf(step) ? 'bg-cholo-700' : 'bg-border'}`}
            />
          ))}
        </ol>
        <h1 className="text-2xl font-bold text-ink-900">{copy.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{copy.hint(phone)}</p>
        {step === 'code' && import.meta.env.DEV && (
          <p className="mt-2 rounded-lg bg-info-600/10 px-3 py-2 text-xs text-info-600">
            Development mode: SMS is mocked. Copy the code from the API terminal&apos;s “Mock SMS sent” log.
          </p>
        )}
      </div>

      {step === 'phone' && (
        <form onSubmit={sendCode} noValidate className="flex flex-col gap-4">
          <Input
            variant="phone"
            label="Phone"
            value={phone}
            onChange={(event) => { setPhone(event.target.value); setErrors({}); }}
            error={errors.phone}
            autoFocus
          />
          {errors.form && <p className="text-sm text-danger-600">{errors.form}</p>}
          <Button type="submit" loading={submitting} className="w-full">Send code</Button>
        </form>
      )}

      {step === 'code' && (
        <div className="flex flex-col gap-4">
          <OtpInput length={OTP_LENGTH} value={code} onChange={setCode} onComplete={verify} error={Boolean(errors.form || errors.otp)} disabled={submitting} />
          {(errors.form || errors.otp) && <p className="text-sm text-danger-600">{errors.form ?? errors.otp}</p>}
          <Button loading={submitting} disabled={code.length !== OTP_LENGTH} onClick={() => verify(code)} className="w-full">Continue</Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-ink-500 hover:text-ink-900" onClick={() => { setStep('phone'); setErrors({}); }}>Change number</button>
            {resend.isActive
              ? <span className="text-ink-500">Resend in {resend.remaining}s</span>
              : <button type="button" className="text-cholo-700 hover:underline" onClick={() => void sendCode()}>Resend code</button>}
          </div>
        </div>
      )}

      {step === 'password' && (
        <form onSubmit={save} noValidate className="flex flex-col gap-4">
          <Input variant="password" label="New password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors({}); }} error={errors.newPassword} autoFocus />
          <Input variant="password" label="Confirm new password" value={confirm} onChange={(event) => { setConfirm(event.target.value); setErrors({}); }} error={errors.confirmPassword} />
          {errors.form && <p className="text-sm text-danger-600">{errors.form}</p>}
          <Button type="submit" loading={submitting} className="w-full">Save new password</Button>
        </form>
      )}

      <p className="text-center text-sm text-ink-500">
        Remembered it? <Link to="/login" className="text-cholo-700 hover:underline">Log in</Link>
      </p>
    </div>
  );
}
