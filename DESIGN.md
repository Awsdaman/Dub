---
name: دوبلاج
description: A party dubbing game styled as a late-night Arabic dubbing booth.
colors:
  booth-foam: "#151413"
  booth-shadow: "#0a0908"
  desk-metal: "#1e1d1b"
  desk-metal-hi: "#2e2c29"
  key-rubber: "#2c2a27"
  studio-ink: "#efebe2"
  studio-ink-dim: "#a39c90"
  on-air-red: "#ff2a1f"
  record-red: "#d9271c"
  applause-amber: "#ffb21f"
  go-yellow: "#f2c21a"
  led-green: "#4ee07a"
  celluloid: "#ece8dc"
  celluloid-ink: "#1b1814"
  masking-tape: "#e6d9b0"
  tape-ink: "#25211b"
  cue-paper: "#ebe5d6"
  wax-yellow: "#f5c518"
  wax-cyan: "#2fb5e8"
  wax-magenta: "#ec4e9c"
  wax-green: "#4cc66a"
  wax-orange: "#ff8a2b"
  wax-violet: "#a58bff"
  wax-red: "#f0503c"
  wax-white: "#e9e9e9"
typography:
  display:
    fontFamily: "Thmanyah Sans, system-ui, sans-serif"
    fontSize: "clamp(4.5rem, 9vw, 6rem)"
    fontWeight: 900
    lineHeight: 1
  headline:
    fontFamily: "Thmanyah Sans, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 4vw, 3.6rem)"
    fontWeight: 900
    lineHeight: 1
  title:
    fontFamily: "Thmanyah Sans, system-ui, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Thmanyah Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Thmanyah Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.4
  marker:
    fontFamily: "Marhey, Thmanyah Sans, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  pad: "0.6rem"
  monitor: "0.9rem"
  key: "1rem"
  desk: "1.2rem"
  key-big: "1.3rem"
spacing:
  gutter: "clamp(16px, 2.2vw, 40px)"
  tight: "0.7rem"
  group: "1.4rem"
  section: "2.4rem"
components:
  key:
    backgroundColor: "{colors.key-rubber}"
    textColor: "{colors.studio-ink}"
    rounded: "{rounded.key}"
    padding: "0.9rem 1.3rem 0.8rem"
  key-record:
    backgroundColor: "{colors.record-red}"
    textColor: "#ffffff"
    rounded: "{rounded.key-big}"
    padding: "1.3rem 2.4rem 1.1rem"
  key-go:
    backgroundColor: "{colors.go-yellow}"
    textColor: "#1a1206"
    rounded: "{rounded.key-big}"
    padding: "1.3rem 2.4rem 1.1rem"
  tape-label:
    backgroundColor: "{colors.masking-tape}"
    textColor: "{colors.tape-ink}"
    typography: "{typography.marker}"
    padding: "0.45rem 1.1rem 0.5rem"
  desk:
    backgroundColor: "{colors.desk-metal}"
    rounded: "{rounded.desk}"
    padding: "1.6rem"
  vote-pad:
    backgroundColor: "{colors.key-rubber}"
    textColor: "{colors.studio-ink-dim}"
    rounded: "{rounded.pad}"
    size: "2.4rem"
---

# Design System: دوبلاج

## Overview

**Creative North Star: "The Night Dubbing Booth"**

The whole game is one dark dubbing booth after hours. A wall of charcoal egg-crate foam surrounds a picture monitor, and under it runs the rhythmo band: an ivory celluloid strip that scrolls the characters' lines toward a red sync bar. Everything else is the gear you would find in that room: an ON AIR lamp, a needle VU meter, matte rubber transport keys, desk faders, and masking-tape labels written in marker.

It is built for a sofa audience watching one TV, so scale is generous and each screen has one obvious action. Light comes only from things that really emit it (the lamp, the LEDs, the monitor); every other surface is matte.

