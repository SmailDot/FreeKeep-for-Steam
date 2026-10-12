// Visual feedback for claim results, in the same pixel style as the rest of the popup.
import { pixelIcon, pixelSafe } from '@/lib/pixel';

const COLORS = ['#66c0f4', '#a4d007', '#ffcd75', '#ffffff'];
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function replay(el: HTMLElement, className: string, ms: number): void {
  el.classList.remove(className);
  void el.offsetWidth; // restart the animation if it is already applied
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}

/** A short burst of square pixels from the centre of `anchor`. */
export function sparks(anchor: HTMLElement, count = 18): void {
  if (reducedMotion()) return;
  const layer = document.getElementById('fx');
  if (!layer) return;
  const rect = anchor.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 50 + Math.random() * 70;
    piece.style.left = `${Math.round(x)}px`;
    piece.style.top = `${Math.round(y)}px`;
    piece.style.background = COLORS[i % COLORS.length]!;
    piece.style.setProperty('--dx', `${Math.round(Math.cos(angle) * distance)}px`);
    piece.style.setProperty('--dy', `${Math.round(Math.sin(angle) * distance)}px`);
    piece.style.animationDelay = `${Math.round(Math.random() * 60)}ms`;
    layer.append(piece);
    setTimeout(() => piece.remove(), 900);
  }
}

/** Success: the card flashes green and hops, a pixel check lands on the capsule, sparks fly. */
export function celebrate(card: HTMLElement, delay = 0): void {
  setTimeout(() => {
    replay(card, 'fx-celebrate', 900);
    const capsule = card.querySelector<HTMLElement>('.capsule-wrap');
    if (capsule && !capsule.querySelector('.check')) {
      const check = document.createElement('span');
      check.className = 'check';
      check.append(pixelIcon('check', 2));
      capsule.append(check);
    }
    sparks(card);
  }, delay);
}

/** Failure: shake with a red frame. Softer amber wiggle for "needs base game". */
export function fail(card: HTMLElement, soft = false): void {
  replay(card, soft ? 'fx-wiggle' : 'fx-shake', 900);
}

export function toast(text: string, kind: 'ok' | 'bad' | 'warn'): void {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = document.createElement('div');
  node.className = `toast toast-${kind} px${pixelSafe(text) ? '' : ' nopx'}`;
  node.textContent = text;
  host.append(node);
  setTimeout(() => node.classList.add('leaving'), 2600);
  setTimeout(() => node.remove(), 3000);
}

/** Busy state for a button while its command is in flight. */
export function busy(button: HTMLButtonElement): void {
  button.disabled = true;
  button.classList.add('is-busy');
}
