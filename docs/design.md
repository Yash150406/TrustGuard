# Design

Two directions, chosen by the owner on 2026-10-12 from three previews built on the same investigation result.

## App and website: Signal room

A control room for one question: how dangerous is this link, and why. The verdict sets the mood before anything is read.

- **Ground and panels.** Near-black ground. Content sits in two-layer panels: a faint outer tray (`panel-shell`) holding a solid inner surface (`panel-core`) with a 1px top highlight. Panels are laid out in a 12-column bento grid that collapses to one column under 860px.
- **One glow.** A single radial glow in the top left, tinted by the verdict (`data-risk` on the page wrapper: green, amber or red). It is fixed, so it never repaints on scroll. No other gradients.
- **Score.** A ring gauge with the number in light-weight Sora. The level name sits under it in the risk color. Confidence is a separate thin meter, never merged into the score.
- **Type.** Sora for display numbers and headings, Manrope for everything else, JetBrains Mono only for literal technical values (URLs, IPs, hashes, artifact IDs). Sentence case everywhere, no all-caps labels.
- **Color.** Neutrals carry the page. Green, amber and red mean SAFE, SUSPICIOUS and HIGH RISK and nothing else, so they are never used for decoration.
- **Buttons.** Primary actions are solid pills in the foreground color with the icon in its own small circle at the right edge.
- **Motion.** Only where it explains something: the gauge filling on load, panels opening, a result arriving. One spring curve (`--ease-spring`). Everything respects reduced motion.
- **Light theme.** Same system on cool grey with white panels, softer glow and darker risk colors for contrast.

### Tokens

Defined in `apps/web/src/app/globals.css` and exposed to Tailwind as `bg`, `shell`, `core`, `hair`, `fg`, `muted`, `safe`, `warn`, `high`, plus `font-display`, `font-sans`, `font-mono`, `rounded-shell`, `rounded-core`, `rounded-chip` and `ease-spring`.

| Token | Dark | Light |
|---|---|---|
| bg | `#07090d` | `#edf0f4` |
| core | `#0d1117` | `#ffffff` |
| fg | `#e9eef4` | `#0f1622` |
| muted | `#8a95a3` | `#5b6676` |
| safe | `#58d39a` | `#1e9460` |
| warn | `#f3b455` | `#b5730c` |
| high | `#ff6b5b` | `#d23a2c` |

### Investigation assistant panel

"Ask about this result" sits in the bento grid next to the redirect chain. Questions are right-aligned solid bubbles, answers are panel-tinted bubbles with source chips inline after each claim. Suggested questions sit above the input as outline pills. A line under the input says answers only use this investigation's evidence. Built in phase 11.

## PDF reports: Analyst report

A findings document someone can forward to a manager.

- Cool white paper, a 2px rule under the header line (investigation ID and time).
- A plain-language headline that states the finding ("A fake Northwind Bank login page, six days old"), the target URL in mono under it.
- A verdict seal (score and level in a ring, slightly rotated) next to a two-sentence verdict and the confidence note.
- Numbered findings with their point values, then the redirect chain, a sources table and recommended actions.
- Artifact ID and SHA-256 in the footer.
- Newsreader for headings, Public Sans for text.
