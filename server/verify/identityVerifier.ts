// ── ThaID KYC broker — IdentityVerifier contract + drivers ────────────────────
import type { VerifyConfig } from './config';
import type { MatchFields, KycResult } from './types';
import { computeFlags, citizenIdMatches, isOverallPass, type VerifiedProfile } from './matcher';
import { genPkce, randomToken } from './crypto';

export interface StartOutcome {
  /** oidc: 302 ไป IdP */
  redirectUrl?: string;
  /** oidc: ค่าที่ต้อง persist ไว้กับ session ก่อน redirect */
  oidc?: { state: string; nonce: string; pkceVerifier: string };
  /** stub: ไม่มี IdP จริง — แสดงหน้าข้อความรอ */
  stub?: { message: string; simulateUrl?: string };
}

export interface CallbackInput {
  query: Record<string, string | undefined>;
  applicant: MatchFields;
  session: { sid: string; oidcState: string | null; oidcNonce: string | null; pkceVerifier: string | null };
}

export interface IdentityVerifier {
  readonly name: 'stub' | 'thaid-oidc';
  start(sid: string, cfg: VerifyConfig): StartOutcome;
  handleCallback(input: CallbackInput, cfg: VerifyConfig): Promise<KycResult>;
}

// ── STUB driver — ใช้ตอนนี้ (ก่อนได้ RP credentials) ──────────────────────────
// start(): แสดงข้อความว่าระบบอยู่ระหว่างเชื่อมต่อกับกรมการปกครอง
// handleCallback(): ถ้า VERIFY_STUB_AUTOPASS=true (local/staging) → จำลองผล "ผ่าน"
//                   โดย echo ข้อมูลผู้สมัครกลับมาเป็น verified profile; ไม่งั้น throw
class StubVerifier implements IdentityVerifier {
  readonly name = 'stub' as const;

  start(sid: string, cfg: VerifyConfig): StartOutcome {
    return {
      stub: {
        message:
          'ระบบยืนยันตัวตนด้วย ThaID อยู่ระหว่างการเชื่อมต่อกับกรมการปกครอง ' +
          'ใบสมัครของท่านถูกบันทึกไว้แล้ว เจ้าหน้าที่จะตรวจสอบเอกสารยืนยันตัวตนของท่านอีกครั้ง',
        simulateUrl: cfg.stubAutoPass ? `/verify/callback?sid=${encodeURIComponent(sid)}&stub=1` : undefined,
      },
    };
  }

  async handleCallback(input: CallbackInput, cfg: VerifyConfig): Promise<KycResult> {
    if (!cfg.stubAutoPass || input.query.stub !== '1') {
      throw new VerifierError('stub_no_idp', 'ยังไม่ได้เชื่อมต่อ ThaID จริง (driver=stub)');
    }
    const a = input.applicant;
    const verified: VerifiedProfile = {
      citizenId: a.citizenId,
      firstNameTh: a.firstNameTh,
      middleNameTh: a.middleNameTh,
      lastNameTh: a.lastNameTh,
      birthDate: a.birthDate,
      isThaiNational: true,
      address: a.address,
    };
    const flags = computeFlags(a, verified);
    const idOk = citizenIdMatches(a, verified);
    return {
      ok: isOverallPass(flags, idOk),
      flags,
      ial: cfg.thaid.requiredIal,
      provider: 'stub',
      failureReason: idOk ? undefined : 'citizen_id_mismatch',
    };
  }
}

// ── OIDC driver — โครงว่าง เติมเมื่อได้ Relying Party credentials จาก DOPA ──────
class ThaidOidcVerifier implements IdentityVerifier {
  readonly name = 'thaid-oidc' as const;

  start(_sid: string, cfg: VerifyConfig): StartOutcome {
    const t = cfg.thaid;
    const state = randomToken(24);
    const nonce = randomToken(24);
    const pkce = genPkce();
    const url = new URL(t.authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', t.clientId);
    url.searchParams.set('redirect_uri', t.redirectUri);
    url.searchParams.set('scope', t.scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', pkce.challenge);
    url.searchParams.set('code_challenge_method', pkce.method);
    // TODO(go-live): DOPA อาจต้องการ param เพิ่ม เช่น acr_values / ial / prompt — ใส่ตามสเปกจริง
    return { redirectUrl: url.toString(), oidc: { state, nonce, pkceVerifier: pkce.verifier } };
  }

  async handleCallback(_input: CallbackInput, _cfg: VerifyConfig): Promise<KycResult> {
    // TODO(go-live) ลำดับที่ต้องทำ:
    //  1. ตรวจ query.error → ถ้ามีแปลว่าผู้ใช้ยกเลิก/ปฏิเสธ → คืน ok:false failureReason='user_cancelled'
    //  2. ตรวจ query.state === session.oidcState (constant-time) — ไม่ตรง → throw csrf
    //  3. แลก code ที่ tokenUrl (client_secret + code_verifier=session.pkceVerifier)
    //  4. ตรวจ id_token: signature กับ JWKS (jwksUrl, cache), iss, aud===clientId, exp/iat, nonce===session.oidcNonce
    //  5. เช็ค acr/amr/ial >= requiredIal
    //  6. เรียก userinfoUrl ด้วย access_token → map claims → VerifiedProfile
    //     (pid, given_name/family_name ภาษาไทย, birthdate, address ตามทะเบียนบ้าน, nationality)
    //  7. computeFlags(applicant, verified) + citizenIdMatches + isOverallPass → KycResult
    //  8. ห้าม log: pid เต็ม, access_token, id_token, ตัว claims
    throw new VerifierError(
      'oidc_not_implemented',
      'ThaID OIDC driver ยังไม่ถูก implement — รอ Relying Party credentials จาก DOPA แล้วเติมใน identityVerifier.ts',
    );
  }
}

export class VerifierError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'VerifierError';
  }
}

export function makeVerifier(cfg: VerifyConfig): IdentityVerifier {
  return cfg.driver === 'oidc' ? new ThaidOidcVerifier() : new StubVerifier();
}
