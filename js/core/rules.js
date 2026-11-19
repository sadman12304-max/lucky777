// Правила и таблицы выплат для шторки «i».

export const RULES = {
  slots: {
    title: 'Слоты · правила',
    body: `
      <p>Пять барабанов и три ряда. Выигрыш считается по 5 линиям слева направо: нужны 3, 4 или 5 одинаковых символов подряд.</p>
      <div class="rules-list">
        <div class="rule-row"><span>Вишня</span><b>×8 · ×22 · ×55</b></div>
        <div class="rule-row"><span>Лимон</span><b>×11 · ×28 · ×70</b></div>
        <div class="rule-row"><span>Колокол</span><b>×16 · ×44 · ×115</b></div>
        <div class="rule-row"><span>Звезда</span><b>×28 · ×70 · ×210</b></div>
        <div class="rule-row"><span>Алмаз</span><b>×50 · ×140 · ×420</b></div>
        <div class="rule-row"><span>Семёрка</span><b>×200 · ×700 · ×3500</b></div>
      </div>
      <p style="margin-top:12px">Множители указаны к ставке на линию. Ставка на спин делится между пятью линиями. Возврат игроку — около 96% на длинной дистанции.</p>
    `,
  },
  roulette: {
    title: 'Рулетка · правила',
    body: `
      <p>Европейская рулетка: 37 чисел, одно зеро. Можно ставить на число или на внешние поля.</p>
      <div class="rules-list">
        <div class="rule-row"><span>Одно число</span><b>×36</b></div>
        <div class="rule-row"><span>Красное / чёрное</span><b>×2</b></div>
        <div class="rule-row"><span>Чётное / нечётное</span><b>×2</b></div>
        <div class="rule-row"><span>1–18 / 19–36</span><b>×2</b></div>
        <div class="rule-row"><span>Дюжина: 1–12 · 13–24 · 25–36</span><b>×3</b></div>
      </div>
      <p style="margin-top:12px">Множитель включает возврат ставки. Нулевое зеро выигрывает только при ставке на 0. Преимущество заведения — 2,7%.</p>
    `,
  },
  crash: {
    title: 'Краш · правила',
    body: `
      <p>Множитель растёт с первой секунды. Успейте забрать — если график взорвётся раньше, ставка сгорает.</p>
      <div class="rules-list">
        <div class="rule-row"><span>Забрать на ×1,5</span><b>шанс ~65%</b></div>
        <div class="rule-row"><span>Забрать на ×2</span><b>шанс ~49%</b></div>
        <div class="rule-row"><span>Забрать на ×5</span><b>шанс ~19%</b></div>
        <div class="rule-row"><span>Забрать на ×10</span><b>шанс ~10%</b></div>
      </div>
      <p style="margin-top:12px">Авто-кэшаут забирает ставку автоматически, если множитель дошёл до цели. Возврат игроку — 97%.</p>
    `,
  },
  blackjack: {
    title: 'Блэкджек · правила',
    body: `
      <p>Цель — набрать больше очков, чем дилер, но не больше 21. Дилер добирает до 17 и останавливается.</p>
      <div class="rules-list">
        <div class="rule-row"><span>Победа</span><b>1:1</b></div>
        <div class="rule-row"><span>Блэкджек с двух карт</span><b>3:2</b></div>
        <div class="rule-row"><span>Пуш (равенство)</span><b>ставка назад</b></div>
        <div class="rule-row"><span>Удвоение</span><b>+1 карта, ставка ×2</b></div>
      </div>
      <p style="margin-top:12px">Туз считается за 11 или 1 — автоматически, как выгоднее. Колода — 6 колод, тасуется, когда остаётся меньше 24 карт. При базовой стратегии преимущество заведения — около 1–2%.</p>
    `,
  },
  keno: {
    title: 'Кено · правила',
    body: `
      <p>Выбери 10 чисел из 80. Выпадает 20 — чем больше совпадений, тем больше выплата. Выигрыш начинается с 4 попаданий.</p>
      <div class="rules-list">
        <div class="rule-row"><span>4 попадания</span><b>×2.5</b></div>
        <div class="rule-row"><span>5</span><b>×5</b></div>
        <div class="rule-row"><span>6</span><b>×16</b></div>
        <div class="rule-row"><span>7</span><b>×60</b></div>
        <div class="rule-row"><span>8</span><b>×300</b></div>
        <div class="rule-row"><span>9</span><b>×1500</b></div>
        <div class="rule-row"><span>10</span><b>×5000</b></div>
      </div>
      <p style="margin-top:12px">Множители — к ставке. Числа выпадают криптографическим генератором. Возврат игроку — около 96%.</p>
    `,
  },
  dice: {
    title: 'Кости · правила',
    body: `
      <p>Выпадает число от 1 до 100. Выберите цель и направление: «больше» или «меньше».</p>
      <div class="rules-list">
        <div class="rule-row"><span>Шанс 50%</span><b>×1,94</b></div>
        <div class="rule-row"><span>Шанс 25%</span><b>×3,88</b></div>
        <div class="rule-row"><span>Шанс 10%</span><b>×9,70</b></div>
        <div class="rule-row"><span>Шанс 90%</span><b>×1,08</b></div>
      </div>
      <p style="margin-top:12px">Чем рискованнее ставка — тем выше множитель. Возврат игроку — 97%.</p>
    `,
  },
  bonus: {
    title: 'Колесо фортуны',
    body: `
      <p>Бесплатный прокрут раз в 4 часа. Приз — от 500 до 8 000 очков. Серия прокрутов подряд (окно 8 часов) даёт до +50% к призу.</p>
      <p>Колесо честное: приз выбирается криптографическим генератором случайных чисел, анимация только показывает результат.</p>
    `,
  },
};

export function openRules(ctx, key) {
  const rule = RULES[key];
  if (!rule) return;
  ctx.openSheet({
    title: rule.title,
    body: rule.body,
    actions: [{ label: 'Понятно', kind: 'primary' }],
  });
}
