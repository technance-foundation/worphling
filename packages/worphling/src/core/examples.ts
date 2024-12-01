export const EXAMPLE_INPUT = `
{
  "es": {
    "app.auth.login.buttons.forgotPassword": "Forgot Password?",
    "landing.errors.404.message": "The page you're looking for doesn't exist.",
    "landing.errors.404.title": "Page Not Found",
    "landing.errors.500.message": "Something went wrong. Please try again later.",
    "landing.errors.500.title": "Server Error"
  },
  "fa": {
    "app.auth.login.errors.accountLocked": "Account locked. Contact support."
  },
  "ru": {
    "app.errors.500.message": "Something went wrong. Please try again later.",
    "app.errors.500.title": "Server Error"
  }
}
`;

export const EXAMPLE_OUTPUT = `
{
  "es": {
    "app.auth.login.buttons.forgotPassword": "¿Olvidaste tu contraseña?",
    "landing.errors.404.message": "La página que estás buscando no existe.",
    "landing.errors.404.title": "Página no encontrada",
    "landing.errors.500.message": "Algo salió mal. Por favor, inténtalo de nuevo más tarde.",
    "landing.errors.500.title": "Error del servidor"
  },
  "fa": {
    "app.auth.login.errors.accountLocked": "حساب شما قفل شده است. با پشتیبانی تماس بگیرید."
  },
  "ru": {
    "app.errors.500.message": "Что-то пошло не так. Пожалуйста, попробуйте позже.",
    "app.errors.500.title": "Ошибка сервера"
  }
}
`;

export const EXAMPLE_NEXT_INTL_INPUT = `
{
  "es": {
    "app.auth.login.buttons.forgotPassword": "Forgot Password?",
    "app.greeting": "Hello <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {She} male {He} other {They}} is online.",
    "app.user.followers": "You have {count, plural, =0 {no followers yet} =1 {one follower} other {# followers}}.",
    "app.user.birthday": "It's your {year, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} birthday!",
    "app.user.gender": "{gender, select, female {She} male {He} other {They}} is online."
    "landing.errors.404.message": "The page you're looking for doesn't exist.",
    "landing.errors.404.title": "Page Not Found",
    "landing.errors.500.message": "Something went wrong. Please try again later.",
    "landing.errors.500.title": "Server Error"
  },
  "fa": {
    "app.greeting": "Hello <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {She} male {He} other {They}} is online.",
    "app.user.followers": "You have {count, plural, =0 {no followers yet} =1 {one follower} other {# followers}}.",
    "app.user.birthday": "It's your {year, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} birthday!",
    "app.user.gender": "{gender, select, female {She} male {He} other {They}} is online.",
    "app.auth.login.errors.accountLocked": "Account locked. Contact support."
  },
  "ru": {
    "app.greeting": "Hello <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {She} male {He} other {They}} is online.",
    "app.user.followers": "You have {count, plural, =0 {no followers yet} =1 {one follower} other {# followers}}.",
    "app.user.birthday": "It's your {year, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} birthday!",
    "app.user.gender": "{gender, select, female {She} male {He} other {They}} is online.",
    "app.errors.500.message": "Something went wrong. Please try again later.",
    "app.errors.500.title": "Server Error"
  }
}
`;

export const EXAMPLE_NEXT_INTL_OUTPUT = `
{
  "es": {
    "app.auth.login.buttons.forgotPassword": "Forgot Password?",
    "app.greeting": "Hello <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {She} male {He} other {They}} is online.",
    "app.user.followers": "You have {count, plural, =0 {no followers yet} =1 {one follower} other {# followers}}.",
    "app.user.birthday": "It's your {year, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} birthday!",
    "landing.errors.404.message": "The page you're looking for doesn't exist.",
    "landing.errors.404.title": "Page Not Found",
    "landing.errors.500.message": "Something went wrong. Please try again later.",
    "landing.errors.500.title": "Server Error"
  },
  "fa": {
    "app.greeting": "سلام <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {او} male {او} other {آنها}} آنلاین است.",
    "app.user.followers": "شما {count, plural, =0 {هیچ دنبال‌کننده‌ای ندارید} =1 {یک دنبال‌کننده دارید} other {# دنبال‌کننده دارید}}.",
    "app.user.birthday": "تولدت {year, selectordinal, one {#ام} two {#دوم} few {#سوم} other {#ام}} است!",
    "app.auth.login.errors.accountLocked": "حساب کاربری قفل شده است. با پشتیبانی تماس بگیرید."
  },
  "ru": {
    "app.greeting": "Привет <bold>{name}</bold>",
    "app.user.profile": "{gender, select, female {Она} male {Он} other {Они}} онлайн.",
    "app.user.followers": "У вас {count, plural, =0 {нет подписчиков} =1 {один подписчик} other {# подписчиков}}.",
    "app.user.birthday": "Ваш {year, selectordinal, one {#-й} two {#-й} few {#-й} other {#-й}} день рождения!",
    "app.errors.500.message": "Что-то пошло не так. Пожалуйста, попробуйте позже.",
    "app.errors.500.title": "Ошибка сервера"
  }
}
`;
