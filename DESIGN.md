# Design direction

## World

An instrument bench at dusk: dark green-black surfaces, workbench notes, and a single acid-lime status signal. The model is the object under inspection, not a decorative hero image.

## Type

- Display and interface voice: Space Grotesk, compact and slightly technical without turning the whole UI into a code editor.
- Measurement and metadata voice: DM Mono for values, IDs, and small system labels.

## Palette

- `--bg`: `#0b0e0d`
- `--panel`: `#101513`
- `--ink`: `#f3f8ee`
- `--muted`: `#9aa89d`
- `--lime`: `#d8ff63`
- `--mint`: `#9ce9d5`
- `--amber`: `#f4b461`
- `--red`: `#ff7167`

## Composition

The first viewport uses a two-column bench layout: the model gets the larger left field while the right inspector explains the signal and exposes controls. The panel uses thin rules and open rows so it reads as notes at a workbench rather than a stack of generic cards.

## Signature interaction

Clicking a component in the model or inspector focuses it in the camera, moves the selected outline, and updates the part note. The LEDs pulse out of phase while the live signal is running.
