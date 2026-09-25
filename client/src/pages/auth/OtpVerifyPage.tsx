import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import * as authApi from '../../api/auth.api';
import { Button, OtpInput, toast } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useCountdown } from '../../hooks/useCountdown';
import { getApiErrorMessage } from '../../utils/apiError';
import { roleHomePath } from '../../utils/roleHomePath';
import { t } from '../../i18n';

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

export function OtpVerifyPage() {
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const phone = searchParams.get('phone');
  const intent = searchParams.get('intent');

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resendCountdown = useCountdown();

  const { start: startResendCountdown } = resendCountdown;
  useEffect(() => {
    startResendCountdown(RESEND_COOLDOWN_SECONDS);
  }, [startResendCountdown]);

  if (!phone) {
    return <Navigate to="/register" replace />;
  }

  async function submit(otp: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const user = await verifyOtp(phone!, otp);
      toast.success(t('Welcome to Cholo!'));
      navigate(intent === 'driver' ? '/driver/apply' : roleHomePath(user.roles), { replace: true });
    } catch (thrown) {
      const message = getApiErrorMessage(thrown, t('Could not verify that code. Please try again.'));
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
      toast.success(t('A new code is on its way.'));
      resendCountdown.start(RESEND_COOLDOWN_SECONDS);
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not resend the code. Please try again.')));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{t('Verify your phone')}</h1>
        <p className="mt-1 text-sm text-ink-500">{t('Enter the 6-digit code we sent to {0}.', phone)}</p>
        {import.meta.env.DEV && (
          <p className="mt-2 rounded-lg bg-info-600/10 px-3 py-2 text-xs text-info-600">
            {t('Development mode: SMS is mocked. Copy the code from the API terminal\'s “Mock SMS sent” log.')}
          </p>
        )}
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
        {t('Verify')}
      </Button>

      <div className="text-center text-sm text-ink-500">
        {resendCountdown.isActive ? (
          <span>{t('Resend code in {0}s', resendCountdown.remaining)}</span>
        ) : (
          <button type="button" onClick={handleResend} className="text-cholo-700 hover:underline">
            {t('Resend code')}
          </button>
        )}
      </div>
    </div>
  );
}
