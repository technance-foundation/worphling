export const EXAMPLE_INPUT = `
{
  "es": {
    "app.auth.login.buttons.forgotPassword": "Forgot your password?",
    "app.auth.login.errors.accountLocked": "Your account has been locked. Contact support.",
    "landing.errors.404.title": "Page Not Found",
    "landing.errors.404.message": "The page you are looking for does not exist.",
    "landing.errors.500.title": "Server Error",
    "landing.errors.500.message": "Something went wrong. Please try again later."
  },
  "fa": {
    "app.auth.login.buttons.forgotPassword": "Forgot your password?",
    "app.auth.login.errors.accountLocked": "Your account has been locked. Contact support."
  },
  "ru": {
    "app.auth.login.buttons.forgotPassword": "Forgot your password?",
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
    "landing.errors.404.title": "Página no encontrada",
    "landing.errors.404.message": "La página que buscas no existe.",
    "landing.errors.500.title": "Error del servidor",
    "landing.errors.500.message": "Algo salió mal. Por favor, inténtalo de nuevo más tarde."
  },
  "fa": {
    "app.auth.login.buttons.forgotPassword": "رمز عبور خود را فراموش کرده‌اید؟",
    "app.auth.login.errors.accountLocked": "حساب شما قفل شده است. با پشتیبانی تماس بگیرید."
  },
  "ru": {
    "app.auth.login.buttons.forgotPassword": "Забыли пароль?",
    "landing.errors.500.title": "Ошибка сервера",
    "landing.errors.500.message": "Что-то пошло не так. Пожалуйста, попробуйте позже."
  }
}
`;

export const EXAMPLE_NEXT_INTL_INPUT = `
{
  "es": {
    "app.greeting": "Hello <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {She} male {He} other {They}} is online.",
    "app.user.followers": "You have {count, plural, =0 {no followers yet} =1 {one follower} other {# followers}}.",
    "app.user.birthday": "It's your {year, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} birthday!",
    "app.auth.login.buttons.forgotPassword": "Forgot your password?",
    "landing.errors.404.title": "Page Not Found",
    "landing.errors.404.message": "The page you are looking for does not exist."
  },
  "fa": {
    "app.greeting": "Hello <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {She} male {He} other {They}} is online.",
    "app.user.followers": "You have {count, plural, =0 {no followers yet} =1 {one follower} other {# followers}}."
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
    "app.user.profile": "{gender, select, female {Ella} male {Él} other {Ellos}} está en línea.",
    "app.user.followers": "Tienes {count, plural, =0 {ningún seguidor aún} =1 {un seguidor} other {# seguidores}}.",
    "app.user.birthday": "Es tu {year, selectordinal, one {#º} two {#º} few {#º} other {#º}} cumpleaños!",
    "app.auth.login.buttons.forgotPassword": "¿Olvidaste tu contraseña?",
    "landing.errors.404.title": "Página no encontrada",
    "landing.errors.404.message": "La página que buscas no existe."
  },
  "fa": {
    "app.greeting": "سلام <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {او} male {او} other {آنها}} آنلاین است.",
    "app.user.followers": "شما {count, plural, =0 {هیچ دنبال‌کننده‌ای ندارید} =1 {یک دنبال‌کننده دارید} other {# دنبال‌کننده دارید}}."
  },
  "ru": {
    "app.greeting": "Привет <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {Она} male {Он} other {Они}} в сети.",
    "app.user.birthday": "Это ваш {year, selectordinal, one {#-й} two {#-й} few {#-й} other {#-й}} день рождения!"
  }
}
`;
