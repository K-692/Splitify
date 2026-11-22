/**
 * Reference-counted page scroll lock that also works on iOS Safari.
 *
 * `overflow: hidden` on <body> is ignored by iOS for touch scrolling, so the
 * page behind a modal keeps scrolling (especially while the keyboard is open).
 * Pinning <body> with `position: fixed` at the current offset stops that, and
 * the scroll position is restored when the last lock is released.
 */
let lockCount = 0;
let savedScrollY = 0;
let savedStyles: Partial<CSSStyleDeclaration> = {};

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  lockCount += 1;
  if (lockCount > 1) return;
  const body = document.body;
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  savedStyles = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };
  body.style.position = 'fixed';
  body.style.top = `-${savedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  document.documentElement.classList.add('scroll-locked');
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined' || lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return;
  const body = document.body;
  body.style.position = savedStyles.position || '';
  body.style.top = savedStyles.top || '';
  body.style.left = savedStyles.left || '';
  body.style.right = savedStyles.right || '';
  body.style.width = savedStyles.width || '';
  body.style.overflow = savedStyles.overflow || '';
  document.documentElement.classList.remove('scroll-locked');
  window.scrollTo(0, savedScrollY);
}
