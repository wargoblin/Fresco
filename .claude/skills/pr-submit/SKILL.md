---
description: "Создать cross-fork PR в upstream: simple=Copilot, medium/max=Copilot+Claude, max=ultrareview"
user-invocable: true
disable-model-invocation: true
---

# PR Submit — отправка в upstream

Создаёт cross-fork PR из `wargoblin/Fresco` в `AufarZakiev/Fresco`, запрашивает Copilot всегда и Claude только для medium/max. По max-аргументу запускает `claude ultrareview`.

**Вызов:** `/pr-submit` или `/pr-submit wait`

**Prerequisite:** ветка должна быть запушена в форк (через `/pr-prepare` или вручную).

## Режимы

| Режим | Вызов | Поведение |
|-------|-------|-----------|
| **Auto (default)** | `/pr-submit` | Создаёт PR сразу |
| **Wait** | `/pr-submit wait` | Спрашивает подтверждение перед созданием |
| **Medium** | `/pr-submit medium` или `/pr-submit claude` | Добавляет Claude Code Review |
| **Max** | `/pr-submit max`, `/pr-submit ultra`, `/pr-submit ultrareview` | Добавляет Claude ultrareview |

**Arguments:** `$ARGUMENTS`
- Если `$ARGUMENTS` содержит `"wait"` → показать summary и спросить пользователя
- Если `$ARGUMENTS` содержит `"medium"` или `"claude"` → добавить Claude Code Review
- Если `$ARGUMENTS` содержит `"max"`, `"ultra"` или `"ultrareview"` → добавить Claude Code Review + ultrareview
- Иначе → создать PR сразу
- Если указано несколько level aliases, применяй самый сильный уровень: `max` > `medium` > `simple`

## Review levels

**Simple (default):**
- Upstream review: Copilot only.

**Medium:**
- Upstream review: Copilot + Claude Code Review.

**Max:**
- Upstream review: Copilot + Claude Code Review.
- One `claude ultrareview <upstream-pr-номер>` run for this invocation.
- Не мержит upstream PR и не зовёт мейнтейнера, пока ultrareview findings не обработаны или явно отклонены.

## Шаги

### 1. Проверь наличие открытых upstream PR для этой ветки

```bash
gh pr list --repo AufarZakiev/Fresco --head wargoblin:<рабочая-ветка> --state open --json number,title,url
```

**Если PR уже существует:**
1. **Не создавай новый** — используй существующий
2. **Запроси свежий Copilot и выбранный Claude review** (шаг 3) — даже если предыдущий review уже есть, после push нужен новый
3. **Жди и обработай** комментарии/check findings выбранных reviewers (шаги 4-5) — включая старые необработанные
4. Переходи к шагу 3, пропуская шаг 2

