// ── ThaID KYC broker — IdentityVerifier contract + drivers ────────────────────
import type { VerifyConfig } from './config';
import type { MatchFields, KycResult, VerifyMode } from './types';
import { computeFlags, citizenIdMatches, isOverallPass, type VerifiedProfile } from './matcher';
import { genPkce, randomToken, timingSafeEqualStr } from './crypto';
import {
  OidcError,
  exchangeCode,
  fetchUserinfo,
  verifyJwtWithJwksUrl,
  validateIdTokenClaims,
  normalizeBirthdate,
  pickIal,
  ialAtLeast,
  pickTransactionRef,
  claimStr,
} from './oidc';

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
  mode: VerifyMode;
  /**
   * mode='match'  : ข้อมูลผู้สมัครครบชุด (เอาไว้เทียบ)
   * mode='prefill': seed อย่างน้อยมี citizenId (name/birthDate อาจว่าง) — ThaID เป็นคนคืนของจริง
   */
  applicant: MatchFields;
  session: { sid: string; oidcState: string | null; oidcNonce: string | null; pkceVerifier: string | null };
}

export interface CallbackResult {
  result: KycResult;
  /** identity ที่ยืนยันแล้วจาก IdP — ใช้ตอน mode='prefill' ส่งให้ api เติมฟอร์ม */
  profile: VerifiedProfile;
}

export interface IdentityVerifier {
  readonly name: 'stub' | 'thaid-oidc';
  start(sid: string, cfg: VerifyConfig): StartOutcome;
  handleCallback(input: CallbackInput, cfg: VerifyConfig): Promise<CallbackResult>;
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

  async handleCallback(input: CallbackInput, cfg: VerifyConfig): Promise<CallbackResult> {
    if (!cfg.stubAutoPass || input.query.stub !== '1') {
      throw new VerifierError('stub_no_idp', 'ยังไม่ได้เชื่อมต่อ ThaID จริง (driver=stub)');
    }
    const a = input.applicant;
    // stub จำลอง "ของจริงจาก DOPA" = echo seed/ผู้สมัคร เติมช่องว่างด้วย placeholder
    const verified: VerifiedProfile = {
      citizenId: a.citizenId,
      firstNameTh: a.firstNameTh || 'ทดสอบ',
      middleNameTh: a.middleNameTh,
      lastNameTh: a.lastNameTh || 'ระบบ',
      birthDate: a.birthDate || '1990-01-01',
      isThaiNational: true,
      address: a.address,
    };

    if (input.mode === 'prefill') {
      // ไม่มีข้อมูลผู้สมัครให้เทียบ — identity คือแหล่งที่ยืนยันแล้วในตัวเอง
      return {
        profile: verified,
        result: {
          ok: verified.isThaiNational,
          flags: { isThaiNational: true, nameMatch: true, birthDateMatch: true, addressMatch: true },
          ial: cfg.thaid.requiredIal,
          provider: 'stub',
          ndidRequestId: `stub-${input.session.sid.slice(0, 12)}`,
        },
      };
    }

    const flags = computeFlags(a, verified);
    const idOk = citizenIdMatches(a, verified);
    return {
      profile: verified,
      result: {
        ok: isOverallPass(flags, idOk),
        flags,
        ial: cfg.thaid.requiredIal,
        provider: 'stub',
        ndidRequestId: `stub-${input.session.sid.slice(0, 12)}`,
        failureReason: idOk ? undefined : 'citizen_id_mismatch',
      },
    };
  }
}

