// Блэкджек: колода, стоимость рук, логика дилера.

import { shuffle } from './rng.js';

export const SUITS = [
  { id: 'spades', symbol: '♠', color: 'black' },
  { id: 'hearts', symbol: '♥', color: 'red' },
  { id: 'diamonds', symbol: '♦', color: 'red' },
  { id: 'clubs', symbol: '♣', color: 'black' },
];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const RANK_VALUE = { A: 11, J: 10, Q: 10, K: 10 };

export function cardValue(card) {
  return RANK_VALUE[card.rank] ?? Number(card.rank);
}

export function createShoe(decks = 6) {
  const shoe = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ rank, suit: suit.id, symbol: suit.symbol, color: suit.color });
      }
    }
  }
  return shuffle(shoe);
}

/** { total, soft, bust } — туз считается 11, пока не перебор. */
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const v = cardValue(card);
    total += v;
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0, bust: total > 21 };
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Дилер добирает до 17, на мягких 17 останавливается (S17). */
export function dealerShouldHit(cards) {
  return handValue(cards).total < 17;
}

export function canDouble(playerCards, balance, bet) {
  return playerCards.length === 2 && balance >= bet;
}

/**
 * Итог раздачи.
 * @returns {{outcome:'win'|'lose'|'push'|'blackjack', payout:number, net:number}}
 */
export function settle(playerCards, dealerCards, bet) {
  const p = handValue(playerCards);
  const d = handValue(dealerCards);
  const playerBJ = isBlackjack(playerCards);
  const dealerBJ = isBlackjack(dealerCards);

  if (playerBJ && dealerBJ) return { outcome: 'push', payout: bet, net: 0 };
  if (playerBJ) return { outcome: 'blackjack', payout: Math.round(bet * 2.5), net: Math.round(bet * 1.5) };
  if (p.bust) return { outcome: 'lose', payout: 0, net: -bet };
  if (dealerBJ) return { outcome: 'lose', payout: 0, net: -bet };
  if (d.bust) return { outcome: 'win', payout: bet * 2, net: bet };
  if (p.total > d.total) return { outcome: 'win', payout: bet * 2, net: bet };
  if (p.total < d.total) return { outcome: 'lose', payout: 0, net: -bet };
  return { outcome: 'push', payout: bet, net: 0 };
}
