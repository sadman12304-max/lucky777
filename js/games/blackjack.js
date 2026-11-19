// Экран блэкджека: раздача, добор, удвоение, дилер.

import { createShoe, handValue, isBlackjack, dealerShouldHit, settle, canDouble } from '../math/blackjack.js';
import { fmt, sleep } from '../core/util.js';

export function setupBlackjack(ctx) {
  const { store, sfx, haptic, toast, confetti, floatWin } = ctx;

  const dealerHand = document.getElementById('bjDealerHand');
  const playerHand = document.getElementById('bjPlayerHand');
  const dealerScore = document.getElementById('bjDealerScore');
  const playerScore = document.getElementById('bjPlayerScore');
  const banner = document.getElementById('bjBanner');
  const statusEl = document.getElementById('bjStatus');
  const three = document.getElementById('bjThree');
  const dealBtn = document.getElementById('bjDeal');
  const betLabel = document.getElementById('bjBetLabel');
  const betHost = document.getElementById('bjBet');
  const doubleBtn = three.querySelector('[data-bj="double"]');

  const betCtl = ctx.createBetControl(betHost, {
    initial: 100,
    chips: [10, 50, 100, 500, 1000],
    onChange: (v) => { betLabel.textContent = fmt(v); },
  });

  let shoe = createShoe(6);
  let player = [];
  let dealer = [];
  let bet = 0;
  let phase = 'idle'; // idle | player | dealer | over
  let hidden = true;
  let playerEls = [];
  let dealerEls = [];
  let busy = false;

  function draw() {
    if (shoe.length < 24) shoe = createShoe(6);
    return shoe.pop();
  }

  function cardFace(card) {
    return `
      <div class="face">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.symbol}</span>
        <span class="rank bottom">${card.rank}</span>
      </div>
    `;
  }

  function cardNode(card, isHidden = false) {
    const node = document.createElement('div');
    node.className = `bj-card ${card.color === 'red' ? 'red' : ''}${isHidden ? ' is-hidden' : ''}`;
    // Скрытая карта дилера не содержит ранга в DOM — из devtools её не подсмотреть.
    if (!isHidden) node.innerHTML = cardFace(card);
    node.animate(
      [
        { transform: 'translateY(-16px) scale(.9)', opacity: 0 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ],
      { duration: 260, easing: 'cubic-bezier(.2,1.2,.4,1)' }
    );
    return node;
  }

  function renderScores() {
    const p = handValue(player);
    playerScore.textContent = player.length ? String(p.total) : '';
    if (!dealer.length) {
      dealerScore.textContent = '';
    } else if (hidden) {
      dealerScore.textContent = `${handValue([dealer[0]]).total} + ?`;
    } else {
      dealerScore.textContent = String(handValue(dealer).total);
    }
  }

  function setControls() {
    const playing = phase === 'player';
    three.hidden = !playing;
    dealBtn.hidden = playing;
    betHost.style.display = playing ? 'none' : '';
    doubleBtn.disabled = !playing || !canDouble(player, store.get().balance, bet);
    dealBtn.disabled = busy || playing;
    const span = dealBtn.querySelector('span');
    span.textContent = phase === 'over' ? 'Новая раздача' : 'Раздать';
    betLabel.textContent = fmt(betCtl.get());
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `bj-banner show ${kind || ''}`;
    setTimeout(() => banner.classList.remove('show'), 2600);
  }

  function clearTable() {
    dealerHand.innerHTML = '';
    playerHand.innerHTML = '';
    playerEls = [];
    dealerEls = [];
    player = [];
    dealer = [];
    banner.classList.remove('show');
    banner.textContent = '';
    dealerScore.textContent = '—';
    playerScore.textContent = '—';
  }

  function addCard(target, card, isHidden = false) {
    const node = cardNode(card, isHidden);
    if (target === 'player') {
      player.push(card);
      playerEls.push(node);
      playerHand.appendChild(node);
    } else {
      dealer.push(card);
      dealerEls.push(node);
      dealerHand.appendChild(node);
    }
    renderScores();
  }

  function revealHole() {
    if (!hidden) return;
    hidden = false;
    const hole = dealerEls[1];
    if (hole) {
      hole.classList.remove('is-hidden');
      hole.classList.toggle('red', dealer[1]?.color === 'red');
      hole.innerHTML = cardFace(dealer[1]);
      hole.animate(
        [
          { transform: 'rotateY(0deg)' },
          { transform: 'rotateY(90deg)' },
          { transform: 'rotateY(0deg)' },
        ],
        { duration: 360, easing: 'ease-in-out' }
      );
    }
    renderScores();
  }

  function finish(result) {
    if (phase === 'over') return;
    phase = 'over';
    busy = false;
    hidden = false;
    const payout = result.payout;
    if (payout > 0) store.payout(payout, bet);
    store.recordRound({ game: 'blackjack', bet, win: payout });

    if (result.outcome === 'blackjack') {
      showBanner(`БЛЭКДЖЕК +${fmt(result.net)}`, 'win');
      sfx.bigWin();
      confetti(64);
      haptic('success');
    } else if (result.outcome === 'win') {
      showBanner(`ПОБЕДА +${fmt(result.net)}`, 'win');
      sfx.win();
      haptic('success');
      if (result.net >= bet) confetti(40);
    } else if (result.outcome === 'push') {
      showBanner('ПУШ · ставка возвращена', 'push');
      sfx.tick();
    } else {
      showBanner(handValue(player).bust ? 'ПЕРЕБОР' : 'ДИЛЕР СИЛЬНЕЕ', 'lose');
      sfx.lose();
      haptic('error');
    }

    const rect = playerHand.getBoundingClientRect();
    if (result.net > 0) floatWin(`+${fmt(result.net)}`, rect.left + rect.width / 2, rect.top);
    statusEl.textContent = 'Раздача завершена';
    setControls();
  }

  async function dealerPlay() {
    phase = 'dealer';
    revealHole();
    renderScores();
    setControls();
    statusEl.textContent = 'Ход дилера';
    while (dealerShouldHit(dealer)) {
      await sleep(420);
      addCard('dealer', draw());
      renderScores();
      sfx.tick();
    }
    await sleep(320);
    finish(settle(player, dealer, bet));
  }

  async function startRound() {
    if (phase === 'player' || phase === 'dealer' || busy) return;
    busy = true;
    const amount = betCtl.get();
    if (amount > store.get().balance) {
      toast('Недостаточно очков — заберите бонус', 'loss');
      haptic('error');
      busy = false;
      return;
    }
    if (!store.placeBet(amount)) { busy = false; return; }

    clearTable();
    bet = amount;
    phase = 'player';
    hidden = true;
    addCard('player', draw());
    addCard('dealer', draw());
    addCard('player', draw());
    addCard('dealer', draw(), true);
    renderScores();
    setControls();
    statusEl.textContent = 'Ваш ход';
    sfx.stop();
    haptic('light');

    if (isBlackjack(player)) {
      await sleep(360);
      statusEl.textContent = 'Блэкджек!';
      revealHole();
      await sleep(320);
      finish(settle(player, dealer, bet));
      return;
    }
    busy = false;
    setControls();
  }

  async function hit() {
    if (phase !== 'player' || busy) return;
    busy = true;
    addCard('player', draw());
    renderScores();
    sfx.tick();
    haptic('light');

    if (handValue(player).bust) {
      revealHole();
      await sleep(280);
      finish(settle(player, dealer, bet));
      return;
    }
    if (handValue(player).total === 21) {
      busy = false;
      await dealerPlay();
      return;
    }
    busy = false;
    setControls();
  }

  async function stand() {
    if (phase !== 'player' || busy) return;
    await dealerPlay();
  }

  async function doubleDown() {
    if (phase !== 'player' || busy) return;
    if (!canDouble(player, store.get().balance, bet)) {
      toast('Нужно минимум 2 карты и запас очков', 'loss');
      return;
    }
    if (!store.placeBet(bet)) return;
    bet *= 2;
    busy = true;
    setControls();
    addCard('player', draw());
    renderScores();
    sfx.coin();
    if (handValue(player).bust) {
      revealHole();
      await sleep(300);
      finish(settle(player, dealer, bet));
      return;
    }
    busy = false;
    await dealerPlay();
  }

  dealBtn.addEventListener('click', startRound);
  three.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bj]');
    if (!btn) return;
    if (btn.dataset.bj === 'hit') hit();
    else if (btn.dataset.bj === 'stand') stand();
    else if (btn.dataset.bj === 'double') doubleDown();
  });

  betCtl.sync();
  setControls();

  const api = {
    enter() {
      if (phase === 'idle' || phase === 'over') {
        setControls();
      }
    },
    leave() {
      // Ушли с экрана с активной раздачей — доигрываем по правилам, чтобы не сбегать от проигрыша.
      if (phase === 'player' && !busy) stand();
    },
    _start: startRound,
    _hit: hit,
    _stand: stand,
    _double: doubleDown,
  };
  if (ctx.debug) api._state = () => ({ phase, player: [...player], dealer: [...dealer], bet });
  return api;
}
