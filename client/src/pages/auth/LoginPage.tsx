import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, toast } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { getApiErrorCode, getApiErrorMessage, getSuspension } from '../../utils/apiError';
import { formatDateTime } from '../../utils/format';
import { roleHomePath } from '../../utils/roleHomePath';

export function LoginPage() {
  const { login, completeTwoFactor } = useAuth();
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState(searchParams.get('phone') ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suspension, setSuspension] = useState<{ reason: string | null; until: string | null } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuspension(null);

    try {
      const result = challengeToken ? await completeTwoFactor(challengeToken, code) : await login(phone, password);
      if ('challengeToken' in result) {
        setChallengeToken(result.challengeToken);
        return;
      }
      const user = result;
      toast.success('Welcome back!');
      navigate(roleHomePath(user.roles), { replace: true });
    } catch (thrown) {
      const suspended = getSuspension(thrown);
      if (suspended) {
        setSuspension(suspended);
        return;
      }
      const message = getApiErrorMessage(thrown, 'Could not log in. Please try again.');
      if (getApiErrorCode(thrown) === 'TOTP_CHALLENGE_EXPIRED') {
        setChallengeToken(null);
        setCode('');
      }
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (challengeToken) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Two-step login</h1>
          <p className="mt-1 text-sm text-ink-500">Open your authenticator app and enter the 6-digit code for Cholo Admin.</p>
        </div>
        <Input
          label="Authentication code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          autoFocus
          required
        />
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <Button type="submit" loading={submitting} disabled={code.length !== 6} className="w-full">Verify and log in</Button>
        <button type="button" className="text-center text-sm text-cholo-700 hover:underline" onClick={() => { setChallengeToken(null); setCode(''); setError(null); }}>
          Use a different account
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Log in</h1>
        <p className="mt-1 text-sm text-ink-500">Welcome back to Cholo.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          variant="phone"
          label="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          autoFocus={!phone}
        />
        <Input
          variant="password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoFocus={Boolean(phone)}
        />
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}
      {suspension && (
        <div role="alert" className="rounded-xl border border-danger-600/30 bg-danger-600/5 p-4 text-sm">
          <p className="font-semibold text-danger-600">This account is suspended</p>
          {suspension.reason && <p className="mt-1 text-ink-900">Reason: {suspension.reason}</p>}
          <p className="mt-1 text-ink-500">
            {suspension.until ? `You can log in again after ${formatDateTime(suspension.until)}.` : 'The suspension has no end date. Contact support if you think this is a mistake.'}
          </p>
        </div>
      )}

      <Button type="submit" variant="primary" loading={submitting} className="w-full">
        Log in
      </Button>

      <Link to={phone ? `/forgot-password?phone=${phone}` : '/forgot-password'} className="text-center text-sm text-cholo-700 hover:underline">
        Forgot password?
      </Link>

      <p className="text-center text-sm text-ink-500">
        New to Cholo?{' '}
        <Link to="/register" className="text-cholo-700 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
