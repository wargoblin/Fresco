---
description: "Review в форке: simple=Codex, medium/max=Codex+Claude"
user-invocable: true
disable-model-invocation: true
---

# PR Review — fork review level

Создаёт draft PR в форке, вызывает Codex всегда и Claude только для medium/max, обрабатывает комментарии в цикле, закрывает PR.

**Вызов:** `/pr-review`

**Prerequisite:** ветка должна быть запушена в форк (через `/pr-prepare` или вручную).

## Review levels

- `simple` или без аргумента: Codex internal review only.
- `medium` / `claude`: Codex + Claude internal review.
- `max` / `ultra` / `ultrareview`: same as medium for this phase; ultrareview happens later in `pr-submit`.
- Если указано несколько aliases, выбирай самый сильный уровень: `max` > `medium` > `simple`.

## Шаги

### 1. Создай review PR в форке

```bash
gh pr create \
  --repo wargoblin/Fresco \
  --head wargoblin:<рабочая-ветка> \
  --base master \
  --title "[Review] <заголовок>" \
  --body "Internal review PR before submitting upstream." \
  --draft
```

Запомни номер этого PR.

### 2. Вызови selected reviewers

Определи уровень один раз:

```bash
REVIEW_LEVEL=simple
if printf '%s\n' "$ARGUMENTS" | rg -qi '\b(max|ultra|ultrareview)\b'; then
  REVIEW_LEVEL=max
elif printf '%s\n' "$ARGUMENTS" | rg -qi '\b(medium|claude)\b'; then
  REVIEW_LEVEL=medium
fi
```

```bash
gh pr comment <review-pr-номер> --repo wargoblin/Fresco --body "@codex /review"
if [ "$REVIEW_LEVEL" != "simple" ]; then
  gh pr comment <review-pr-номер> --repo wargoblin/Fresco --body "@claude review once

Focus on actionable correctness, security, regression, and explicit Fresco project-rule issues introduced by this PR. Avoid style-only feedback unless it reflects an explicit repo rule."
fi
```

`@claude review once` должен быть первой строкой top-level PR comment. Если review level simple — не зови и не трекай Claude. Если Claude Code Review выбран, но не настроен для `wargoblin/Fresco`, зафиксируй `CLAUDE_AVAILABLE=0` и продолжай с Codex.

### 3. Ожидание и проверка

**Bounded polling loop:** опрашивай каждые 60 секунд, до 10 попыток. Если reviewer ответил на 1-й минуте — не жди оставшиеся. Если не ответил за 10 минут — продолжай без ошибки.

```bash
for attempt in $(seq 1 10); do
  sleep 60
  # проверь каналы Codex и выбранного Claude ниже
  # если все выбранные reviewer'ы ответили → break
done
```

**Codex использует ТРИ канала ответа — проверяй ВСЕ:**

1. **Reviews** — формальный вердикт (Codex постит основной review сюда):
```bash
gh api "repos/wargoblin/Fresco/pulls/<review-pr-номер>/reviews" \
  --jq '.[] | select(.user.login == "chatgpt-codex-connector[bot]") | {id: .id, state: .state, body: .body}'
```

2. **Inline PR comments** — конкретные замечания к коду:
```bash
gh api "repos/wargoblin/Fresco/pulls/<review-pr-номер>/comments" \
  --jq '.[] | select(.user.login == "chatgpt-codex-connector[bot]") | {id: .id, path: .path, line: .line, body: .body}'
```

3. **Issue comments** — fallback (некоторые версии Codex могут ответить сюда):
```bash
gh api "repos/wargoblin/Fresco/issues/<review-pr-номер>/comments" \
  --jq '.[] | select(.user.login == "chatgpt-codex-connector[bot]") | {id: .id, body: .body}'
```

**Claude использует comments/reviews/inline comments и check run — проверяй ВСЕ, но только для medium/max:**

