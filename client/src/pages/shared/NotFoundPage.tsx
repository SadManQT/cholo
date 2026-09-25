import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/ui';
import { t } from '../../i18n';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <EmptyState
        title={t('Page not found')}
        hint={t('That page doesn\'t exist, or the link is out of date.')}
        action={{ label: t('Go back'), onClick: () => navigate(-1) }}
      />
    </div>
  );
}
