---
description: "Sync, rebase, squash, self-check и push рабочей ветки"
user-invocable: true
disable-model-invocation: true
---

# PR Prepare — подготовка ветки к review

Синхронизирует форк, ребейзит ветку на master, сквошит коммиты и пушит в форк.

**Вызов:** `/pr-prepare`

## Remotes

Убедись что remotes настроены:
- `origin` → `wargoblin/Fresco` (форк)
- `upstream` → `AufarZakiev/Fresco` (оригинал)

Если не так — исправь через `git remote set-url`.

## Шаги

### 1. Синхронизируй форк с upstream

```bash
git fetch upstream
git checkout master
git merge upstream/master --ff-only
git push origin master
```

Если fast-forward merge невозможен — **остановись** и сообщи пользователю.

### 2. Rebase рабочей ветки

```bash
git checkout <рабочая-ветка>
git rebase master
```

Если текущая ветка — `master`: сообщи что нужно сначала создать feature-ветку.
Если конфликты — **остановись**, покажи список файлов с конфликтами, спроси как разрешить. НЕ разрешай сам.

### 3. Squash коммитов

Сжать все коммиты ветки в один для линейной истории (один PR = один коммит):

```bash
git reset --soft master
git commit -m "<conventional-commit-сообщение>"
```

Сообщение коммита — то же, что будет в заголовке PR (conventional commit, до 70 символов).

### 4. Self-check

Прежде чем пушить — убедись:

1. Прочитай `CLAUDE.md` — правила проекта
2. Вспомни задачу: всё ли реализовано? нет ли лишнего?
3. Нет ли очевидных проблем: неиспользуемых импортов, захардкоженных значений, незакрытых TODO?
4. Запусти проверки (тот же набор, что в `.githooks/pre-commit`):
```bash
pnpm lint && pnpm exec vue-tsc --noEmit && pnpm test
```
Если что-то упало — исправь и повтори. Не пушь пока все три команды не пройдут.

**Убедись что `core.hooksPath` указывает на `.githooks`:**
```bash
git config core.hooksPath .githooks
```

### 5. Push в форк

```bash
git push origin <рабочая-ветка> -u --force-with-lease
```

`--force-with-lease` нужен потому что squash перезаписал историю.

### 6. Проверь наличие открытого upstream PR

**Сразу после push** проверь, есть ли уже открытый PR в upstream для этой ветки:

```bash
gh pr list --repo AufarZakiev/Fresco --head wargoblin:<рабочая-ветка> --state open --json number,title,url
```

**Если PR существует** — force-push автоматически триггерит новый Copilot review.
В этом случае **обязательно**:
1. Сначала проверь **необработанные** комментарии Copilot (от предыдущих review):
```bash
# Все комментарии Copilot
gh api "repos/AufarZakiev/Fresco/pulls/<номер>/comments" \
  --jq '.[] | select(.user.login == "Copilot") | {id: .id, path: .path, line: .line, body: .body}'
# Все ответы (чтобы определить, на какие комментарии уже есть reply)
gh api "repos/AufarZakiev/Fresco/pulls/<номер>/comments" \
  --jq '.[] | select(.in_reply_to_id != null) | .in_reply_to_id'
```
Комментарий **необработан**, если его `id` не встречается как `in_reply_to_id`. Обработай такие комментарии ПЕРЕД ожиданием нового review.

2. Перезапроси Copilot review:
```bash
gh pr edit <номер> --repo AufarZakiev/Fresco --add-reviewer copilot-pull-request-reviewer
```
3. Polling (60с × 10 попыток): жди ответа Copilot, проверяя каждые 60с. Если ответил раньше — не жди оставшиеся. Если не ответил за 10 минут — продолжай без ошибки. Проверяй новые комментарии — по той же логике (ищи необработанные, не фильтруй по дате)
4. Обработай все новые комментарии, повтори цикл при необходимости

**Это НЕ опционально.** Push в ветку с открытым PR = обязательная обработка review.

**Если PR не существует** — переходи к "Результат".

## Результат

Сообщи пользователю:
- Ветка
- Сообщение коммита
- Результат проверок (lint / type-check / tests)
- Если был открытый upstream PR — результат обработки Copilot review
- Следующий шаг: `/pr-review` для Codex review, или `/pr-submit` чтобы отправить в upstream

## Правила

- Если нет незакоммиченных изменений и нет разницы с master — сообщи что нечего отправлять
- Если текущая ветка — `master` — не продолжай, попроси создать feature-ветку
- **Push в ветку с открытым upstream PR = обработка Copilot review.** Нельзя запушить и уйти
