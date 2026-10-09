import type { Owned } from './steam';
import type { FreeSub, Settings } from './types';

export type Decision = 'owned' | 'needs_base' | 'skipped' | 'eligible';

/** Decides what to do with a free package for the current library and settings. */
export function decide(sub: FreeSub, owned: Owned, settings: Settings): Decision {
  if (owned.packages.has(sub.subid) || owned.apps.has(sub.appid)) return 'owned';
  if (sub.kind === 'other') return 'skipped';
  if (sub.kind === 'dlc') {
    if (!settings.includeDlc) return 'skipped';
    // Steam rejects DLC without its base game (purchaseresultdetail 24), so don't even try.
    if (sub.baseAppid !== null && !owned.apps.has(sub.baseAppid)) return 'needs_base';
  }
  return 'eligible';
}
