import * as socialRepo from '../repositories/social.repository.js';
import * as walletRepo from '../repositories/wallet.repository.js';
import { notify } from './notifications.service.js';

// ponytail: one flat bonus for both sides; move to a settings table if marketing wants to tune it.
export const REFERRAL_BONUS = 50;

/** Called inside trip completion: the referred rider's first completed trip pays both people once. */
export async function rewardReferralOnFirstTrip(trip, client) {
  const referral = await socialRepo.findPendingReferralForUpdate(trip.passengerId, client);
  if (!referral) return;

  for (const [userId, side] of [[referral.referrerId, 'referrer'], [referral.refereeId, 'referee']]) {
    const wallet = await walletRepo.getByUserId(userId, client);
    if (!wallet) continue;
    await walletRepo.insertTransaction({
      walletId: wallet.id,
      txnType: 'referral_bonus',
      direction: 'credit',
      amount: REFERRAL_BONUS,
      referenceType: 'referral',
      referenceId: referral.id,
      idempotencyKey: `referral-${referral.id}-${side}`,
      note: side === 'referrer' ? 'A friend you invited took their first ride' : 'Welcome bonus for joining with a referral code',
    }, client);
    await notify(userId, {
      category: 'promo',
      title: `৳${REFERRAL_BONUS} referral bonus added to your wallet`,
      body: side === 'referrer' ? 'Your friend finished their first Cholo ride.' : 'Thanks for joining Cholo with a friend’s code.',
    }, client);
  }

  await socialRepo.markReferralRewarded(referral.id, { tripId: trip.id, bonus: REFERRAL_BONUS }, client);
}