// ── OIDC driver — ThaID (DGA/DOPA) Authorization Code + PKCE ──────────────────
// โครงครบตามสเปก OIDC มาตรฐาน — **ยังไม่ได้ทดสอบกับ ThaID จริง**
// ก่อน go-live: ตั้ง THAID_* ให้ครบ, เทียบชื่อ claim (address/ial/geocode) กับสเปก DOPA,
// แล้วสลับ VERIFY_DRIVER=oidc (ดู README หัวข้อ "ก้อน D")
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
    url.searchParams.set('ui_locales', 'th');
    if (t.acrValues) url.searchParams.set('acr_values', t.acrValues);
    // TODO(go-live): DOPA อาจต้องการ param เพิ่ม (prompt / max_age / claims) — ใส่ตามสเปกจริง
    return { redirectUrl: url.toString(), oidc: { state, nonce, pkceVerifier: pkce.verifier } };
  }

  async handleCallback(input: CallbackInput, cfg: VerifyConfig): Promise<CallbackResult> {
    const t = cfg.thaid;
    const q = input.query;
    const ses = input.session;

    // 1) IdP ส่ง error กลับมา = ผู้ใช้ยกเลิก / ปฏิเสธ / consent ไม่ผ่าน
    if (q.error) {
      throw new VerifierError(
        q.error === 'access_denied' ? 'user_cancelled' : 'idp_error',
        `ThaID: ${q.error}${q.error_description ? ` — ${q.error_description}` : ''}`,
      );
    }
    if (!q.code) throw new VerifierError('missing_code', 'callback ไม่มี authorization code');

    // 2) state ต้องตรงกับที่ผูกไว้กับ session (constant-time)
    if (!ses.oidcState || !q.state || !timingSafeEqualStr(q.state, ses.oidcState)) {
      throw new VerifierError('state_mismatch', 'state ไม่ตรง — callback อาจถูกปลอมหรือ session หมดอายุ');
    }
    if (!ses.pkceVerifier) throw new VerifierError('missing_pkce', 'session ไม่มี PKCE verifier');

    try {
      // 3) แลก code เป็น token
      const tok = await exchangeCode({
        tokenUrl: t.tokenUrl,
        code: q.code,
        redirectUri: t.redirectUri,
        codeVerifier: ses.pkceVerifier,
        clientId: t.clientId,
        clientSecret: t.clientSecret,
        authMethod: t.tokenAuthMethod,
      });
      if (!tok.id_token) throw new OidcError('no_id_token', 'token endpoint ไม่คืน id_token');

      // 4) ตรวจ id_token (ลายเซ็น + claims มาตรฐาน + nonce)
      const idClaims = await verifyJwtWithJwksUrl(tok.id_token, t.jwksUrl);
      validateIdTokenClaims(idClaims, {
        issuer: t.issuer,
        audience: t.clientId,
        nonce: ses.oidcNonce || '',
        clockSkewSeconds: t.clockSkewSeconds,
      });

      // 5) IAL >= ที่ต้องการ
      const gotIal = pickIal(idClaims);
      if (!ialAtLeast(gotIal, t.requiredIal)) {
        throw new VerifierError('ial_too_low', `IAL ${gotIal ?? '(ไม่พบ)'} < ต้องการ ${t.requiredIal}`);
      }

      // 6) userinfo (ถ้ามี access_token) — merge ทับ id_token claims; sub ต้องตรง
      let claims: Record<string, unknown> = idClaims;
      if (t.userinfoUrl && tok.access_token) {
        try {
          const ui = await fetchUserinfo(t.userinfoUrl, tok.access_token, t.jwksUrl);
          if (ui.sub && idClaims.sub && ui.sub !== idClaims.sub) {
            throw new VerifierError('userinfo_sub_mismatch', 'sub ของ userinfo ไม่ตรง id_token');
          }
          claims = { ...idClaims, ...ui };
        } catch (e) {
          if (e instanceof VerifierError) throw e;
          // userinfo ล้ม — ใช้ id_token claims ต่อ ถ้ามี pid/name/birthdate ครบก็พอ
          console.warn('[verify] userinfo ล้มเหลว ใช้ id_token claims แทน:', (e as Error).message);
        }
      }

      const gotIalFinal = gotIal ?? pickIal(claims);
      const verified = mapThaidClaims(claims);
      if (verified.citizenId.length !== 13) {
        throw new VerifierError('no_pid', 'ThaID ไม่คืนเลขบัตรประชาชน (pid) — ตรวจ scope/claims');
      }
      const ndidRequestId = pickTransactionRef(claims);

      // 7) prefill: identity เป็น authoritative ในตัวเอง — ไม่มีอะไรให้เทียบ
      if (input.mode === 'prefill') {
        return {
          profile: verified,
          result: {
            ok: verified.isThaiNational,
            flags: { isThaiNational: verified.isThaiNational, nameMatch: true, birthDateMatch: true, addressMatch: true },
            ial: gotIalFinal ?? t.requiredIal,
            provider: 'thaid-oidc',
            ndidRequestId,
            failureReason: verified.isThaiNational ? undefined : 'not_thai_national',
          },
        };
      }

      // match: เทียบ claim กับข้อมูลที่ผู้สมัครกรอก
      const flags = computeFlags(input.applicant, verified);
      const idOk = citizenIdMatches(input.applicant, verified);
      return {
        profile: verified,
        result: {
          ok: isOverallPass(flags, idOk),
          flags,
          ial: gotIalFinal ?? t.requiredIal,
          provider: 'thaid-oidc',
          ndidRequestId,
          failureReason: !idOk
            ? 'citizen_id_mismatch'
            : !flags.isThaiNational
              ? 'not_thai_national'
              : !flags.nameMatch
                ? 'name_mismatch'
                : !flags.birthDateMatch
                  ? 'birthdate_mismatch'
                  : undefined,
        },
      };
    } catch (e) {
      if (e instanceof VerifierError) throw e;
      if (e instanceof OidcError) throw new VerifierError(e.code, e.message);
      throw new VerifierError('oidc_internal', (e as Error).message);
    }
  }
}

