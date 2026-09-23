import { useState } from 'react';
import * as tripsApi from '../../api/trips.api';
import { getApiErrorMessage } from '../../utils/apiError';
import { StarIcon } from '../layout/icons';
import { Button, Card, toast } from '../ui';

const SCORE_WORDS = ['', 'Poor', 'Below average', 'Okay', 'Good', 'Excellent'];

interface RateTripCardProps {
  tripCode: string;
  counterpartyName: string;
  existing: { score: number; comment: string | null } | null;
}

export function RateTripCard({ tripCode, counterpartyName, existing }: RateTripCardProps) {
  const [rating, setRating] = useState(existing);
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const firstName = counterpartyName.split(' ')[0];

  async function submit() {
    setBusy(true);
    try {
      setRating(await tripsApi.rateTrip(tripCode, score, comment.trim() || undefined));
      toast.success('Thanks for your rating.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not save your rating.'));
    } finally {
      setBusy(false);
    }
  }

  if (rating) {
    return (
      <Card className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-ink-500">You rated {firstName}</p>
        <span className="flex text-marigold-500" aria-label={`${rating.score} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((value) => <StarIcon key={value} className="h-5 w-5" filled={value <= rating.score} />)}
        </span>
      </Card>
    );
  }

  const shown = hover || score;
  return (
    <Card className="mb-4 print:hidden">
      <h2 className="font-semibold">How was your trip with {firstName}?</h2>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={score === value}
              aria-label={`${value} star${value > 1 ? 's' : ''}`}
              onMouseEnter={() => setHover(value)}
              onClick={() => setScore(value)}
              className={`rounded-md p-1 transition-transform duration-100 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 ${value <= shown ? 'text-marigold-500' : 'text-ink-500/40'}`}
            >
              <StarIcon className="h-8 w-8" filled={value <= shown} />
            </button>
          ))}
        </div>
        <span className="text-sm font-medium text-ink-500">{SCORE_WORDS[shown]}</span>
      </div>
      {score > 0 && (
        <div className="mt-3 space-y-3">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder={score <= 3 ? 'What could have gone better? (optional)' : 'Anything to add? (optional)'}
            className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700"
          />
          <Button loading={busy} onClick={() => void submit()}>Submit rating</Button>
        </div>
      )}
    </Card>
  );
}
