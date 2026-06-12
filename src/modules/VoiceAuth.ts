import EncryptedStorage from 'react-native-encrypted-storage';
import { useAuthStore } from '@stores/useAuthStore';
import type { VoiceProfile } from '@apptypes/index';

// ─── MFCC Constants ───────────────────────────────────────────────────────────
const NUM_FILTERS = 26;
const NUM_COEFFICIENTS = 13;
const SAMPLE_RATE = 16000;
const FRAME_SIZE = 512;
const FFT_SIZE = 512;

// ─── Math Utilities ──────────────────────────────────────────────────────────

function hann(n: number, N: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
}

function fft(real: number[], imag: number[]): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = real[i + j];
        const uIm = imag[i + j];
        const vRe = real[i + j + len / 2] * curRe - imag[i + j + len / 2] * curIm;
        const vIm = real[i + j + len / 2] * curIm + imag[i + j + len / 2] * curRe;
        real[i + j] = uRe + vRe;
        imag[i + j] = uIm + vIm;
        real[i + j + len / 2] = uRe - vRe;
        imag[i + j + len / 2] = uIm - vIm;
        const newRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newRe;
      }
    }
  }
}

function melFilterBank(fftSize: number, sampleRate: number, numFilters: number): number[][] {
  const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
  const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);

  const melLow = hzToMel(0);
  const melHigh = hzToMel(sampleRate / 2);
  const melPoints = Array.from({ length: numFilters + 2 }, (_, i) =>
    melLow + (i * (melHigh - melLow)) / (numFilters + 1)
  );
  const hzPoints = melPoints.map(melToHz);
  const binPoints = hzPoints.map((hz) => Math.floor(((fftSize + 1) * hz) / sampleRate));

  return Array.from({ length: numFilters }, (_, m) => {
    const filter = new Array(fftSize / 2 + 1).fill(0) as number[];
    for (let k = binPoints[m]; k < binPoints[m + 1]; k++) {
      filter[k] = (k - binPoints[m]) / (binPoints[m + 1] - binPoints[m]);
    }
    for (let k = binPoints[m + 1]; k < binPoints[m + 2]; k++) {
      filter[k] = (binPoints[m + 2] - k) / (binPoints[m + 2] - binPoints[m + 1]);
    }
    return filter;
  });
}

// Precompute DCT matrix for MFCC
function dctMatrix(numFilters: number, numCoeffs: number): number[][] {
  return Array.from({ length: numCoeffs }, (_, i) =>
    Array.from({ length: numFilters }, (_, j) =>
      Math.cos((Math.PI * i * (2 * j + 1)) / (2 * numFilters))
    )
  );
}

const MEL_FILTERS = melFilterBank(FFT_SIZE, SAMPLE_RATE, NUM_FILTERS);
const DCT_MATRIX = dctMatrix(NUM_FILTERS, NUM_COEFFICIENTS);

// ─── Core MFCC Extraction ─────────────────────────────────────────────────────

/**
 * Extract MFCC feature vector from a raw PCM audio frame.
 * `frame` is an array of floats in [-1, 1].
 */
function extractMFCCFrame(frame: number[]): number[] {
  const N = FFT_SIZE;
  const windowed = new Array(N).fill(0) as number[];
  for (let i = 0; i < Math.min(frame.length, N); i++) {
    windowed[i] = frame[i] * hann(i, N);
  }

  const real = [...windowed];
  const imag = new Array(N).fill(0) as number[];
  fft(real, imag);

  // Power spectrum (one-sided)
  const halfN = N / 2 + 1;
  const power = new Array(halfN).fill(0) as number[];
  for (let i = 0; i < halfN; i++) {
    power[i] = (real[i] * real[i] + imag[i] * imag[i]) / N;
  }

  // Apply mel filterbank → log energy
  const logEnergies = MEL_FILTERS.map((filter) => {
    const energy = filter.reduce((sum, w, k) => sum + w * (power[k] ?? 0), 0);
    return Math.log(Math.max(energy, 1e-10));
  });

  // DCT → MFCC
  return DCT_MATRIX.map((row) =>
    row.reduce((sum, val, j) => sum + val * (logEnergies[j] ?? 0), 0)
  );
}

/**
 * Extract MFCC features from a full audio signal.
 * Returns an array of per-frame MFCC vectors.
 */
function extractMFCC(audioSignal: number[]): number[][] {
  const hop = FRAME_SIZE / 2;
  const frames: number[][] = [];
  for (let start = 0; start + FRAME_SIZE <= audioSignal.length; start += hop) {
    const frame = audioSignal.slice(start, start + FRAME_SIZE);
    frames.push(extractMFCCFrame(frame));
  }
  if (frames.length === 0) {
    // Fallback: single frame from whatever we have
    frames.push(extractMFCCFrame(audioSignal));
  }
  return frames;
}

/**
 * Compute the mean MFCC vector across all frames.
 */
function meanMFCC(frames: number[][]): number[] {
  if (frames.length === 0) return new Array(NUM_COEFFICIENTS).fill(0) as number[];
  const result = new Array(NUM_COEFFICIENTS).fill(0) as number[];
  for (const frame of frames) {
    for (let i = 0; i < NUM_COEFFICIENTS; i++) {
      result[i] += frame[i] ?? 0;
    }
  }
  return result.map((v) => v / frames.length);
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) * (a[i] ?? 0);
    normB += (b[i] ?? 0) * (b[i] ?? 0);
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom < 1e-10 ? 0 : dot / denom;
}

