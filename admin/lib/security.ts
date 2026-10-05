/** Shared security helpers: audit logging + anomaly detection (pure, unit-testable). */
import type { EventRow } from './store';

export interface Anomaly {
  kind: 'concurrent_session' | 'ip_change' | 'device_change' | 'pin_failures' | 'forced_reauth';
  userId: string | null;
  email?: string | null;
  detail: string;
  created_at: string;
}

const SECURITY_EVENTS = new Set([
  'security_pin_failed',
  'security_login_failed',
  'security_session_revoked',
  'security_ip_changed',
  'security_device_changed',
  'security_admin_action',
  'signin',
  'signout'
]);

export function isSecurityEvent(name: string): boolean {
  return SECURITY_EVENTS.has(name);
}

function dayKey(iso: string): string {
  return String(iso || '').slice(0, 10);
}

/**
 * Detect simple anomalies from raw events + session snapshots.
 * - pin_failures: >=3 security_pin_failed for same user in one day
 * - ip_change / device_change: explicit security_ip_changed / security_device_changed events
 * - forced_reauth: security_session_revoked events
 */
export function detectAnomalies(events: EventRow[], emailById: Map<string, string>): Anomaly[] {
  const out: Anomaly[] = [];
  const pinFails = new Map<string, { count: number; last: string }>();
  const loginFails = new Map<string, { count: number; last: string }>();
  for (const e of events) {
    const email = e.user_id ? emailById.get(e.user_id) || null : null;
    if (e.event_name === 'security_login_failed') {
      const ip = String((e.properties as Record<string, unknown>)?.ip || 'unknown');
      const k = `${ip}:${dayKey(e.created_at)}`;
      const cur = loginFails.get(k) || { count: 0, last: e.created_at };
      cur.count += 1;
      cur.last = e.created_at;
      loginFails.set(k, cur);
    } else if (e.event_name === 'security_pin_failed' && e.user_id) {
      const k = `${e.user_id}:${dayKey(e.created_at)}`;
      const cur = pinFails.get(k) || { count: 0, last: e.created_at };
      cur.count += 1;
      cur.last = e.created_at;
      pinFails.set(k, cur);
    } else if (e.event_name === 'security_ip_changed') {
      const p = e.properties as Record<string, unknown>;
      out.push({
        kind: 'ip_change',
        userId: e.user_id,
        email,
        detail: `IP ${String(p.old_ip || '?')} → ${String(p.new_ip || '?')}`,
        created_at: e.created_at
      });
    } else if (e.event_name === 'security_device_changed') {
      const p = e.properties as Record<string, unknown>;
      out.push({
        kind: 'device_change',
        userId: e.user_id,
        email,
        detail: `${String(p.old_device || '?')} → ${String(p.new_device || '?')}`,
        created_at: e.created_at
      });
    } else if (e.event_name === 'security_session_revoked') {
      const p = e.properties as Record<string, unknown>;
      out.push({
        kind: 'forced_reauth',
        userId: e.user_id,
        email,
        detail: `Session revoked (${String(p.reason || 'unknown')})`,
        created_at: e.created_at
      });
    }
  }
  for (const [k, v] of pinFails) {
    if (v.count >= 3) {
      const userId = k.split(':')[0];
      out.push({
        kind: 'pin_failures',
        userId,
        email: emailById.get(userId) || null,
        detail: `${v.count} failed PIN attempts in one day`,
        created_at: v.last
      });
    }
  }
  for (const [k, v] of loginFails) {
    if (v.count >= 3) {
      const ip = k.split(':')[0];
      out.push({
        kind: 'pin_failures',
        userId: null,
        email: null,
        detail: `${v.count} failed login attempts from IP ${ip} in one day`,
        created_at: v.last
      });
    }
  }
  return out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 200);
}

export function sanitizeAuditDetails(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,31}$/.test(k)) continue;
    if (typeof val === 'string') out[k] = val.slice(0, 200);
    else if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
    else if (typeof val === 'boolean') out[k] = val;
  }
  return out;
}
