# Инструкция по настройке Codeforces Karma

## 1. Добавление поля в базу данных

Выполните следующий SQL запрос в SurrealDB для добавления поля `codeforces_karma`:

```sql
UPDATE users SET codeforces_karma = 0 WHERE codeforces_karma IS NONE;
```

Или через SurrealDB CLI:
```bash
surreal sql --conn ws://45.149.234.80:8000 --ns bcsp --db site --user admin --pass lbvfkjigtl
> UPDATE users SET codeforces_karma = 0 WHERE codeforces_karma IS NONE;
```

**Примечание:** SurrealDB поддерживает динамические поля, поэтому поле `codeforces_karma` будет автоматически создано при первой записи.

## 2. Проверка работы API

### Проверка API профиля
```bash
curl http://localhost:3000/api/profile
```

В ответе должно быть поле `codeforces_karma`:
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "users:...",
      "full_name": "...",
      "email": "...",
      "bscp_rating": 1200,
      "codeforces_karma": 0,
      ...
    }
  }
}
```

### Проверка API кармы Codeforces
```bash
curl http://localhost:3000/api/codeforces/karma
```

Ответ должен содержать:
```json
{
  "ok": true,
  "data": {
    "karma": 150,
    "karmaLevel": "Начинающий",
    "karmaColor": "#008000",
    "breakdown": {
      "easyKarma": 50,
      "mediumKarma": 90,
      "hardKarma": 10,
      "tagBonusKarma": 0,
      "diversityBonus": 0
    },
    "details": {
      "totalSolved": 50,
      "easyCount": 30,
      "mediumCount": 15,
      "hardCount": 5,
      "averageRating": 1400,
      "uniqueTags": 10
    },
    ...
  }
}
```

## 3. Обновление кармы

Для пересчета кармы отправьте POST запрос:
```bash
curl -X POST http://localhost:3000/api/codeforces/karma
```

## 4. Проверка в интерфейсе

1. Откройте страницу профиля: `http://localhost:3000/profile`
2. Если Codeforces аккаунт привязан, вы должны увидеть:
   - Рейтинг БЦСП (слева)
   - Карма Codeforces с уровнем (справа)
   - Кнопка 📊 для просмотра детальной статистики

## 5. Возможные проблемы

### Карма не отображается
1. Проверьте консоль браузера на наличие ошибок
2. Проверьте, что `/api/profile` возвращает `codeforces_karma`
3. Проверьте, что `/api/codeforces/karma` возвращает данные

### Ошибка "Codeforces аккаунт не привязан"
Убедитесь, что вы привязали аккаунт Codeforces через кнопку "Подключить Codeforces" в профиле.

### Поле codeforces_karma отсутствует в БД
Выполните SQL запрос из пункта 1.

## 6. Формула расчета кармы

```
Карма = (easy × 1 + medium × 3 + hard × 10) × tagMultiplier + diversityBonus
```

**Веса:**
- Легкие задачи (< 1200): 1
- Средние задачи (1200-2000): 3
- Сложные задачи (2000+): 10

**Множители за теги:**
- Динамическое программирование: 1.5x
- Графы: 1.5x
- Структуры данных: 1.4x
- Математика: 1.3x
- Жадные алгоритмы: 1.2x

**Бонусы:**
- За каждый уникальный тег: +2
- За задачу с контеста: +1
