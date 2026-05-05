---
description: "Позвать мейнтейнера на ревью upstream PR"
user-invocable: true
disable-model-invocation: true
---

# PR Notify — приглашение мейнтейнера на ревью

Запрашивает ревью у мейнтейнера и оставляет вежливый комментарий к upstream PR.

**Вызов:** `/pr-notify`

**Prerequisite:** upstream PR должен существовать и пройти автоматические проверки выбранного уровня: simple = Copilot, medium = Copilot + Claude, max = Copilot + Claude + ultrareview status из `/pr-submit`.

## Шаги

### 1. Найди upstream PR

```bash
gh pr list --repo AufarZakiev/Fresco --head wargoblin:<рабочая-ветка> --state open --json number,title,url
```

Если PR не найден — сообщи пользователю и **остановись**.

### 2. Pre-flight checklist

Перед вызовом мейнтейнера убедись что всё в порядке. Проверь каждый пункт и собери результат в чек-лист:

```bash
# 1. Ветка ребейзнута на свежий master?
git fetch upstream
git log --oneline upstream/master..<рабочая-ветка> | head -1  # должен быть ровно 1 коммит
git merge-base --is-ancestor upstream/master <рабочая-ветка> && echo "OK: rebased" || echo "FAIL: not rebased"

# 2. Lint чисто?
pnpm lint

# 3. Type-check чисто?
pnpm exec vue-tsc --noEmit

# 4. Тесты проходят?
pnpm test

# 5. Нет необработанных комментариев selected reviewers?
gh api "repos/AufarZakiev/Fresco/pulls/<номер>/comments" \
  --jq '.[] | select(.user.login == "Copilot") | .id' > /tmp/copilot_ids.txt
gh api "repos/AufarZakiev/Fresco/pulls/<номер>/comments" \
  --jq '.[] | select(.in_reply_to_id != null) | .in_reply_to_id' > /tmp/replied_ids.txt
comm -23 <(sort /tmp/copilot_ids.txt) <(sort /tmp/replied_ids.txt)  # должно быть пусто

# Если medium/max: нет необработанных inline comments Claude?
gh api "repos/AufarZakiev/Fresco/pulls/<номер>/comments" \
  --jq '.[] | select(.user.login | test("claude"; "i")) | .id' > /tmp/claude_ids.txt
comm -23 <(sort /tmp/claude_ids.txt) <(sort /tmp/replied_ids.txt)  # должно быть пусто для medium/max

# 6. PR body заполнен (Summary + Test plan)?
gh pr view <номер> --repo AufarZakiev/Fresco --json body --jq '.body'
```

**Собери результат в чек-лист и покажи пользователю:**

```
Pre-flight checklist:
  [x] Rebased on upstream/master (1 squashed commit)
  [x] Lint passed
  [x] Type-check passed
  [x] Tests passed (N tests)
  [x] No unresolved selected reviewer comments
  [x] Ultrareview status checked (max only)
  [x] PR body has Summary + Test plan
```

**Если любой пункт FAIL:**
- Сообщи пользователю что именно не прошло
- Предложи исправить (`/pr-prepare` для rebase/squash, ручные правки для остального)
- **Не зови мейнтейнера** пока все пункты не пройдут

### 3. Покажи чек-лист пользователю

Покажи собранный чек-лист пользователю. Если все пункты зелёные — переходи дальше без подтверждения. Останавливайся и спрашивай только если что-то FAIL.

### 4. Собери контекст для комментария

Перед написанием комментария изучи:

1. **Diff PR** — что именно меняется:
```bash
gh pr diff <номер> --repo AufarZakiev/Fresco
```

2. **Контекст проекта** — прочитай `CLAUDE.md` и ключевые файлы, которых касается PR, чтобы понять архитектурные решения мейнтейнера.

3. **Историю PR** — предыдущие PR мейнтейнера, паттерны кодовой базы, чтобы найти, за что можно искренне похвалить (архитектуру, API-дизайн, DX, тесты, документацию и т.д.).

### 5. Запроси ревью у мейнтейнера

```bash
gh pr edit <номер> --repo AufarZakiev/Fresco --add-reviewer AufarZakiev
```

### 6. Оставь комментарий

Напиши комментарий к PR со следующей структурой:

```bash
gh pr comment <номер> --repo AufarZakiev/Fresco --body "<комментарий>"
```

**Структура комментария:**

1. **Приветствие + похвала** (если есть за что) — короткое обращение с конкретным комплиментом про кодовую базу. Не общие фразы вроде "great project", а что-то конкретное (удачная абстракция, чистый API, продуманная структура и т.д.). Если не за что — просто приветствие.
2. **Краткое описание** — что делает PR и почему, в 1-2 предложениях (детали уже в body PR)
3. **Чек-лист проверок** — покажи что было сделано перед отправкой:

```markdown
**Pre-submit checklist:**
- [x] Rebased on latest `master`
- [x] Lint clean
- [x] Type-check clean (`vue-tsc --noEmit`)
- [x] Tests passing (N tests)
- [x] Codex review — M comments addressed ([review PR](ссылка-на-draft-PR-в-форке))
- [x] Copilot review — K comments addressed
- [x] Claude Code Review — K comments addressed (medium/max only)
- [x] Claude ultrareview — findings addressed/declined (max only)
```

**Ссылки:**
- **Codex review** — ссылка на закрытый draft PR в форке (`wargoblin/Fresco`), где проходил review. Найди его:
```bash
gh pr list --repo wargoblin/Fresco --head <рабочая-ветка> --state closed --json number,url --jq '.[0].url'
```
- **Copilot review** — комментарии Copilot видны прямо в текущем upstream PR, отдельная ссылка не нужна
- **Claude Code Review** — comments/reviews/checks видны в текущем upstream PR; указывай только если запускался medium/max.
- **Claude ultrareview** — добавляй только для max и ссылайся на report/session URL, если CLI его вернул; иначе укажи краткий статус из `/pr-submit`.

Количество комментариев указывай реальное. Если комментариев не было — пиши "no issues found". Если какой-то review не запускался — пропусти этот пункт.

4. **Готовность к правкам** — что открыт к замечаниям и готов доработать

**Тон:**
- Уважительный, но не подобострастный
- Конкретный, не generic
- На английском (мейнтейнер общается на английском в GitHub)

**Пример хорошего комментария:**
> Hey! Really enjoyed working with the composables architecture here — the separation between UI state and OS integration is clean and easy to extend.
>
> This PR adds keyboard navigation support for the sidebar.
>
> **Pre-submit checklist:**
> - [x] Rebased on latest `master`
> - [x] Lint clean
> - [x] Type-check clean (`vue-tsc --noEmit`)
> - [x] Tests passing (42 tests)
> - [x] Codex review — 2 comments addressed ([review PR](https://github.com/wargoblin/Fresco/pull/5))
> - [x] Copilot review — no issues found
>
> Happy to adjust anything based on your feedback!

**Пример плохого комментария (НЕ делай так):**
> Hello! Your project is amazing and wonderful! I made some small changes, hope you like them! Please review when you have time, thank you so much!!!

## Результат

Сообщи пользователю:
- URL PR
- Что ревью запрошен у мейнтейнера
- Текст оставленного комментария

## Правила

- **Похвала должна быть искренней** — если не нашёл ничего конкретного, лучше пропустить, чем писать дежурный комплимент
- **Чек-лист — часть комментария** — мейнтейнер должен видеть что проверки пройдены
- **Комментарий на английском** — язык коммуникации в upstream
- **Один комментарий** — не спамь. Если комментарий уже оставлен ранее, не дублируй
