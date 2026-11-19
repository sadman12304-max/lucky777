// Кости 1–100: цель, направление, живой множитель.

import { roll, winChance, multiplier, isWin } from '../math/dice.js';
import { fmt, sleep } from '../core/util.js';

export function setupDice(ctx) {
  const { store, sfx, haptic, toast, confetti } = ctx;

  const numberEl = document.getElementById('diceNumber');
  const zoneEl = document.getElementById('diceZone');
  const markerEl = document.getElementById('diceMarker');
  const resultEl = document.getElementById('diceResultMark');
  const slider = document.getElementById('diceTarget');
  const targetVal = document.getElementById('diceTargetVal');
  const modeRoot = document.getElementById('diceMode');
  const chanceEl = document.getElementById('diceChance');
  const payoutEl = document.getElementById('dicePayout');
  const overLabel = document.getElementById('diceModeOver');
  const underLabel = document.getElementById('diceModeUnder');
  const rollBtn = document.getElementById('diceRollBtn');
  const betLabel = document.getElementById('diceBetLabel');
  const betHost = document.getElementById('diceBet');

  const betCtl = ctx.createBetControl(betHost, {
    initial: 100,
    chips: [10, 50, 100, 500, 1000],
    onChange: (v) => { betLabel.textContent = fmt(v); },
  });

  let target = 50;
  let over = true;
  let rolling = false;

  function syncUI() {
    const chance = winChance(target, over);
    const mult = multiplier(target, over);
    targetVal.textContent = String(target);
    overLabel.textContent = `> ${target}`;
    underLabel.textContent = `< ${target}`;
    chanceEl.textContent = `${Math.round(chance * 100)}%`;
    payoutEl.textContent = '×' + mult.toFixed(2);

    // зелёная зона = выигрышная
    if (over) {
      zoneEl.style.left = `${target}%`;
      zoneEl.style.width = `${100 - target}%`;
    } else {
      zoneEl.style.left = '0%';
      zoneEl.style.width = `${Math.max(0, target - 1)}%`;
    }
    markerEl.style.left = `${target}%`;

    modeRoot.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('is-active', (b.dataset.over === 'true') === over);
    });
  }

  slider.addEventListener('input', () => {
    target = Number(slider.value);
    syncUI();
    sfx.tick();
  });

  modeRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-over]');
    if (!btn) return;
    over = btn.dataset.over === 'true';
    syncUI();
    sfx.tick();
  });

  async function doRoll() {
    if (rolling) return;
    const bet = betCtl.get();
    if (bet > store.get().balance) {
      toast('Недостаточно очков — заберите бонус', 'loss');
      haptic('error');
      return;
    }
    if (!store.placeBet(bet)) return;

    rolling = true;
    rollBtn.disabled = true;
    slider.disabled = true;
    modeRoot.style.pointerEvents = 'none';
    resultEl.classList.remove('show');
    numberEl.classList.remove('win', 'lose');
    numberEl.classList.add('rolling');
    sfx.spin();

    const started = performance.now();
    while (performance.now() - started < 620) {
      numberEl.textContent = String(roll());
      await sleep(48);
    }

    const value = roll();
    const won = isWin(value, target, over);
    numberEl.textContent = String(value);
    numberEl.classList.remove('rolling');
    resultEl.style.left = `${value}%`;
    resultEl.classList.add('show');

    const mult = multiplier(target, over);

    if (won) {
      const win = Math.round(bet * mult);
      numberEl.classList.add('win');
      store.payout(win, bet);
      store.recordRound({ game: 'dice', bet, win });
      toast(`Выпало ${value} · +${fmt(win)}`, 'win', 3000);
      sfx.win();
      haptic('success');
      if (mult >= 5) {
        sfx.bigWin();
        confetti(44);
      }
    } else {
      numberEl.classList.add('lose');
      store.recordRound({ game: 'dice', bet, win: 0 });
      toast(`Выпало ${value} · мимо`, 'loss');
      sfx.lose();
    }

    rolling = false;
    rollBtn.disabled = false;
    slider.disabled = false;
    modeRoot.style.pointerEvents = '';
  }

  slider.value = String(target);
  rollBtn.addEventListener('click', doRoll);
  syncUI();

  return {
    enter() {
      betLabel.textContent = fmt(betCtl.get());
      syncUI();
    },
    leave() {},
    _roll: doRoll,
    _set: (t, o) => { target = t; over = o; slider.value = String(t); syncUI(); },
  };
}
