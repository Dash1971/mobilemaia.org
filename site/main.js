/* Copyright (c) 2026 Mobile Maia contributors. SPDX-License-Identifier: AGPL-3.0-only */
'use strict';
document.documentElement.classList.add('js');

// Progressive enhancement only: content, downloads and FAQ work without JS.
const views = {
  play: { src: 'assets/play.jpg', alt: 'Mobile Maia playing an opening as Black against a human player', caption: 'A partner for your next game.' },
  analysis: { src: 'assets/analysis.png', alt: 'Mobile Maia Analysis Board comparing Stockfish lines with Maia 1600 and Maia 2400 move probabilities', caption: 'Two perspectives. One position.' },
  review: { src: 'assets/review.png', alt: 'Mobile Maia reviewing the Byrne–Fischer game with a brilliant bishop move and Maia and Stockfish suggestions', caption: 'Follow a move. Find a new idea.' }
};
const screen = document.getElementById('app-screen');
const screenLink = document.getElementById('screen-link');
const caption = document.getElementById('screen-caption');
document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => {
    const view = views[button.dataset.view];
    screen.src = view.src;
    screen.alt = view.alt;
    screenLink.href = view.src;
    screenLink.setAttribute('aria-label', `Enlarge screenshot: ${button.textContent}`);
    caption.textContent = view.caption;
    document.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  });
});
const dialog = document.getElementById('image-dialog');
if (dialog && typeof dialog.showModal === 'function') {
  document.querySelectorAll('[data-zoom]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const image = dialog.querySelector('img');
      image.src = link.href;
      image.alt = link.querySelector('img').alt;
      dialog.showModal();
    });
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
}
