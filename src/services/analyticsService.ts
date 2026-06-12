/**
 * analyticsService — fully local, no server.
 * Tracks: token usage, tool usage, feature heatmap, performance, crashes, ad failures.
 * Storage: SQLite via storageService + MMKV for lightweight counters.
 */

import { MMKV } from 'react-native-mmkv';
import type { AnalyticsEvent, AdFailureLog } from '@apptypes/index';

const mmkv = new MMKV({ id: 'analytics' });

// ─── Keys ─────────────────────────────────────────────────────────────────────
const KEY_ENABLED = 'analytics_enabled';
const KEY_TOKEN_TOTAL = 'analytics_token_total';
const KEY_TOOL_USAGE = 'analytics_tool_usage';
const KEY_FEATURE_MAP = 'analytics_feature_map';
const KEY_AD_FAILURES = 'analytics_ad_failures';
const KEY_CRASH_LOGS = 'analytics_crash_logs';
const KEY_PERF_LOGS = 'analytics_perf_logs';
const KEY_SESSION_START = 'analytics_session_start';

// ─── In-memory log buffer (flushed to MMKV) ───────────────────────────────────
interface PerfEntry {
  label: string;
  durationMs: number;
  timestamp: number;
}

interface CrashEntry {
  message: string;
  stack?: string;
  timestamp: number;
}

class AnalyticsService {
  private enabled: boolean = true;

  constructor() {
    const stored = mmkv.getBoolean(KEY_ENABLED);
    this.enabled = stored !== false; // default true
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(val: boolean): void {
    this.enabled = val;
    mmkv.set(KEY_ENABLED, val);
  }

  // ─── Session ───────────────────────────────────────────────────────────────

  startSession(): void {
    mmkv.set(KEY_SESSION_START, Date.now());
  }

  // ─── Token Usage ──────────────────────────────────────────────────────────

  trackTokens(count: number): void {
    if (!this.enabled) return;
    const prev = mmkv.getNumber(KEY_TOKEN_TOTAL) ?? 0;
    mmkv.set(KEY_TOKEN_TOTAL, prev + count);
  }

  getTotalTokens(): number {
    return mmkv.getNumber(KEY_TOKEN_TOTAL) ?? 0;
  }

  // ─── Tool Usage ───────────────────────────────────────────────────────────

  trackToolUsage(toolId: string): void {
    if (!this.enabled) return;
    const raw = mmkv.getString(KEY_TOOL_USAGE);
    const map: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[toolId] = (map[toolId] ?? 0) + 1;
    mmkv.set(KEY_TOOL_USAGE, JSON.stringify(map));
  }

  getToolUsage(): Record<string, number> {
    const raw = mmkv.getString(KEY_TOOL_USAGE);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  }

  // ─── Feature Heatmap ──────────────────────────────────────────────────────

  trackFeature(featureId: string): void {
    if (!this.enabled) return;
    const raw = mmkv.getString(KEY_FEATURE_MAP);
    const map: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[featureId] = (map[featureId] ?? 0) + 1;
    mmkv.set(KEY_FEATURE_MAP, JSON.stringify(map));
  }

  getFeatureHeatmap(): Record<string, number> {
    const raw = mmkv.getString(KEY_FEATURE_MAP);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  }

  // ─── Performance ──────────────────────────────────────────────────────────

  trackPerformance(label: string, durationMs: number): void {
    if (!this.enabled) return;
    const raw = mmkv.getString(KEY_PERF_LOGS);
    const logs: PerfEntry[] = raw ? (JSON.parse(raw) as PerfEntry[]) : [];
    logs.push({ label, durationMs, timestamp: Date.now() });
    // Keep last 200 entries
    if (logs.length > 200) logs.splice(0, logs.length - 200);
    mmkv.set(KEY_PERF_LOGS, JSON.stringify(logs));
  }

  getPerformanceLogs(): PerfEntry[] {
    const raw = mmkv.getString(KEY_PERF_LOGS);
    return raw ? (JSON.parse(raw) as PerfEntry[]) : [];
  }

  // ─── Crash Logs ───────────────────────────────────────────────────────────

  trackCrash(message: string, stack?: string): void {
    // Always log crashes regardless of enabled flag
    const raw = mmkv.getString(KEY_CRASH_LOGS);
    const logs: CrashEntry[] = raw ? (JSON.parse(raw) as CrashEntry[]) : [];
    logs.push({ message, stack, timestamp: Date.now() });
    if (logs.length > 100) logs.splice(0, logs.length - 100);
    mmkv.set(KEY_CRASH_LOGS, JSON.stringify(logs));
  }

  getCrashLogs(): CrashEntry[] {
    const raw = mmkv.getString(KEY_CRASH_LOGS);
    return raw ? (JSON.parse(raw) as CrashEntry[]) : [];
  }

  // ─── Ad Failures ──────────────────────────────────────────────────────────

  logAdFailure(reason: string): void {
    // Always log ad failures
    const raw = mmkv.getString(KEY_AD_FAILURES);
    const logs: AdFailureLog[] = raw ? (JSON.parse(raw) as AdFailureLog[]) : [];
    logs.push({ reason, timestamp: Date.now() });
    if (logs.length > 200) logs.splice(0, logs.length - 200);
    mmkv.set(KEY_AD_FAILURES, JSON.stringify(logs));
  }

  getAdFailures(): AdFailureLog[] {
    const raw = mmkv.getString(KEY_AD_FAILURES);
    return raw ? (JSON.parse(raw) as AdFailureLog[]) : [];
  }

  // ─── Generic Event ────────────────────────────────────────────────────────

  trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): void {
    if (!this.enabled) return;
    // Route to appropriate tracker based on eventType
    switch (event.eventType) {
      case 'tool_use':
        this.trackToolUsage(String(event.payload['toolId'] ?? 'unknown'));
        break;
      case 'feature_use':
        this.trackFeature(String(event.payload['featureId'] ?? 'unknown'));
        break;
      case 'token_use':
        this.trackTokens(Number(event.payload['count'] ?? 0));
        break;
      case 'ad_failure':
        this.logAdFailure(String(event.payload['reason'] ?? 'unknown'));
        break;
      default:
        break;
    }
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  exportAll(): string {
    const data = {
      totalTokens: this.getTotalTokens(),
      toolUsage: this.getToolUsage(),
      featureHeatmap: this.getFeatureHeatmap(),
      performanceLogs: this.getPerformanceLogs(),
      crashLogs: this.getCrashLogs(),
      adFailures: this.getAdFailures(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  // ─── Clear ────────────────────────────────────────────────────────────────

  clearAll(): void {
    mmkv.delete(KEY_TOKEN_TOTAL);
    mmkv.delete(KEY_TOOL_USAGE);
    mmkv.delete(KEY_FEATURE_MAP);
    mmkv.delete(KEY_AD_FAILURES);
    mmkv.delete(KEY_CRASH_LOGS);
    mmkv.delete(KEY_PERF_LOGS);
    mmkv.delete(KEY_SESSION_START);
  }
}

export const analyticsService = new AnalyticsService();
