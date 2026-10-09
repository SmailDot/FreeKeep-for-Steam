/** Messages the popup and options page send to the background. */
export type Command =
  | { type: 'checkNow' }
  | { type: 'claim'; subid: number }
  | { type: 'skip'; subid: number }
  | { type: 'epic'; id: string; status: 'opened' | 'hidden' };

export interface CommandResult {
  ok: boolean;
  error?: string;
}