**Как найти необработанные комментарии:** НЕ фильтруй по дате — это ненадёжно (комментарии между push'ами теряются). Вместо этого ищи комментарии Copilot, на которые нет ответа:

```bash
# Получи все комментарии Copilot
gh api "repos/AufarZakiev/Fresco/pulls/<номер>/comments" \
  --jq '.[] | select(.user.login == "Copilot") | {id: .id, path: .path, line: .line, body: .body, in_reply_to_id: .in_reply_to_id}'

# Получи все ответы (от любого пользователя)
gh api "repos/AufarZakiev/Fresco/pulls/<номер>/comments" \
  --jq '.[] | select(.in_reply_to_id != null) | .in_reply_to_id'
```

Комментарий Copilot считается **необработанным**, если его `id` НЕ встречается как `in_reply_to_id` ни в одном другом комментарии. Обрабатывай ВСЕ такие комментарии.

### 2. Создай cross-fork PR

**Если wait mode ON:** покажи diff summary и спроси: «Отправить PR в upstream?»

```bash
gh pr create \
  --repo AufarZakiev/Fresco \
  --head wargoblin:<рабочая-ветка> \
  --base master \
  --title "<conventional-commit-заголовок до 70 символов>" \
  --body "$(cat <<'EOF'
## Summary
- <bullet 1>
- <bullet 2>

## Test plan
- [ ] <шаг проверки 1>
- [ ] <шаг проверки 2>

Reviewed before submission.
EOF
)"
```

### 3. Запроси selected review

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
gh pr edit <upstream-pr-номер> --repo AufarZakiev/Fresco --add-reviewer copilot-pull-request-reviewer
if [ "$REVIEW_LEVEL" != "simple" ]; then
  gh pr comment <upstream-pr-номер> --repo AufarZakiev/Fresco --body "@claude review once

Focus on actionable correctness, security, regression, and explicit Fresco project-rule issues introduced by this PR. Avoid style-only feedback unless it reflects an explicit repo rule."
fi
```

Если не сработало — попробуй через API:

```bash
gh api repos/AufarZakiev/Fresco/pulls/<upstream-pr-номер>/requested_reviewers \
  -f "reviewers[]=copilot-pull-request-reviewer" 2>&1 || true
```

Если Copilot request вернул ошибку, попробуй один раз через API. Если после этого нет review/comment от Copilot в окно ожидания, зафиксируй `COPILOT_AVAILABLE=0` в отчёте и продолжай. Если выбранный Claude не настроен в upstream или не дал ни comment/review/inline/check run за окно ожидания, зафиксируй `CLAUDE_AVAILABLE=0` и продолжай.

**Claude ultrareview** — только если `REVIEW_LEVEL=max`:

```bash
if [ "$REVIEW_LEVEL" = "max" ]; then
  claude ultrareview <upstream-pr-номер> --timeout 30
fi
```

Запусти ultrareview только один раз за один `/pr-submit max` invocation. Если `claude ultrareview <номер>` не может сопоставить номер с upstream PR из текущего checkout, сообщи пользователю и не подменяй это обычным review. Ultrareview платный/квотируемый и должен запускаться только явно. До `/pr-notify` обработай или явно отклони actionable findings из ultrareview и покажи статус пользователю.

### 4. Дождись selected review

Не запускай локальный blocking `sleep`/`gh api` loop. Для каждого выбранного reviewer используй `/wait-bot-review` или Monitor-backed equivalent; ожидание должно завершаться при первом сигнале reviewer'а или по timeout.

```text
/wait-bot-review AufarZakiev/Fresco <upstream-pr-номер> copilot-pull-request-reviewer[bot] 30m
/wait-bot-review AufarZakiev/Fresco <upstream-pr-номер> Copilot 30m

# medium/max only:
/wait-bot-review AufarZakiev/Fresco <upstream-pr-номер> claude 30m
```

Если доступная реализация `/wait-bot-review` поддерживает только exact issue-comment/review logins, для Copilot inline comments (`Copilot`) и Claude regex/check-run каналов используй Monitor-backed equivalent. Не возвращайся к локальному blocking loop.

После notification/timeout проверь каналы ниже. Если выбранный reviewer не ответил в timeout, зафиксируй unavailable и продолжай без ошибки.

**Copilot использует два username — проверяй ОБА:**

1. **Reviews** (вердикт):
```bash
gh api "repos/AufarZakiev/Fresco/pulls/<номер>/reviews" \
  --jq '.[] | select(.user.login == "copilot-pull-request-reviewer[bot]") | {id: .id, state: .state, body: .body}'
```

2. **Inline PR comments** (замечания к коду):
```bash
gh api "repos/AufarZakiev/Fresco/pulls/<номер>/comments" \
  --jq '.[] | select(.user.login == "Copilot") | {id: .id, path: .path, line: .line, body: .body}'
```

**Определение результата:**
- review state = "COMMENTED" и inline comments пусты → Copilot не нашёл проблем
- Есть inline comments от `Copilot` → есть замечания

**Claude использует comments/reviews/inline comments и check run — проверяй ВСЕ, но только для medium/max:**

```bash
gh api "repos/AufarZakiev/Fresco/issues/<номер>/comments" \
  --jq '.[] | select(.user.login | test("claude"; "i")) | {id: .id, body: .body}'

gh api "repos/AufarZakiev/Fresco/pulls/<номер>/reviews" \
  --jq '.[] | select(.user.login | test("claude"; "i")) | {id: .id, state: .state, body: .body}'

gh api "repos/AufarZakiev/Fresco/pulls/<номер>/comments" \
  --jq '.[] | select(.user.login | test("claude"; "i")) | {id: .id, path: .path, line: .line, body: .body}'

gh pr view <номер> --repo AufarZakiev/Fresco --json statusCheckRollup \
  --jq '.statusCheckRollup[]? | select((.name // "" | test("Claude"; "i")) or (.workflowName // "" | test("Claude"; "i"))) | {name,status,conclusion,detailsUrl}'
```

### 5. Обработка комментариев selected reviewers

**Запомни ID обработанных комментариев**, чтобы не обрабатывать их повторно.

Для каждого inline comment от `Copilot`, а в medium/max ещё от Claude и каждой находки из `Claude Code Review` check run:
- **Валидно** → исправить, push, отчитаться пользователю
- **Не валидно** → объяснить пользователю почему отклонено
- **Уже исправлено** (stale comment на старый код) → пропустить, сообщить пользователю

**После каждого push** — перезапроси Copilot и выбранный Claude review (шаг 3), затем снова запусти `/wait-bot-review` / Monitor-backed wait (шаг 4).

Перед re-request после push запомни baseline counts по reviews, inline comments, issue comments и Claude check runs. После re-request считай новыми только artifacts/comments с count выше baseline, чтобы старые review comments не засчитывались как повторный результат. Ultrareview после fix-push автоматически не перезапускай; запускай снова только по явной просьбе пользователя.

## Результат

Покажи URL созданного upstream PR.

## Правила

- **Никогда не мержи** upstream PR — решение за мейнтейнером
- **Не создавай дубликат PR** — если PR для ветки уже открыт, работай с ним
- **После любого push** — всегда перезапрашивай Copilot review; Claude re-review только для medium/max
- **Запрос ревью != завершение задачи** — всегда жди результат и обрабатывай
