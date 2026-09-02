// ── ThaID KYC broker — verify_sessions store (SQLite ผ่าน node:sqlite core) ────
// เก็บ "เฉพาะ session ระหว่างยืนยัน" อายุสั้น — ไม่มีตารางเก็บผลถาวร, ไม่เก็บ claims
// ดิบจาก DOPA เมื่อ handoff เสร็จ match_fields_enc จะถูกล้างเป็น NULL ทันที
//
// node:sqlite เป็น core module (Node >= 22.13) — ไม่ต้องพึ่ง native dependency
// Dockerfile ต้องเป็น node:22-alpine ขึ้นไป (ดู README)
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import type { VerifyStatus, VerifySessionRow, VerifyMode } from './types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS verify_sessions (
  sid              TEXT PRIMARY KEY,
  application_ref  TEXT NOT NULL,
  mode             TEXT NOT NULL DEFAULT 'match',
  status           TEXT NOT NULL,
  match_fields_enc TEXT,
  oidc_state       TEXT,
  oidc_nonce       TEXT,
  pkce_verifier    TEXT,
  result_json      TEXT,
  attempts         INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,
  consumed_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_verify_sessions_state   ON verify_sessions(oidc_state);
CREATE INDEX IF NOT EXISTS idx_verify_sessions_expires ON verify_sessions(expires_at);
`;

export interface CreateSessionInput {
  sid: string;
  applicationRef: string;
  mode: VerifyMode;
  matchFieldsEnc: string;
  expiresAt: number;
}

export class VerifyStore {
  private db: DatabaseSync;

  constructor(dataDir: string) {
    this.db = new DatabaseSync(path.join(dataDir, 'verify.sqlite'));
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 4000;');
    this.db.exec(SCHEMA);
  }

  create(input: CreateSessionInput): void {
    this.db
      .prepare(
        `INSERT INTO verify_sessions (sid, application_ref, mode, status, match_fields_enc, created_at, expires_at)
         VALUES (?, ?, ?, 'created', ?, ?, ?)`,
      )
      .run(input.sid, input.applicationRef, input.mode, input.matchFieldsEnc, Date.now(), input.expiresAt);
  }

  get(sid: string): VerifySessionRow | undefined {
    const row = this.db.prepare('SELECT * FROM verify_sessions WHERE sid = ?').get(sid);
    return row as unknown as VerifySessionRow | undefined;
  }

  getByState(state: string): VerifySessionRow | undefined {
    const row = this.db.prepare('SELECT * FROM verify_sessions WHERE oidc_state = ?').get(state);
    return row as unknown as VerifySessionRow | undefined;
  }

  /** ผู้สมัครเริ่มขั้นตอน — บันทึก state/nonce/pkce (oidc) แล้วเลื่อนเป็น pending */
  markPending(sid: string, oidc?: { state: string; nonce: string; pkceVerifier: string }): void {
    this.db
      .prepare(
        `UPDATE verify_sessions
         SET status = 'pending', attempts = attempts + 1,
             oidc_state = ?, oidc_nonce = ?, pkce_verifier = ?
         WHERE sid = ? AND status IN ('created', 'pending')`,
      )
      .run(oidc?.state ?? null, oidc?.nonce ?? null, oidc?.pkceVerifier ?? null, sid);
  }

  /**
   * guard กันใช้ callback ซ้ำ/ยิงซ้อน: เลื่อน pending → verifying แบบ atomic
   * คืน true เฉพาะ transition นี้ที่เป็นคนทำสำเร็จ (changes === 1)
   */
  claimForCallback(sid: string): boolean {
    const r = this.db
      .prepare(
        `UPDATE verify_sessions SET status = 'verifying'
         WHERE sid = ? AND status = 'pending' AND expires_at > ?`,
      )
      .run(sid, Date.now());
    return r.changes === 1;
  }

  /** เขียนผลชั่วคราว (flag ล้วน ไม่มี PII) ระหว่างรอ push ไป Laravel */
  setResult(sid: string, status: Extract<VerifyStatus, 'verified' | 'failed'>, resultJson: string): void {
    this.db
      .prepare(`UPDATE verify_sessions SET status = ?, result_json = ? WHERE sid = ?`)
      .run(status, resultJson, sid);
  }

  /** handoff เสร็จ — ล้าง match fields + pkce ทิ้ง, ปิด session */
  finalizeConsumed(sid: string): void {
    this.db
      .prepare(
        `UPDATE verify_sessions
         SET status = 'consumed', match_fields_enc = NULL, pkce_verifier = NULL,
             result_json = NULL, consumed_at = ?
         WHERE sid = ?`,
      )
      .run(Date.now(), sid);
  }

  /** ลบ session หมดอายุ + session ที่ consumed นานแล้ว (เรียกจาก sweep ราย ๆ นาที) */
  sweep(retainConsumedMs = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const a = this.db
      .prepare(
        `UPDATE verify_sessions SET status = 'expired', match_fields_enc = NULL, pkce_verifier = NULL
         WHERE expires_at <= ? AND status IN ('created', 'pending', 'verifying')`,
      )
      .run(now);
    const b = this.db
      .prepare(
        `DELETE FROM verify_sessions
         WHERE (status = 'consumed' AND consumed_at <= ?)
            OR (status = 'expired' AND expires_at <= ?)`,
      )
      .run(now - retainConsumedMs, now - retainConsumedMs);
    return Number(a.changes) + Number(b.changes);
  }

  close(): void {
    this.db.close();
  }
}