**Key Characteristics:**
- Dark, matte booth ground with real emissive light sources only
- The rhythmo band is the signature component; time runs right to left, matching Arabic reading
- Every player owns one wax-pencil color for the whole night
- Handwriting (Marhey) is reserved for things written by hand: tape labels, band lines, cue sheets
- Right-to-left layout throughout, Gulf-dialect copy

## Colors

A charcoal booth with ivory paper objects, two signal reds, and a fixed set of wax-pencil player colors.

### Primary
- **On-Air Red**: the ON AIR lamp when lit, the sync bar, the recording outline on the monitor, and the selected line in the editor. It means "live" or "now".
- **Record Red**: the fill of record and spin keys. It is a deeper sibling of On-Air Red, so a key never competes with the lamp.

### Secondary
- **Go Yellow**: the fill of the forward-moving key on each screen (start, watch, next, save).
- **Applause Amber**: the lamp's applause mode only, when a dub scores 8 or more and on the final screen.

### Tertiary
- **Wax pencils** (yellow, cyan, magenta, green, orange, violet, red, white): one per player, assigned in order and never reused while a player exists. A player's color marks their tape swatch, their selected tape, their vote pads, their credits line, and their swatch on the cue sheet.

### Neutral
- **Booth Foam**: the page ground, under an egg-crate foam texture.
- **Desk Metal** and **Desk Metal Highlight**: console panels (setup desk, mixer).
- **Key Rubber**: every resting key and vote pad.
- **Studio Ink** / **Studio Ink Dim**: primary and secondary text on dark surfaces (dim is still at least 4.5:1 on foam).
- **Celluloid** / **Celluloid Ink**: the rhythmo band and its writing.
- **Masking Tape** / **Tape Ink**: name labels, the title tape, toasts.
- **Cue Paper**: the scoreboard sheet and the editor's lines sheet.

### Named Rules
**The Real Light Rule.** Glow is allowed only on things that emit light: the ON AIR lamp, LEDs, and the recording monitor outline. Keys, panels and paper never glow.

**The One Color Per Player Rule.** A player's wax color is the only color that identifies them, everywhere. Never color a player by rank or state.

## Typography

**Display Font:** Thmanyah Sans (self-hosted, weights 400, 500, 700, 900)
**Body Font:** Thmanyah Sans
**Marker Font:** Marhey (handwriting only)

**Character:** Thmanyah Sans carries the studio's printed voice, heavy and clear from across a room; Marhey is the marker in someone's hand.

### Hierarchy
- **Display** (900, clamp(4.5rem, 9vw, 6rem), 1): the wordmark, the take number, credits head, countdown digits.
- **Headline** (900, clamp(2.4rem, 4vw, 3.6rem), 1): screen titles such as غرفة المونتاج.
- **Title** (700, 1.4rem): sheet headings (لوحة المدبلجين, النص والتوقيت).
- **Body** (400, 1rem, 1.55): hints and descriptions; root size scales with the screen (clamp(15px, 1.15vw, 24px)).
- **Label** (700, 1rem): section labels on desks and keys.
- **Marker** (700, 1.25rem and up): tape labels, the clip title tape, band lines, player names.

### Named Rules
**The Hand-Written Rule.** Marhey appears only where a person would have written with a marker: tape, band, cue sheets. Never on keys, labels or headings.

**The Tabular Counter Rule.** Every number that changes (take, scores, average, clip count) sits in a dark counter well with tabular digits and rolls digit by digit when it changes.

## Layout

The page is a single centered column, max 1800px, with a fluid gutter (clamp(16px, 2.2vw, 40px)). A sticky top rail holds the wordmark (start), the ON AIR lamp (center) and the take counter (end).

The booth uses a two-column grid: the monitor (about 60%) and a console column beside it (min 24rem), with the rhythmo band spanning the full window width below both. It is sized so the whole booth fits a 16:9 screen at 900px tall. Setup and home use two columns; under 900px everything stacks into one column, and the band stays full width.

Time-based controls run right to left: the band, the trim bar, and the ±1s transport keys (earlier on the right, later on the left).

## Elevation & Depth

