import { BottomSheet, Button } from '../ui';

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  hint: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({
  open,
  title,
  hint,
  confirmLabel,
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <BottomSheet open={open} snapPoint="half" onSnapPointChange={() => {}} onClose={onClose}>
      <div className="flex min-h-full flex-col justify-center gap-4 py-4">
        <div>
          <h2 className="text-xl font-bold text-ink-900">{title}</h2>
          <p className="mt-1 text-sm text-ink-500">{hint}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={loading} onClick={onClose}>Go back</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
