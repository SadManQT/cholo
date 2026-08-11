import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <EmptyState
        title="Page not found"
        hint="That page doesn't exist, or the link is out of date."
        action={{ label: 'Go back', onClick: () => navigate(-1) }}
      />
    </div>
  );
}