// ─── VoiceAuthModule ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'voice_profiles_v2';
const THRESHOLD = 0.85;
const MAX_FAILURES = 3;
const COOLDOWN_MS = 30_000;

class VoiceAuthModule {
  private profiles: VoiceProfile[] = [];
  private loaded = false;

  // ── Persistence ────────────────────────────────────────────────────────────

  async loadProfiles(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await EncryptedStorage.getItem(STORAGE_KEY);
      this.profiles = raw ? (JSON.parse(raw) as VoiceProfile[]) : [];
    } catch {
      this.profiles = [];
    }
    this.loaded = true;
  }

  async saveProfiles(): Promise<void> {
    await EncryptedStorage.setItem(STORAGE_KEY, JSON.stringify(this.profiles));
  }

  // ── Enrollment ─────────────────────────────────────────────────────────────

  /**
   * Enroll a new voice profile from 3 audio sample signals.
   * Each sample is a Float32 PCM signal (values in [-1, 1]).
   * Returns the created VoiceProfile.
   */
  async enrollVoice(name: string, audioSamples: number[][]): Promise<VoiceProfile> {
    await this.loadProfiles();

    if (audioSamples.length < 3) {
      throw new Error('Enrollment requires at least 3 audio samples');
    }

    // Extract MFCC mean vector from each sample
    const sampleVectors = audioSamples.map((signal) => meanMFCC(extractMFCC(signal)));

    // Average the 3 enrollment vectors → robust profile
    const averaged = meanMFCC(sampleVectors);

    const profile: VoiceProfile = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      mfccFeatures: [averaged],   // store as array for forward-compat
      createdAt: Date.now(),
    };

    // Remove existing profile with same name
    this.profiles = this.profiles.filter((p) => p.name !== name);
    this.profiles.push(profile);

    await this.saveProfiles();
    useAuthStore.getState().addVoiceProfile(profile);
    return profile;
  }

  /**
   * Re-train an existing profile by id (replaces features).
   */
  async retrainProfile(id: string, audioSamples: number[][]): Promise<VoiceProfile> {
    await this.loadProfiles();
    const existing = this.profiles.find((p) => p.id === id);
    if (!existing) throw new Error(`Profile ${id} not found`);

    const sampleVectors = audioSamples.map((signal) => meanMFCC(extractMFCC(signal)));
    const averaged = meanMFCC(sampleVectors);
    existing.mfccFeatures = [averaged];

    await this.saveProfiles();
    // Sync to auth store
    useAuthStore.getState().removeVoiceProfile(id);
    useAuthStore.getState().addVoiceProfile(existing);
    return existing;
  }

  // ── Verification ───────────────────────────────────────────────────────────

  /**
   * Verify a voice sample against all enrolled profiles.
   * `audioSignal` is a Float32 PCM signal.
   */
  async verifyVoice(
    audioSignal: number[]
  ): Promise<{ matched: boolean; profile?: VoiceProfile; similarity: number }> {
    await this.loadProfiles();

    if (this.profiles.length === 0) {
      return { matched: false, similarity: 0 };
    }

    // Check cooldown
    const authStore = useAuthStore.getState();
    if (authStore.checkCooldown()) {
      return { matched: false, similarity: 0 };
    }

    const testVector = meanMFCC(extractMFCC(audioSignal));

    let bestMatch: VoiceProfile | undefined;
    let bestSimilarity = 0;

    for (const profile of this.profiles) {
      const profileVector = profile.mfccFeatures[0] ?? [];
      const similarity = cosineSimilarity(testVector, profileVector);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = profile;
      }
    }

    const matched = bestSimilarity >= THRESHOLD;

    if (matched) {
      authStore.resetFailedAttempts();
    } else {
      authStore.incrementFailedAttempts();
      if (authStore.failedAttempts >= MAX_FAILURES) {
        authStore.setCooldownActive(true);
        // Auto-clear cooldown after 30s
        setTimeout(() => {
          authStore.setCooldownActive(false);
          authStore.resetFailedAttempts();
        }, COOLDOWN_MS);
      }
    }

    return { matched, profile: bestMatch, similarity: bestSimilarity };
  }

  // ── Profile Management ─────────────────────────────────────────────────────

  async deleteProfile(id: string): Promise<void> {
    await this.loadProfiles();
    this.profiles = this.profiles.filter((p) => p.id !== id);
    await this.saveProfiles();
    useAuthStore.getState().removeVoiceProfile(id);
  }

  async getProfiles(): Promise<VoiceProfile[]> {
    await this.loadProfiles();
    return [...this.profiles];
  }

  getProfilesSync(): VoiceProfile[] {
    return [...this.profiles];
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  /** Convert amplitude waveform (Uint8 0–255) to float PCM [-1, 1]. */
  static uint8ToFloat(buffer: Uint8Array): number[] {
    return Array.from(buffer).map((v) => (v - 128) / 128);
  }

  /** Convert Int16 PCM to float [-1, 1]. */
  static int16ToFloat(buffer: Int16Array): number[] {
    return Array.from(buffer).map((v) => v / 32768);
  }

  /** Simulate a synthetic audio signal for testing (sine wave). */
  static syntheticSignal(freqHz = 440, durationMs = 500): number[] {
    const samples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
    return Array.from({ length: samples }, (_, i) =>
      0.5 * Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE)
    );
  }
}

export const voiceAuthModule = new VoiceAuthModule();