```bash
gh api "repos/wargoblin/Fresco/issues/<review-pr-номер>/comments" \
  --jq '.[] | select(.user.login | test("claude"; "i")) | {id: .id, body: .body}'

gh api "repos/wargoblin/Fresco/pulls/<review-pr-номер>/reviews" \
  --jq '.[] | select(.user.login | test("claude"; "i")) | {id: .id, state: .state, body: .body}'

gh api "repos/wargoblin/Fresco/pulls/<review-pr-номер>/comments" \
  --jq '.[] | select(.user.login | test("claude"; "i")) | {id: .id, path: .path, line: .line, body: .body}'

gh pr view <review-pr-номер> --repo wargoblin/Fresco --json statusCheckRollup \
  --jq '.statusCheckRollup[]? | select((.name // "" | test("Claude"; "i")) or (.workflowName // "" | test("Claude"; "i"))) | {name,status,conclusion,detailsUrl}'
```

Если Claude выбран уровнем, но за окно ожидания не появился ни comment, ни review, ни inline comment, ни check run, зафиксируй `CLAUDE_AVAILABLE=0` и продолжай с Codex. Это не должно ломать Fresco pipeline.

**Определение результата:**
- Если review появился (state "COMMENTED") и inline comments пусты → **review passed**, переходи к шагу 5
- Если issue comment содержит "Didn't find any major issues" и inline comments пусты → **review passed**, переходи к шагу 5
- Если есть inline comments → **есть замечания**, переходи к шагу 4

### 4. Обработка комментариев (до 10 итераций)

**Запомни ID обработанных комментариев**, чтобы не обрабатывать их повторно.

Для каждого нового комментария от `chatgpt-codex-connector[bot]`, а в medium/max ещё от Claude и из `Claude Code Review` check run:

**Валидно → исправляем:**
- Баг, уязвимость, ошибка логики
- Реальный side effect в других частях кода
- Нарушение стиля проекта (паттерны из кодовой базы)
- Отсутствие обработки ошибок на системной границе

```bash
# Исправить код, затем:
git add <файлы>
git commit -m "fix: <описание>"
git push origin <рабочая-ветка>
gh pr comment <review-pr-номер> --repo wargoblin/Fresco --body "Fixed: <что изменено и почему>"
```

Сообщи пользователю: что было → почему исправили.

**Не валидно → отклоняем:**
- Субъективное мнение без технического обоснования
- Over-engineering для задачи текущего масштаба
- Противоречит архитектуре проекта
- Предложение уже реализовано в кодовой базе иначе — намеренно

```bash
gh pr comment <review-pr-номер> --repo wargoblin/Fresco --body "Declined: <причина>"
```

Сообщи пользователю: что было → почему отклонили.

**После каждого push** — запомни baseline counts для всех выбранных каналов до re-request, снова polling (60с × 10 попыток) и считай новыми только artifacts/comments с count выше baseline. Для medium/max повторно оставь top-level comment:

```bash
if [ "$REVIEW_LEVEL" != "simple" ]; then
  gh pr comment <review-pr-номер> --repo wargoblin/Fresco --body "@claude review once

Re-review after fixes. Focus only on remaining actionable correctness, security, regression, and explicit Fresco project-rule issues."
fi
```

**Условия выхода из цикла:**
- Review state "COMMENTED" без inline comments
- Или issue comment содержит "Didn't find any major issues"
- Нет новых inline comments с ID, которых нет в списке обработанных
- Claude Code Review skipped by level, clean, или не настроен (`CLAUDE_AVAILABLE=0`)
- Достигнут лимит 10 итераций

### 5. Отчёт и закрытие

```markdown
### Итог Code Review
- **Итераций:** N
- **Исправлено:** M комментариев
- **Отклонено:** K комментариев
- **Claude:** clean / findings fixed / unavailable
- **Статус:** готово к отправке в upstream / требует внимания
```

```bash
gh pr close <review-pr-номер> --repo wargoblin/Fresco --delete-branch=false
```

Следующий шаг: `/pr-submit` для отправки в upstream.
