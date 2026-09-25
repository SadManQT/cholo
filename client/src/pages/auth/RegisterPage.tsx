import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as authApi from '../../api/auth.api';
import { Button, Input, toast } from '../../components/ui';
import { getApiErrorCode, getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

type Field = 'fullName' | 'phone' | 'password';
type FieldErrors = Partial<Record<Field, string>>;

// Mirrors server/src/validators/auth.schema.js so users see the real reason before submitting.
function validateField(field: Field, value: string): string | undefined {
  if (field === 'fullName') {
    if (!value.trim()) return 'Enter your full name';
    if (value.trim().length > 120) return 'Name must be 120 characters or fewer';
  }
  if (field === 'phone') {
    if (!value) return 'Enter your phone number';
    if (!value.startsWith('01')) return 'Phone number must start with 01';
    if (value.length >= 3 && !/[3-9]/.test(value[2])) return 'Phone number format is invalid (third digit must be 3–9)';
    if (value.length < 11) return `Phone number is incomplete (${value.length} of 11 digits)`;
  }
  if (field === 'password') {
    if (value.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    if (value.length > MAX_PASSWORD_LENGTH) return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`;
  }
  return undefined;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intent = searchParams.get('intent');
  const isDriverIntent = intent === 'driver';
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState((searchParams.get('ref') ?? '').toUpperCase());
  const [referralError, setReferralError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});

  const values: Record<Field, string> = { fullName, phone, password };
  const fieldError = (field: Field) => serverErrors[field] ?? (touched[field] ? validateField(field, values[field]) : undefined);
  const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }));
  const edit = (field: Field, setter: (value: string) => void) => (event: { target: { value: string } }) => {
    setter(event.target.value);
    setServerErrors(({ [field]: _cleared, ...rest }) => rest);
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched({ fullName: true, phone: true, password: true });
    const firstInvalid = (['fullName', 'phone', 'password'] as Field[]).find((field) => validateField(field, values[field]));
    if (firstInvalid) {
      document.getElementById(`register-${firstInvalid}`)?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    setServerErrors({});

    try {
      await authApi.register({ fullName, phone, password, ...(referralCode.trim() ? { referralCode: referralCode.trim() } : {}) });
      const verifyParams = new URLSearchParams({ phone });
      if (intent) verifyParams.set('intent', intent);
      navigate(`/verify?${verifyParams.toString()}`);
    } catch (thrown) {
      const fields: FieldErrors = getApiFieldErrors(thrown);
      if (getApiErrorCode(thrown) === 'PHONE_TAKEN') fields.phone = getApiErrorMessage(thrown);
      const referralIssue = getApiErrorCode(thrown) === 'REFERRAL_CODE_INVALID'
        ? getApiErrorMessage(thrown)
        : (getApiFieldErrors(thrown) as Record<string, string>).referralCode;
      if (referralIssue) {
        setReferralError(referralIssue);
        document.getElementById('register-referral')?.focus();
        return;
      }
      if (Object.keys(fields).length > 0) {
        setServerErrors(fields);
        return;
      }
      const message = getApiErrorMessage(thrown, 'Could not create your account. Please try again.');
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Create your account</h1>
        <p className="mt-1 text-sm text-ink-500">
          {isDriverIntent ? "Next you'll apply to drive — it only takes a minute here." : 'Book your first ride in under two minutes.'}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          id="register-fullName"
          label="Full name"
          value={fullName}
          onChange={edit('fullName', setFullName)}
          onBlur={() => touch('fullName')}
          error={fieldError('fullName')}
          maxLength={120}
          autoFocus
        />
        <Input
          variant="phone"
          id="register-phone"
          label="Phone"
          value={phone}
          onChange={edit('phone', setPhone)}
          onBlur={() => touch('phone')}
          error={fieldError('phone')}
        />
        <div>
          <Input
            variant="password"
            id="register-password"
            label="Password"
            value={password}
            onChange={edit('password', setPassword)}
            onBlur={() => touch('password')}
            error={fieldError('password')}
          />
          {!fieldError('password') && (
            <p className={`mt-1.5 text-xs ${passwordLongEnough ? 'text-cholo-700' : 'text-ink-500'}`}>
              {passwordLongEnough ? '✓ ' : ''}At least {MIN_PASSWORD_LENGTH} characters
            </p>
          )}
        </div>
        <Input
          id="register-referral"
          label="Referral code (optional)"
          value={referralCode}
          onChange={(event) => { setReferralCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setReferralError(undefined); }}
          error={referralError}
          maxLength={20}
          autoComplete="off"
        />
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
