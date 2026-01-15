# Analysis: Effect-TS Patterns Skill

## Impact: HIGH
## Effort: MEDIUM
## Verdict: IMPLEMENT

## Summary

Created new skill documenting Effect-TS patterns specific to Nuclom. This is critical because Effect-TS is the foundation of our API layer and has many subtle patterns that are easy to get wrong.

## What Was Created

`/.claude/skills/effect-ts-patterns/SKILL.md` containing:
- Quick reference API route template
- Core patterns (Effect.gen, TaggedError, catchTag, repositories)
- Common pitfalls with ❌/✅ examples
- API route checklist
- Service pattern documentation

## Why This Matters

Effect-TS has a steep learning curve and many footguns:
- `await` inside `Effect.gen` silently breaks
- Forgetting layers causes runtime errors
- Direct `db` access bypasses error handling
- Wrong error handling patterns cause type errors

This skill captures institutional knowledge about how to use Effect-TS correctly in Nuclom.

## Expected Impact

| Scenario | Without Skill | With Skill |
|----------|---------------|------------|
| New API route | Trial and error | Copy pattern |
| Error handling | Wrong pattern | Correct pattern |
| Service creation | Guesswork | Template available |
| Debugging | Hours | Minutes (checklist) |

## Recommendation

**IMPLEMENT** - This encodes critical domain knowledge that would otherwise be lost in documentation or tribal knowledge.