// ── map ThaID claims → VerifiedProfile ───────────────────────────────────────
// ชื่อ claim อ้างจากสเปก OIDC มาตรฐาน + ที่ ThaID เคยใช้ — **เทียบสเปก DOPA จริงตอน go-live**
function mapThaidClaims(c: Record<string, unknown>): VerifiedProfile {
  const first = (...keys: string[]): string => {
    for (const k of keys) {
      const v = claimStr((c as Record<string, unknown>)[k]);
      if (v) return v;
    }
    return '';
  };

  const citizenId = first('pid', 'citizen_id', 'citizenId', 'national_id', 'nationalId').replace(/\D/g, '');
  const firstNameTh = first('given_name', 'given_name_th', 'first_name', 'firstname_th', 'firstNameTh');
  const middleNameTh = first('middle_name', 'middle_name_th', 'middleNameTh') || undefined;
  const lastNameTh = first('family_name', 'family_name_th', 'last_name', 'lastname_th', 'lastNameTh');
  const birthDate = normalizeBirthdate(c.birthdate ?? c.birth_date ?? c.date_of_birth ?? c.dob);

  const nationality = first('nationality', 'nationality_code', 'citizenship').toUpperCase();
  const isThaiNational =
    nationality === 'TH' || nationality === 'THA' || nationality.includes('THAI') ||
    claimStr(c.nationality).includes('ไทย') ||
    (nationality === '' && citizenId.length === 13); // ThaID ออกเลข 13 หลักให้เฉพาะผู้มีสถานะทางทะเบียนไทย

  // address: OIDC address claim = object; ThaID อาจแตกเป็น sub-claim ตามทะเบียนบ้าน
  const addr = (c.address && typeof c.address === 'object' ? (c.address as Record<string, unknown>) : {}) as Record<string, unknown>;
  const a = (...keys: string[]): string => {
    for (const k of keys) {
      const v = claimStr(addr[k]) || claimStr((c as Record<string, unknown>)[k]);
      if (v) return v;
    }
    return '';
  };
  const address = {
    houseNo: a('house_no', 'houseNo', 'street_address', 'address_no'),
    moo: a('village_no', 'moo', 'village'),
    soi: a('soi', 'lane'),
    road: a('road', 'street'),
    subDistrict: a('sub_district', 'subdistrict', 'tambon', 'locality'),
    district: a('district', 'amphoe', 'amphur'),
    province: a('province', 'changwat', 'region'),
    postalCode: a('postal_code', 'zipcode', 'zip'),
  };
  const hasAddr = Object.values(address).some(Boolean);

  // geocode (TIS-1099) — ถ้า IdP ส่งรหัสมา api ข้ามขั้น resolve ชื่อ→id ได้
  const gc = {
    provinceCode: first('province_code', 'changwat_code'),
    districtCode: first('district_code', 'amphoe_code'),
    subDistrictCode: first('sub_district_code', 'tambon_code'),
  };
  const hasGeocode = Boolean(gc.provinceCode || gc.districtCode || gc.subDistrictCode);

  return {
    citizenId,
    firstNameTh,
    middleNameTh,
    lastNameTh,
    birthDate,
    isThaiNational,
    address: hasAddr ? address : undefined,
    geocode: hasGeocode ? gc : undefined,
  };
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
