# Copilot Instructions

## Project Context

This project is to design and build a visulaisation of our offices 2026 World cup sweepstakes. The code must create repeatable visualisations showing the upcoming matches, current stage, various odds (both of teams and of individual sweepstake members).

## Starting a New Task

Before writing any code or making any changes, **always invoke the `start-new-task` skill** for any new work item. This skill enforces an exhaustive requirements-gathering process — no assumptions are allowed.

The skill workflow:
1. **Explore the full repo structure** before anything else
2. **Gather requirements exhaustively** via Q&A — ask about inputs, outputs, edge cases, error conditions, dependencies, and file/folder placement. Do not proceed until the user confirms nothing is left to clarify.
3. **Document the Q&A and implementation plan** in `.github/context/<task>.md` — Section 1 is the verbatim Q&A; Section 2 is an atomic, numbered checklist of implementation steps.
4. **Confirm code purpose** — ask whether this is production code or prototyping/ideation. For prototyping, TDD and extensive error handling can be relaxed. For production, follow all quality standards strictly.