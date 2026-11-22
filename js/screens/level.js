// Карточки уровня на главной и в профиле.

import { store } from '../core/store.js';
import { levelProgress } from '../core/levels.js';
import { fmt } from '../core/util.js';

export function setupLevel(ctx) {
  const cards = Array.from(document.querySelectorAll('[data-level]'));
  if (!cards.length) return { render() {} };

  function render() {
    const p = levelProgress(store.get());
    cards.forEach((card) => {
      card.querySelector('[data-level-num]').textContent = String(p.lvl);
      card.querySelector('[data-level-name]').textContent = p.name;
      card.querySelector('[data-level-xp]').textContent = `${fmt(p.xp)} / ${fmt(p.quota)}`;
      card.querySelector('[data-level-left]').textContent = fmt(p.left);
      card.querySelector('[data-level-fill]').style.width = `${p.pct}%`;
      const resets = card.querySelector('[data-level-resets]');
      if (resets) resets.textContent = `сбросов: ${p.resets}`;
    });
  }

  store.addEventListener('change', render);
  store.addEventListener('levelup', () => {
    const p = levelProgress(store.get());
    render();
    ctx.toast(`Новый уровень: ${p.name} (${p.lvl})`, 'win', 3000);
    ctx.sfx.bigWin();
    ctx.haptic('success');
    ctx.confetti(46);
  });
  store.addEventListener('bankrupt', () => {
    render();
    ctx.toast('Банкрот: уровень сброшен на 1, начислено 1 000 очков', 'loss', 3800);
    ctx.sfx.lose();
  });

  render();
  return { render };
}
