## What and why

<!-- What changes for the person using Tembrio, and why. Link the issue: Closes #… -->

## Screenshots

<!-- Before / after for every screen or state this touches (light and dark).
     Changed screenshot baselines count: say which and why they changed. -->

## Checks

<!-- Each as `check → result`. Delete lines that do not apply. -->

- `bun run test:unit` →
- `bun run test:playwright` →
- screenshot baselines (`bun run test:visual` or CI) →
- `cargo test --lib` →
- `bun run lint`, `bunx tsc --noEmit`, `bun run format:check` →

## Manual checklist

<!-- What machines cannot check. The reviewer ticks these on a real machine. -->

- [ ] Windows: sound plays / stops / pauses as described
- [ ] Windows: global hotkeys work from another app
- [ ] Windows: text is pasted into another app's field
- [ ] macOS (when the stage touches it)
