export const WELCOME_MSG = `Привет! Этот бот создан для проведения похожего на Тайного Санту мероприятия, только вместо подарков вам будут рекомендовать аниме тайтлы.

Список команд:
/new - создать новое мероприятие
/my - вывести список ваших мероприятий
/cancel - команда для отмены текущей операции в любой момент`

export const CREATE_START_DATE_MSG = `Тайный Аниме Санта состоит из трёх этапов:
1. Регистрация
2. Выбор тайтлов
3. Просмотр и написание отзывов

Снача, необходимо выбрать дату, до которой участники смогут регистрироваться. В этот же день будут выбраны пары Санта-подопечный и начнётся второй этап.

Напишите дату в формате ДД.ММ.ГГГГ:`

export const CREATE_SELECT_DATE_MSG = `Отлично! Теперь надо выбрать дату, до которой надо выбрать тайтл.

Напишите дату в формате ДД.ММ.ГГГГ:`

export const CREATE_DEADLINE_DATE_MSG = `И последний шаг с датами: дедлайн, до которого надо посмотреть тайтл и написать отзыв.

Напишите дату в формате ДД.ММ.ГГГГ:`

export const DATE_PARSE_ERROR_MSG = `А не ошиблись ли вы с форматом даты часом? Надо строго ДД.ММ.ГГГГ. Попробуйте ещё раз...`

export const DATE_INVALID_ERROR_MSG = `Что-то не так с датой... Может слишком маленькая или слишком большая...`

export const CREATE_CHAT_MSG = `Обычно Тайный Санта проводится в каком-то чате, поэтому удобно пересылать отзывы на тайтлы туда. Можете выбрать чат для пересылки или пропустить этот шаг с помощью команды /next. Не забудьте добавить меня туда, если всё таки решитесь.`

export const CREATE_RULES_MSG = `Теперь напишите правила. Этот пост будет использоваться как приветствие для присоединяющихся людей. Не забудьте написать там ограничения.`

export const CREATE_RESTRICTIONS_MSG = `Ограничения текстом - это хорошо, но автоматически проверять их ещё лучше! Напишите ограничение на тайтлы.`

export const CREATE_RESTRICTIONS_SUCCESS_MSG = `Успешно добавили ограничения!`

export const CREATE_RESTRICTIONS_FAILURE_MSG = `Не удалось распознать ограничения, попробуйте ещё раз...`

export const CREATE_OPTIONS_MSG = `Завершающие штрихи. Можете добавить пару опций для вашего мероприятия или просто перейти дальше через /next.`

export const PARTICIPATE_OPTIONS_MSG = `Завершающие штрихи. Можете добавить пару опций для вашей заявки.`

export const PARTICIPATE_SENT_MSG = `Вы успешно отправили заявку! Осталось дождаться её одобрения создателем...`

export const PARTICIPATE_SELECT_TITLE_MSG = (user: string) => `Ваш подопечный: ${user}, пожалуйста, отправьте в ответ ссылку на загаданный вами тайтл.`

export const PARTICIPATE_SELECT_TITLE_SUCCESS_MSG = `Вы успешно выбрали тайтл! Когда настанет час он отправится вашему подопечному :3`

export const PARTICIPATE_WRITE_REVIEW_MSG = (link: string) => `Ваш тайтл: ${link}. Приятного просмотра! Не забудьте написать отзыв на него.`

export const PARTICIPATE_WRITE_REVIEW_SUCCESS_MSG = `Вы успешно написали отзыв :3`

export const CREATE_FINISH_MSG = (link: string) =>
    `Ура! У вас получилось. Ссылка для присоединения ${link}.`

export const SELECT_CHAT_BUTTON = `Выбрать чат`
