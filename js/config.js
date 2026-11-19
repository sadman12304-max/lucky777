// Настройки мини-аппы. Заполни после создания бота в @BotFather.
// Пока botUsername пустой — реферальные ссылки ведут на сайт (в браузер),
// а не в Telegram. После создания бота впиши username без @ и short name.
window.LUCKY_CONFIG = {
  botUsername: '',            // например: 'lucky777_points_bot'
  appShortName: 'lucky777',   // short name мини-аппы из BotFather
  referral: {
    inviteeBonus: 2000,       // сколько получает приглашённый
    inviterBonus: 1000,       // сколько получает пригласивший
    maxClaims: 50,            // максимум наград за друзей
    ttlDays: 30,              // срок жизни ссылки-бонуса
  },
};
