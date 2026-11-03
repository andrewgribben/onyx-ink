# CLAUDE.md

@AGENTS.md

All project instructions are in `AGENTS.md`, and the product spec is in `SPEC.md`. Read both before working.

Claude-specific notes:
- Use plan mode for each milestone: draft the plan against SPEC section 7, then implement.
- Prefer subagents for broad codebase searches in `plugin/src` (about 21k lines). Read `input.ts`, `tools.ts` and `surface.ts` directly.
- After changes in `plugin/`, run `npm run check`. After changes in `companion/`, run `./gradlew assembleDebug`, and run `installDebug` too if a Boox is connected.
