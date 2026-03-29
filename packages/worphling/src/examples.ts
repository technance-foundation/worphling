export const EXAMPLE_INPUT = `
{
  "es": {
    "app.auth.login.buttons.forgotPassword": "Forgot your password?",
    "app.auth.login.errors.accountLocked": "Your account has been locked. Contact support.",
    "app.markets.priceTitle": "{symbol} price",
    "app.search.summary": "{resultCount, number} results for {query}",
    "landing.errors.404.title": "Page Not Found",
    "landing.errors.404.message": "The page you are looking for does not exist.",
    "landing.errors.500.title": "Server Error",
    "landing.errors.500.message": "Something went wrong. Please try again later."
  },
  "fa": {
    "app.auth.login.buttons.forgotPassword": "Forgot your password?",
    "app.auth.login.errors.accountLocked": "Your account has been locked. Contact support.",
    "app.trade.closeMessage": "Order {closeType, select, market {closed at market} limit {closed at limit price} other {closed}}"
  },
  "ru": {
    "app.auth.login.buttons.forgotPassword": "Forgot your password?",
    "app.notifications.count": "{count, plural, =0 {no notifications} =1 {one notification} other {# notifications}}",
    "landing.errors.500.title": "Server Error",
    "landing.errors.500.message": "Something went wrong. Please try again later."
  }
}
`;

export const EXAMPLE_OUTPUT = `
{
  "es": {
    "app.auth.login.buttons.forgotPassword": "¿Olvidaste tu contraseña?",
    "app.auth.login.errors.accountLocked": "Tu cuenta ha sido bloqueada. Contacta con soporte.",
    "app.markets.priceTitle": "Precio de {symbol}",
    "app.search.summary": "{query}: {resultCount, number} resultados",
    "landing.errors.404.title": "Página no encontrada",
    "landing.errors.404.message": "La página que buscas no existe.",
    "landing.errors.500.title": "Error del servidor",
    "landing.errors.500.message": "Algo salió mal. Por favor, inténtalo de nuevo más tarde."
  },
  "fa": {
    "app.auth.login.buttons.forgotPassword": "رمز عبور خود را فراموش کرده‌اید؟",
    "app.auth.login.errors.accountLocked": "حساب شما قفل شده است. با پشتیبانی تماس بگیرید.",
    "app.trade.closeMessage": "سفارش {closeType, select, market {با قیمت بازار بسته شد} limit {با قیمت لیمیت بسته شد} other {بسته شد}}"
  },
  "ru": {
    "app.auth.login.buttons.forgotPassword": "Забыли пароль?",
    "app.notifications.count": "{count, plural, =0 {нет уведомлений} =1 {одно уведомление} few {# уведомления} many {# уведомлений} other {# уведомления}}",
    "landing.errors.500.title": "Ошибка сервера",
    "landing.errors.500.message": "Что-то пошло не так. Пожалуйста, попробуйте позже."
  }
}
`;

export const EXAMPLE_NEXT_INTL_INPUT = `
{
  "es": {
    "app.greeting": "Hello <bold>{name}</bold>",
    "app.referral.cta": "{brandName} referral program <highlight>now live</highlight>",
    "app.user.profile": "{gender, select, female {She} male {He} other {They}} is online.",
    "app.user.followers": "You have {count, plural, =0 {no followers yet} =1 {one follower} other {# followers}}.",
    "app.user.birthday": "It's your {year, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} birthday!",
    "app.auth.login.buttons.forgotPassword": "Forgot your password?",
    "landing.errors.404.title": "Page Not Found",
    "landing.errors.404.message": "The page you are looking for does not exist."
  },
  "fa": {
    "app.greeting": "Hello <bold>{name}</bold>",
    "app.trade.status": "{status, select, error {Rejected} success {Verified} loading {Verifying} other {}} open trade",
    "app.trade.title": "Order {status, select, error {failed} success {placed} loading {placing} other {}}"
  },
  "ru": {
    "app.greeting": "Hello <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {She} male {He} other {They}} is online.",
    "app.user.birthday": "It's your {year, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} birthday!"
  }
}
`;

export const EXAMPLE_NEXT_INTL_OUTPUT = `
{
  "es": {
    "app.greeting": "Hola <bold>{name}</bold>",
    "app.referral.cta": "<highlight>Ya disponible</highlight> el programa de referidos de {brandName}",
    "app.user.profile": "{gender, select, female {Ella} male {Él} other {Ellos}} está en línea.",
    "app.user.followers": "Tienes {count, plural, =0 {ningún seguidor aún} =1 {un seguidor} other {# seguidores}}.",
    "app.user.birthday": "Es tu {year, selectordinal, one {#º} two {#º} few {#º} other {#º}} cumpleaños!",
    "app.auth.login.buttons.forgotPassword": "¿Olvidaste tu contraseña?",
    "landing.errors.404.title": "Página no encontrada",
    "landing.errors.404.message": "La página que buscas no existe."
  },
  "fa": {
    "app.greeting": "سلام <bold>{name}</bold>",
    "app.trade.status": "{status, select, error {رد شد} success {تأیید شد} loading {در حال تأیید} other {}} معامله باز",
    "app.trade.title": "سفارش {status, select, error {ناموفق} success {ثبت شد} loading {در حال ثبت} other {}}"
  },
  "ru": {
    "app.greeting": "Привет <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {Она} male {Он} other {Они}} в сети.",
    "app.user.birthday": "Это ваш {year, selectordinal, one {#-й} two {#-й} few {#-й} other {#-й}} день рождения!"
  }
}
`;