Depth comes from soft, offset, blurred shadows: physical objects sitting on a desk under a ceiling lamp. There are no hard offset shadows and no specular bevels.

### Shadow Vocabulary
- **Key rest** (`box-shadow: 0 6px 14px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.7)`): resting keys; pressed keys drop 3px to `0 2px 5px rgba(0,0,0,.6)`.
- **Paper on desk** (`box-shadow: 0 18px 40px rgba(0,0,0,.6), 0 2px 4px rgba(0,0,0,.4)`): cue sheets, slightly rotated.
- **Tape** (`box-shadow: 0 3px 8px rgba(0,0,0,.45)`): tape labels and toasts.
- **Counter well** (`box-shadow: inset 0 2px 5px rgba(0,0,0,.9)`): recessed counters, the trim bar, switch tracks.

### Named Rules
**The Matte Rubber Rule.** Keys are a single flat tone with a soft drop shadow. No gradients imitating plastic or chrome.

## Shapes

Gear is softly rounded (keys 1rem, big keys 1.3rem, desks 1.2rem, monitor 0.9rem, pads 0.6rem). Paper and tape are square-cornered but never straight: cue sheets rotate about 1°, tapes alternate small rotations and have ragged masked ends. LEDs, swatches and the VU pivot are circles.

## Components

### Keys
- **Shape:** rounded rubber key (1rem; big keys 1.3rem), icon above its label, small LED dot in the top corner.
- **Resting:** Key Rubber with Studio Ink text; the LED is dark.
- **Lit:** the LED turns LED Green (for example, the replay key after a take).
- **Record / Spin:** Record Red fill; **Go:** Go Yellow fill with dark ink. Exactly one big key per screen.
- **Hover / Focus / Active:** brightness +12%; focus is a 3px Wax Yellow outline with 4px offset; pressed keys move down 3px.

### Tape Labels (chips)
- **Style:** masking tape with ragged ends, Marhey text, a wax-color swatch.
- **Selected:** the tape fills with the player's wax color, straightens, lifts 6px and shows a check.

### Desks and Sheets
- **Desk:** Desk Metal panel, 1.2rem corners, sections split by a 1px hairline.
- **Cue sheet:** Cue Paper with ruled lines and a strip of tape on top, rotated about 1°.

### Inputs
- **Name input:** a masking-tape strip you write on in Marhey; the focus outline is Wax Yellow.
- **Editor line inputs:** marker text on a dashed baseline; the baseline turns On-Air Red on focus.

### Rhythmo Band (signature)
An ivory celluloid strip with moving sprocket holes, second ticks, and a red sync bar at 70% of its width. Speech moments show as wax-yellow pills (red while recording); lines are written in Marhey, right-aligned at their start time, so the first word reaches the bar first. Before a take, three countdown wipes (٣ ٢ ١) and a green start mark roll into the bar. A line never draws past the next line's start; it shrinks, then clips.

### VU Meter
A cream meter face with a -20 to +3 scale, a red zone from 0 up, and a needle with roughly 300ms ballistics, driven by the mic.

### ON AIR Lamp
A dark red glass box at rest; lit red with a glow while recording (blinking during the countdown); amber "صفّقوا!" in applause mode.

### Trim Bar (editing room)
A recessed bar with 10% ticks. The kept scene is a Wax Yellow band between two yellow handles; the red playhead runs right to left.

## Do's and Don'ts

### Do:
- **Do** give each screen exactly one big key, in Record Red or Go Yellow.
- **Do** keep every time axis running right to left.
- **Do** roll every changing number in a counter well.
- **Do** keep a player's wax color identical on every screen.

### Don't:
- **Don't** add glow to anything that is not a light source.
- **Don't** use Marhey for UI labels, headings or keys.
- **Don't** use typed glyphs or emoji as icons; icons are drawn SVG with a 2px round stroke.
- **Don't** fake plastic or metal with gradient bevels.
- **Don't** add a small label above a heading (eyebrow); the heading speaks for itself.
