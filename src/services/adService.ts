import MobileAds, {
  BannerAd,
  BannerAdSize,
  TestIds,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { storageService } from '@services/storageService';

const BANNER_ID = 'ca-app-pub-3684441716460567/7116352504';
const REWARDED_ID = 'ca-app-pub-3684441716460567/7885822933';
const AD_LOAD_TIMEOUT_MS = 10000;

export type RewardedAdResult = 'rewarded' | 'dismissed' | 'failed';

class AdService {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await MobileAds().initialize();
      this.initialized = true;
    } catch (e) {
      await storageService
        .saveAnalyticsLog({
          id: `ad-init-fail-${Date.now()}`,
          type: 'warn',
          message: `Ad init failed: ${e instanceof Error ? e.message : String(e)}`,
          timestamp: Date.now(),
        })
        .catch(() => {});
    }
  }

  showRewardedAd(): Promise<RewardedAdResult> {
    return new Promise((resolve) => {
      let settled = false;
      let rewarded = false;

      const settle = (result: RewardedAdResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      let ad: ReturnType<typeof RewardedAd.createForAdRequest> | null = null;

      const timeoutId = setTimeout(() => {
        storageService
          .saveAnalyticsLog({
            id: `ad-timeout-${Date.now()}`,
            type: 'warn',
            message: 'Rewarded ad load timeout after 10s',
            timestamp: Date.now(),
          })
          .catch(() => {});
        settle('failed');
      }, AD_LOAD_TIMEOUT_MS);

      try {
        ad = RewardedAd.createForAdRequest(REWARDED_ID, {
          requestNonPersonalizedAdsOnly: true,
        });

        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          rewarded = true;
        });

        ad.addAdEventListener(AdEventType.LOADED, () => {
          clearTimeout(timeoutId);
          try {
            ad?.show().catch((err: Error) => {
              storageService
                .saveAnalyticsLog({
                  id: `ad-show-fail-${Date.now()}`,
                  type: 'warn',
                  message: `Rewarded ad show failed: ${err.message}`,
                  timestamp: Date.now(),
                })
                .catch(() => {});
              settle('failed');
            });
          } catch {
            settle('failed');
          }
        });

        ad.addAdEventListener(AdEventType.CLOSED, () => {
          clearTimeout(timeoutId);
          settle(rewarded ? 'rewarded' : 'dismissed');
        });

        ad.addAdEventListener(AdEventType.ERROR, (error) => {
          clearTimeout(timeoutId);
          storageService
            .saveAnalyticsLog({
              id: `ad-error-${Date.now()}`,
              type: 'warn',
              message: `Rewarded ad error: ${error.message}`,
              timestamp: Date.now(),
            })
            .catch(() => {});
          settle('failed');
        });

        ad.load();
      } catch (e) {
        clearTimeout(timeoutId);
        storageService
          .saveAnalyticsLog({
            id: `ad-create-fail-${Date.now()}`,
            type: 'error',
            message: `Rewarded ad create failed: ${e instanceof Error ? e.message : String(e)}`,
            timestamp: Date.now(),
          })
          .catch(() => {});
        settle('failed');
      }
    });
  }

  getBannerAdUnitId(): string {
    return BANNER_ID;
  }

  getBannerAdSize(): typeof BannerAdSize.BANNER {
    return BannerAdSize.BANNER;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const adService = new AdService();
export { BannerAd, BannerAdSize };
