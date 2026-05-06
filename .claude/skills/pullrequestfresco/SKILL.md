---
description: "Полный PR pipeline: prepare → review levels → submit → notify"
user-invocable: true
disable-model-invocation: true
---

# Pull Request — полный pipeline

Выполняет все четыре фазы PR workflow последовательно:

1. **`/pr-prepare`** — sync, rebase, squash, self-check, push
2. **`/pr-review`** — review loop в форке по выбранному уровню
3. **`/pr-submit`** — cross-fork PR в upstream + review loop по выбранному уровню
4. **`/pr-notify`** — позвать мейнтейнера на ревью

**Вызов:** `/pullrequestfresco` или `/pullrequestfresco wait`

## Режимы

| Режим | Вызов | Поведение |
|-------|-------|-----------|
| **Auto (default)** | `/pullrequestfresco` | Создаёт upstream PR автоматически после review |
| **Wait** | `/pullrequestfresco wait` | Спрашивает подтверждение перед отправкой в upstream |
| **Medium** | `/pullrequestfresco medium` или `/pullrequestfresco claude` | Добавляет Claude Code Review |
| **Max** | `/pullrequestfresco max`, `/pullrequestfresco ultra`, `/pullrequestfresco ultrareview` | Добавляет Claude ultrareview в submit-фазе |

**Arguments:** `$ARGUMENTS`
- Если `$ARGUMENTS` содержит `"wait"` → передать wait mode в фазу submit
- Если `$ARGUMENTS` содержит `"medium"` или `"claude"` → medium: `pr-review` = Codex + Claude, `pr-submit` = Copilot + Claude
- Если `$ARGUMENTS` содержит `"max"`, `"ultrareview"` или `"ultra"` → max: medium + `claude ultrareview <upstream-pr-номер>` в submit-фазе
- Иначе → auto mode
- Если указано несколько level aliases, применяй самый сильный уровень: `max` > `medium` > `simple`

## Review levels

**Simple (default):**
- `pr-review`: Codex internal review only.
- `pr-submit`: Copilot upstream review only.

**Medium:**
- `pr-review`: Codex + Claude internal review.
- `pr-submit`: Copilot + Claude upstream review.

**Max:**
- Same as medium, plus `claude ultrareview <upstream-pr-номер>` in `pr-submit`.
- Не меняет правило upstream merge: Fresco PR не мержится автоматически.
- Блокирует `pr-notify`, пока `pr-submit` не отчитается по ultrareview и его actionable findings не обработаны или явно отклонены.

## Workflow

Выполни последовательно все шаги из четырёх фазовых скиллов:

### Фаза 1: Prepare
Следуй инструкциям из `.claude/skills/pr-prepare/SKILL.md`.
Если фаза завершилась ошибкой (конфликты, нечего коммитить) — **остановись**.

### Фаза 2: Review
Следуй инструкциям из `.claude/skills/pr-review/SKILL.md`.
Передай `medium`/`claude`/`max`/`ultra`/`ultrareview`, если они были указаны.
Если review выявил проблемы, которые не удалось исправить за 10 итераций — сообщи пользователю и **остановись**.

### Фаза 3: Submit
Следуй инструкциям из `.claude/skills/pr-submit/SKILL.md`.
Передай wait mode и review level args (`medium`, `claude`, `max`, `ultra`, `ultrareview`) если они были указаны.

### Фаза 4: Notify
Следуй инструкциям из `.claude/skills/pr-notify/SKILL.md`.
Переходи сюда только после отчёта `pr-submit`: выбранные reviewers обработаны, а для max ещё есть явный статус ultrareview.
Позови мейнтейнера на ревью с вежливым комментарием.

## Когда использовать отдельные фазы

| Ситуация | Что вызвать |
|----------|-------------|
| Полный цикл с нуля | `/pullrequestfresco` |
| Ветка уже готова, нужен только review | `/pr-review` |
| Review пройден, нужно отправить в upstream | `/pr-submit` |
| Есть открытый PR с комментариями Copilot | `/pr-submit` (обнаружит существующий PR и обработает комментарии) |
| Нужно только подготовить ветку | `/pr-prepare` |
| PR в upstream готов, позвать мейнтейнера | `/pr-notify` |
