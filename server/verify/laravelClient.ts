// ── ThaID KYC broker — push ผล KYC กลับระบบสมัคร (Laravel) ────────────────────
import type { VerifyConfig } from './config';
import type { KycResult } from './types';
import { pepperedPidHash } from './crypto';
import { signOutgoingS2S } from './s2s';

export interface IngestPayload {
  sid: string;
  applicationRef: string;
  citizenIdHash: string;      // HMAC(pid, VERIFY_PID_PEPPER) — ไม่ส่ง pid เต็ม
  isThaiNational: boolean;
  nameMatch: boolean;
  birthDateMatch: boolean;
  addressMatch: boolean;
  overallPass: boolean;
  ial: string | null;
  provider: string;
  failureReason: string | null;
  verifiedAt: string;         // ISO
}

export function buildIngestPayload(
  sid: string,
  applicationRef: string,
  citizenId: string,
  result: KycResult,
  cfg: VerifyConfig,
): IngestPayload {
  return {
    sid,
    applicationRef,
    citizenIdHash: cfg.pidPepper ? pepperedPidHash(citizenId.replace(/\D/g, ''), cfg.pidPepper) : '',
    isThaiNational: result.flags.isThaiNational,
    nameMatch: result.flags.nameMatch,
    birthDateMatch: result.flags.birthDateMatch,
    addressMatch: result.flags.addressMatch,
    overallPass: result.ok,
    ial: result.ial ?? null,
    provider: result.provider,
    failureReason: result.failureReason ?? null,
    verifiedAt: new Date().toISOString(),
  };
}

export interface PushOutcome {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * ส่งผลไป endpoint ingest ฝั่ง Laravel (S2S + HMAC) — idempotent ที่ฝั่งรับด้วย `sid`
 * ยังไม่ตั้ง VERIFY_LARAVEL_INGEST_URL → ทำงานแบบ dry-run (log อย่างเดียว) ให้ scaffold รันได้
 */
export async function pushResultToLaravel(
  payload: IngestPayload,
  cfg: VerifyConfig,
): Promise<PushOutcome> {
  const body = JSON.stringify(payload);

  if (!cfg.laravelIngestUrl || !cfg.s2sSecret) {
    console.log(
      `[verify] dry-run push (ยังไม่ตั้ง VERIFY_LARAVEL_INGEST_URL) ref=${payload.applicationRef} pass=${payload.overallPass}`,
    );
    return { ok: true, status: 0 };
  }

  const headers = signOutgoingS2S(body, cfg.s2sSecret);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8000);
      const res = await fetch(cfg.laravelIngestUrl, {
        method: 'POST',
        headers,
        body,
        signal: ac.signal,
      });
      clearTimeout(timer);
      if (res.ok) return { ok: true, status: res.status };
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, error: `client_error_${res.status}` };
      }
    } catch (e) {
      if (attempt === 3) return { ok: false, error: (e as Error).message };
    }
    await new Promise(r => setTimeout(r, 500 * attempt));
  }
  return { ok: false, error: 'exhausted_retries' };
}
