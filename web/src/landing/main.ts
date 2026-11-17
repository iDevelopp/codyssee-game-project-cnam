/**
 * Landing page entry — imports the stylesheet (Vite bundles it) and wires
 * the two bits of behavior the page needs: scroll-reveal animations and the
 * seamless timeline marquee.
 */
import './landing.css';

/**
 * Duplicate the frieze list once so the marquee's translateX(-50%) loops
 * seamlessly (the second copy slides in exactly where the first started).
 * Done in JS to keep the HTML source free of duplicated content.
 */
function setupMarquee(): void {
  const track = document.querySelector('.frieze__track');
  const list = track?.querySelector('.frieze__list');
  if (track && list) {
    const clone = list.cloneNode(true) as HTMLElement;
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }
}

/** Reveal elements as they enter the viewport; falls back to visible-by-default. */
function setupReveals(): void {
  const elements = document.querySelectorAll<HTMLElement>('.reveal');
  if (!('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  elements.forEach((el) => observer.observe(el));
}

setupMarquee();
setupReveals();
