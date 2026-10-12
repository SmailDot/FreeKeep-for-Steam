/** Messages the popup and options page send to the background. */
export type Command =
  | { type: 'checkNow' }
  /** Renew a lapsed Steam login through a store tab: in the background, or `visible` for the user. */
  | { type: 'renewLogin'; visible: boolean }
  | { type: 'claim'; subid: number }
  | { type: 'skip'; subid: number }
  | { type: 'epic'; id: string; status: 'opened' | 'hidden' };

export interface CommandResult {
  ok: boolean;
  error?: string;
}
