import type { ReminderStore } from '@/core/types';

/** Messages the popup and options page send to the background. */
export type Command =
  | { type: 'checkNow' }
  /** Renew a lapsed Steam login through a store tab: in the background, or `visible` for the user. */
  | { type: 'renewLogin'; visible: boolean }
  | { type: 'claim'; subid: number }
  | { type: 'skip'; subid: number }
  /** What the user did with an Epic or GOG offer. */
  | { type: 'offer'; store: ReminderStore; id: string; status: 'opened' | 'hidden' };

export interface CommandResult {
  ok: boolean;
  error?: string;
}
