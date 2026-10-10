import { browser } from 'wxt/browser';
import type { Snapshot } from './storage';

/**
 * A report users can paste into a GitHub issue. Everything in it is either public store data
 * or FreeKeep's own state: no session ids, cookies, account ids or account names are ever stored.
 */
export function buildDiagnostics(s: Snapshot, epicAccess: boolean) {
  return {
    version: browser.runtime.getManifest().version,
    userAgent: navigator.userAgent,
    language: browser.i18n.getUILanguage(),
    settings: s.settings,
    /** Whether FreeKeep can currently read Epic's list (the optional host permission is active). */
    epicAccess,
    session: {
      loggedIn: s.meta.loggedIn,
      country: s.meta.country,
      sessionCheckedAt: iso(s.meta.sessionCheckedAt),
      decidedAt: iso(s.meta.decidedAt),
      cachedApps: Object.keys(s.meta.appCache).length,
      lastCheck: s.meta.sessionProbe,
    },
    runs: s.runs.map((r) => ({ ...r, at: iso(r.at) })),
    promos: Object.values(s.promos).map((p) => ({
      subid: p.subid,
      appid: p.appid,
      name: p.name,
      kind: p.kind,
      status: p.status,
      attempts: p.attempts,
      lastError: p.lastError,
      endsText: p.endsText,
      firstSeen: iso(p.firstSeen),
      lastSeen: iso(p.lastSeen),
    })),
    epic: Object.values(s.epic).map((o) => ({
      title: o.title,
      kind: o.kind,
      status: o.status,
      upcoming: o.upcoming,
      start: iso(o.start),
      end: iso(o.end),
    })),
  };
}

function iso(ms: number): string | null {
  return ms ? new Date(ms).toISOString() : null;
}
