import { browser } from 'wxt/browser';
import { DEFAULT_META, type Meta, type Store } from '@/core/engine';
import { DEFAULT_SETTINGS, INTERVAL_HOURS, type PromoMap, type RunInfo, type Settings } from '@/core/types';

const MAX_RUNS = 20;

export interface Snapshot {
  settings: Settings;
  promos: PromoMap;
  meta: Meta;
  runs: RunInfo[];
  /** Timestamp of the run in progress, or 0. */
  runningSince: number;
}

export const KEYS = ['settings', 'promos', 'meta', 'runs', 'runningSince'] as const;

export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  if (!INTERVAL_HOURS.includes(s.intervalHours)) s.intervalHours = DEFAULT_SETTINGS.intervalHours;
  if (s.mode !== 'auto' && s.mode !== 'ask') s.mode = DEFAULT_SETTINGS.mode;
  return s;
}

export async function readSnapshot(): Promise<Snapshot> {
  const raw = await browser.storage.local.get([...KEYS]);
  return {
    settings: normalizeSettings(raw.settings as Partial<Settings>),
    promos: (raw.promos as PromoMap) ?? {},
    meta: { ...DEFAULT_META, ...(raw.meta as Partial<Meta>) },
    runs: (raw.runs as RunInfo[]) ?? [],
    runningSince: (raw.runningSince as number) ?? 0,
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = (await readSnapshot()).settings;
  const next = normalizeSettings({ ...current, ...patch });
  await browser.storage.local.set({ settings: next });
  return next;
}

export const browserStore: Store = {
  async getSettings() {
    return (await readSnapshot()).settings;
  },
  async getPromos() {
    return (await readSnapshot()).promos;
  },
  async setPromos(promos) {
    await browser.storage.local.set({ promos });
  },
  async getMeta() {
    return (await readSnapshot()).meta;
  },
  async setMeta(meta) {
    await browser.storage.local.set({ meta });
  },
  async addRun(run) {
    const runs = (await readSnapshot()).runs;
    await browser.storage.local.set({ runs: [run, ...runs].slice(0, MAX_RUNS) });
  },
  async setRunning(running) {
    await browser.storage.local.set({ runningSince: running ? Date.now() : 0 });
  },
};
