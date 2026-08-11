import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, toast } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { getApiErrorMessage } from '../../utils/apiError';
import { roleHomePath } from '../../utils/roleHomePath';

// doc 12 §4: "Login | /login | phone + password | inputs + forgot link."
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const user = await login(phone, password);
      toast.success('Welcome back!');
      navigate(roleHomePath(user.roles), { replace: true });
    } catch (thrown) {
      // doc 10 §6: the backend deliberately never says which of phone/
      // password was wrong — this can only ever be one shared message,
      // never a per-field one.
      const message = getApiErrorMessage(thrown, 'Could not log in. Please try again.');
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
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
          autoFocus
        />
        <Input
          variant="password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}

      <Button type="submit" variant="primary" loading={submitting} className="w-full">
        Log in
      </Button>

      <Link to="/reset" className="text-center text-sm text-cholo-700 hover:underline">
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
