import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import * as authApi from '../../api/auth.api';
import { Button, OtpInput, toast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useCountdown } from '../../hooks/useCountdown';
import { getApiErrorMessage } from '../../utils/apiError';
import { roleHomePath } from '../../utils/roleHomePath';

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

// doc 12 §4: "OTP Verify | /verify | 6-digit SMS code, resend countdown |
// OtpInput, resend timer (30s) | auto-submits on 6th digit."
export function OtpVerifyPage() {
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const phone = searchParams.get('phone');

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resendCountdown = useCountdown();

  const { start: startResendCountdown } = resendCountdown;
  useEffect(() => {
    // Once, on mount — register() already sent the first code server-side;
    // this just starts the clock on when the Resend button becomes
    // clickable again.
    startResendCountdown(RESEND_COOLDOWN_SECONDS);
  }, [startResendCountdown]);

  // No phone to verify (direct nav, refresh after losing query state) —
  // nothing this screen can do without it.
  if (!phone) {
    return <Navigate to="/register" replace />;
  }

  async function submit(otp: string) {
    if (submitting) return; // onComplete + the manual button can both fire for the same code
    setSubmitting(true);
    setError(null);

    try {
      const user = await verifyOtp(phone!, otp);
      toast.success('Welcome to Cholo!');
      navigate(roleHomePath(user.roles), { replace: true });
    } catch (thrown) {
      const message = getApiErrorMessage(thrown, 'Could not verify that code. Please try again.');
      setError(message);
      toast.error(message);
      setCode('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      await authApi.resendOtp(phone!);
      toast.success('A new code is on its way.');
      resendCountdown.start(RESEND_COOLDOWN_SECONDS);
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not resend the code. Please try again.'));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Verify your phone</h1>
        <p className="mt-1 text-sm text-ink-500">Enter the 6-digit code we sent to {phone}.</p>
      </div>

      <OtpInput
        length={OTP_LENGTH}
        value={code}
        onChange={setCode}
        onComplete={submit}
        error={Boolean(error)}
        disabled={submitting}
      />

      {error && <p className="text-sm text-danger-600">{error}</p>}

      <Button
        type="button"
        variant="primary"
        loading={submitting}
        disabled={code.length !== OTP_LENGTH}
        onClick={() => submit(code)}
        className="w-full"
      >
        Verify
      </Button>

      <div className="text-center text-sm text-ink-500">
        {resendCountdown.isActive ? (
          <span>Resend code in {resendCountdown.remaining}s</span>
        ) : (
          <button type="button" onClick={handleResend} className="text-cholo-700 hover:underline">
            Resend code
          </button>
        )}
      </div>
    </div>
  );
}
