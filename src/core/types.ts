export type PromoKind = 'game' | 'dlc' | 'other';

/** A free-to-keep package found on the Steam store. */
export interface FreeSub {
  subid: number;
  appid: number;
  name: string;
  kind: PromoKind;
  baseAppid: number | null;
  baseName: string | null;
  capsule: string | null;
}

export type PromoStatus =
  | 'pending' // eligible; waiting for the user (ask mode) or for login
  | 'claimed' // added to the account by FreeKeep
  | 'owned' // already in the library
  | 'needs_base' // DLC whose base game is not owned
  | 'skipped' // excluded by settings or by the user
  | 'failed'; // gave up after MAX_ATTEMPTS

export interface PromoState extends FreeSub {
  status: PromoStatus;
  /** Raw "Free to keep when you get it before …" text from the store page. */
  endsText: string | null;
  attempts: number;
  lastError: string | null;
  /** Set when the user explicitly skipped it, so policy changes don't revive it. */
  userSkipped: boolean;
  firstSeen: number;
  lastSeen: number;
  updatedAt: number;
}

export type PromoMap = Record<string, PromoState>;

export const INTERVAL_HOURS = [1, 3, 6, 12, 24] as const;
export type IntervalHours = (typeof INTERVAL_HOURS)[number];

export interface Settings {
  intervalHours: IntervalHours;
  mode: 'auto' | 'ask';
  /** Also claim DLC whose base game is owned. */
  includeDlc: boolean;
  notifications: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  intervalHours: 6,
  mode: 'auto',
  includeDlc: true,
  notifications: true,
};

export type RunReason = 'alarm' | 'startup' | 'installed' | 'manual';

export interface RunInfo {
  at: number;
  reason: RunReason;
  ok: boolean;
  /** null when the run did not need to check the session. */
  loggedIn: boolean | null;
  country: string | null;
  found: number;
  claimed: number;
  error: string | null;
}
