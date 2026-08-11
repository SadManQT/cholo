import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as authApi from '../../api/auth.api';
import { Button, Input, toast } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';

// doc 12 §4: "Register | /register | name + phone + password (+ referral) |
// Input(phone), password strength hint | single column, one screen, no
// scroll." Referral is in the doc's own field list but the real API
// (server/src/validators/auth.schema.js's registerSchema) doesn't accept
// one yet — "no mock data" means this form only collects what the backend
// actually does something with.
const MIN_PASSWORD_LENGTH = 8;

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Register doesn't mint a session (server/src/services/auth.service.js
      // returns only {userId} and sends an OTP) — nothing for AuthContext
      // to hold yet, so this calls the api/ layer directly rather than
      // routing through useAuth().
      await authApi.register({ fullName, phone, password });
      navigate(`/verify?phone=${encodeURIComponent(phone)}`);
    } catch (thrown) {
      const message = getApiErrorMessage(thrown, 'Could not create your account. Please try again.');
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Create your account</h1>
        <p className="mt-1 text-sm text-ink-500">Book your first ride in under two minutes.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          maxLength={120}
          autoFocus
        />
        <Input
          variant="phone"
          label="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
        <div>
          <Input
            variant="password"
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
          <p className={`mt-1.5 text-xs ${passwordLongEnough ? 'text-cholo-700' : 'text-ink-500'}`}>
            {passwordLongEnough ? '✓ ' : ''}At least {MIN_PASSWORD_LENGTH} characters
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}

      <Button type="submit" variant="primary" loading={submitting} className="w-full">
        Create account
      </Button>

      <p className="text-center text-sm text-ink-500">
        Already have an account?{' '}
        <Link to="/login" className="text-cholo-700 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
