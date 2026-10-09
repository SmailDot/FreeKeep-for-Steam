// Visual feedback for claim results. Pure DOM + CSS, no dependencies.

const COLORS = ['#8b6cff', '#22c55e', '#facc15', '#38bdf8', '#f472b6', '#fb923c'];
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function replay(el: HTMLElement, className: string, ms: number): void {
  el.classList.remove(className);
  void el.offsetWidth; // restart the animation if it is already applied
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}

/** Bursts confetti from the centre of `anchor` inside the fixed #fx layer. */
export function confetti(anchor: HTMLElement, count = 44): void {
  if (reducedMotion()) return;
  const layer = document.getElementById('fx');
  if (!layer) return;
  const rect = anchor.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const distance = 70 + Math.random() * 110;
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.background = COLORS[i % COLORS.length]!;
    piece.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    piece.style.setProperty('--dy', `${Math.sin(angle) * distance - 40}px`);
    piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    piece.style.animationDelay = `${Math.random() * 80}ms`;
    if (i % 3 === 0) piece.classList.add('round');
    layer.append(piece);
    setTimeout(() => piece.remove(), 1400);
  }
}

/** Success: glow + bounce on the card, a drawn check mark on the capsule, confetti. */
export function celebrate(card: HTMLElement, delay = 0): void {
  setTimeout(() => {
    replay(card, 'fx-celebrate', 1600);
    const capsule = card.querySelector<HTMLElement>('.capsule-wrap');
    if (capsule && !capsule.querySelector('.check')) {
      capsule.insertAdjacentHTML(
        'beforeend',
        '<svg class="check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg>',
      );
    }
    confetti(card);
  }, delay);
}

/** Failure: shake + red flash. Softer amber wiggle for "needs base game". */
export function fail(card: HTMLElement, soft = false): void {
  replay(card, soft ? 'fx-wiggle' : 'fx-shake', 900);
}

export function toast(text: string, kind: 'ok' | 'bad' | 'warn'): void {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = document.createElement('div');
  node.className = `toast toast-${kind}`;
  node.textContent = text;
  host.append(node);
  setTimeout(() => node.classList.add('leaving'), 2600);
  setTimeout(() => node.remove(), 3000);
}

/** Spinner state for a button while its command is in flight. */
export function busy(button: HTMLButtonElement): void {
  button.disabled = true;
  button.classList.add('is-busy');
}
