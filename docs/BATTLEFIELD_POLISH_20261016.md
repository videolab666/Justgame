# Battlefield visuals and close-range combat — 2026-10-16

## Assets
27 original vector character drawings redone; individual silhouettes, distinctive props, headwear, poses and colors. See CHARACTER_VISUAL_IDENTITY.md. No external stock artwork.

## Field and effects
Four themed terrain SVGs with perimeter decorations; fixed 9×5 grid aspect ratio 2:1; visible house safe boundary and color-coded enemy class frames. Live danger lanes and house-side warning lamps, with no layout shifts. Visible stamp splash, slowing ice burst, document hit, shield impact, boss immunity flash and weapon trails. Reduced Motion is supported.

## Root cause of intermittent registrar firing
A front-lane target previously had to exceed defender column + 0.45 to be chosen. Enemy jumps and collision movement may leave an attacker in front of a defender but closer than this cutoff. Result: idle defender with an attacking foe. The new target check permits front contact from column + 0.02; a shot launches to the left of its actual target at min(column + 0.4, targetX - 0.22), then the existing swept intersection detects the hit. Existing restrictions on fog, concealed enemies, flying enemies, underground foes and disabling abilities remain intact; feedback icons explain these states.

## Validation
Node regression tests for close-range hits, effect feedback, fog and targeting. XML validation for all original SVGs. Headless browser tests for fixed battlefield size during live battle and a gallery of all 27 redesigned characters.
