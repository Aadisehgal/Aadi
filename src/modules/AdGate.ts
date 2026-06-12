/**
 * AdGate Module
 * Centralised logic for the Avatar GLB change ad gate system.
 * Used by AvatarScreen — extracted here for testability and reuse.
 */
import { adService, type RewardedAdResult } from '@services/adService';
import { useAdStore } from '@stores/useAdStore';
import { storageService } from '@services/storageService';
import { analyticsService } from '@services/analyticsService';
//  from '@services/storageService';

export type AdGateResult =
  | { outcome: 'allowed'; reason: 'premium' }
  | { outcome: 'allowed'; reason: 'rewarded' }
  | { outcome: 'allowed'; reason: 'timer_expired' }
  | { outcome: 'blocked'; reason: 'dismissed' }
  | { outcome: 'pending'; reason: 'timer_started' };

/**
 * Run the full ad gate flow for avatar GLB change.
 *
 * @param onTimerComplete - Called when 30s fallback timer completes.
 * @returns AdGateResult describing the immediate outcome.
 */
export async function runAdGate(
  onTimerComplete: () => void,
): Promise<AdGateResult> {
  const adStore = useAdStore.getState();

  // STEP 1: Premium bypass
  if (adStore.isPremiumUnlocked) {
    return { outcome: 'allowed', reason: 'premium' };
  }

  // STEP 2: Show Rewarded Ad
  let result: RewardedAdResult;
  try {
    result = await adService.showRewardedAd();
  } catch {
    result = 'failed';
  }

  // STEP 3: Handle result
  if (result === 'rewarded') {
    return { outcome: 'allowed', reason: 'rewarded' };
  }

  if (result === 'dismissed') {
    // User explicitly skipped — no timer, no unlock
    return { outcome: 'blocked', reason: 'dismissed' };
  }

  // result === 'failed' — ad could not load (network/no-fill/timeout)
  const failReason = 'ad_load_failed';
  adStore.logAdFailure(failReason);

  // Log to analytics
  await storageService
    .saveAnalyticsLog({
      id: `adgate-fail-${Date.now()}`,
      type: 'warn',
      message: `Avatar ad gate: ad failed to load. Starting 30s unlock timer.`,
      timestamp: Date.now(),
    })
    .catch(() => {});
  analyticsService.logAdFailure(failReason);

  // Start 30-second countdown timer
  adStore.startUnlockTimer(() => {
    onTimerComplete();
  });

  return { outcome: 'pending', reason: 'timer_started' };
}
