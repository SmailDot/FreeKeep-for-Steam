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

/**
 * What to do when Steam's 24-hour web login has lapsed: renew it in the background (needs the
 * optional login.steampowered.com permission), renew it in a background tab when the user clicks,
 * or only tell the user.
 */
export const RENEW_MODES = ['auto', 'tab', 'remind'] as const;
export type RenewMode = (typeof RENEW_MODES)[number];

export interface Settings {
  intervalHours: IntervalHours;
  mode: 'auto' | 'ask';
  renew: RenewMode;
  /** Also claim DLC whose base game is owned. */
  includeDlc: boolean;
  notifications: boolean;
  /** Remind about Epic Games Store giveaways (needs the optional Epic host permission). */
  epic: boolean;
  /** Remind about GOG giveaways and 100%-off games (needs the optional GOG host permissions). */
  gog: boolean;
  /** Colours of the chest icon, a personal touch; validated as #rrggbb. */
  chestBody: string;
  chestBand: string;
}

export const DEFAULT_SETTINGS: Settings = {
  intervalHours: 6,
  mode: 'auto',
  renew: 'tab',
  includeDlc: true,
  notifications: true,
  epic: false,
  gog: false,
  chestBody: '#2a6f9e',
  chestBand: '#ffcd75',
};

export type RunReason = 'alarm' | 'startup' | 'installed' | 'manual' | 'renew';

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
  /** Epic offers found, or why the Epic check didn't run; absent when Epic is off. */
  epic?: number | 'no_permission' | 'error';
  /** The same for GOG. */
  gog?: number | 'no_permission' | 'error';
}

/** Stores FreeKeep can only remind about: claiming there needs the user's own login on that site. */
export const REMINDER_STORES = ['epic', 'gog'] as const;
export type ReminderStore = (typeof REMINDER_STORES)[number];

export type OfferKind = 'game' | 'addon' | 'bundle' | 'other';

/** A free game on Epic or GOG, current or announced. */
export interface Offer {
  /** Epic: `${namespace}:${id}`; GOG: `giveaway:<slug>` or `deal:<product id>`. */
  id: string;
  title: string;
  kind: OfferKind;
  url: string;
  image: string | null;
  start: number;
  /** null when the store doesn't say (GOG's 100%-off games). */
  end: number | null;
  upcoming: boolean;
  /** GOG only: a home page giveaway, or a game discounted to 0 (claimed by checking out). */
  deal?: 'giveaway' | 'discount';
  /** GOG only: the product slug, so a game listed both ways is shown once. */
  slug?: string;
}

export type OfferStatus = 'new' | 'notified' | 'opened' | 'hidden';

export interface OfferState extends Offer {
  status: OfferStatus;
  firstSeen: number;
  lastSeen: number;
}

export type OfferMap = Record<string, OfferState>;

// Epic's names from before GOG, kept so existing code and tests read naturally.
export type EpicKind = OfferKind;
export type EpicOffer = Offer;
export type EpicStatus = OfferStatus;
export type EpicState = OfferState;
export type EpicMap = OfferMap;
