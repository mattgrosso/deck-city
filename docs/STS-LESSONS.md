# What Slay the Spire teaches us (and what we take)

Written 2026-10-29, before the TV rebuild. Matt: "go look at Slay the Spire
and Slay the Spire 2 as the pinnacle of how controller-based deck building
can work well … learn every lesson we can from how they built that and how it
looks … not just the controller interface: the layout, the way they represent
a hand of cards, the way they represent the game board, everything."

Sources: the games themselves (StS1 2019 console/controller build, StS2 early
access 2026, Godot focus system), the keyboard/controller bridge mod's keymap,
Mega Crit's 0.100/0.110 patch notes, player threads on controller targeting
and the "accidental end turn" complaint, the Cloudfall Studios UI notes, and
the stfj "designing for subway legibility" reads breakdown. Where a point is
my own reading of the game rather than something sourced, it says so.

## 1. The screen is one picture, read in a fixed order

StS never scrolls, never has a sidebar, never asks you to look in two places
for one decision. Every screen is one 16:9 picture with the same anchors:

| Zone | StS | Why it's there |
|---|---|---|
| Top strip | name, HP, gold, potions, relics; map and deck buttons at the far right | the slow-changing facts; you glance, you don't study |
| Middle | the fight: you on the left, enemies on the right, intents above them | the board, where the consequences happen |
| Bottom | the hand, fanned, centered, overlapping the bottom edge | the thing you are choosing from |
| Bottom-left | energy orb above the draw pile count | "what can I still do" sits where the eye starts |
| Bottom-right | End Turn above the discard pile count | "I'm done" is the last stop of the left-to-right read |

Lesson: our read order is **status → city → hand → budget → end turn**, left
to right, top to bottom. The city grid is the "enemies": it sits in the
middle, large, and the hand's cards point at it.

## 2. The hand is a fan, and the focused card is the only big one

- Cards overlap in an arc, slightly rotated, bottom edge off-screen. Resting
  cards are small; you can read the name and cost and the art, nothing more.
- The hovered/focused card **rises and scales up** (about 1.25×) to fully
  readable size, and its neighbours **slide apart** so it never overlaps. One
  card is readable at a time. That is a feature: at ten feet you cannot read
  five cards at once anyway.
- Moving focus left/right along the fan is the whole hand interaction on a
  controller. StS2's Godot focus system does exactly this: d-pad left/right
  walks the fan; A selects.
- The hand never changes order under you while you're reading it.
- Draw and discard leave motion streaks; a card played flies to where it
  acts, then into the discard pile. The piles' counters tick. You always know
  where a card went.

Lesson: build the fan with real spacing math (not a flexbox row), make the
focused card the only fully readable one, animate every card arrival and
departure toward its pile, and never reorder the hand mid-turn.

## 3. A card is readable at thumbnail size and at full size

Card anatomy, top to bottom: **cost orb** top-left (big, always visible even
when the card is mostly hidden in the fan), **name banner**, **art**, **type
banner** (Attack / Skill / Power), **rules text** with keywords in gold.
Rarity is the frame colour, character is the background colour. Type is also
frame *shape* (attacks taper at the bottom).

Lesson: cost and name must survive the fan's overlap, so they live at the top
left. Family (zone/facility/goal/status/disaster) is the card's colour and the
type banner says it in words too. Rules text is short sentences, every
keyword consistent. A card must be legible at 220 px tall on a 1080p TV and
still look like itself at 320 px.

## 4. Targeting is a line from the card to the thing

Playing a targeted card draws a curved arrow from the card to the enemy; you
move the arrow among valid targets; invalid targets don't take focus. With
one target, StS2 players asked for (and modders built) "just play it", and
Mega Crit added "remember the previous target".

Lesson: our targeted action is placing a building on a cell. Selecting a card
enters a **targeting mode on the grid**: a cursor on the nearest valid cell,
valid cells lit, invalid cells dim and skipped by the d-pad; A places, B
backs out to the hand. Remember the last placed cell as the next starting
cursor. If there is exactly one valid cell, still show it (placement is a
real decision here, unlike a one-enemy fight).

## 5. Intents: show what is about to happen before it happens

Every enemy shows an icon of its next move with the number. The player plans
against the future, not the past.

Lesson: our "intents" are the budget reset (what next turn's budget will be
given today's buildings), the disaster countdown, the goal that expires
next, and which status cards will be eaten by which facility next turn. Show
them as small, stable readouts, not log lines.

## 6. The controller: few buttons, each with one meaning, and a legend

StS2's default map (Godot focus system, per the bridge mod's keymap and the
patch notes):

| Button | Meaning |
|---|---|
| D-pad / left stick | move focus (cards, targets, map nodes, menu rows) |
| A | select the focused thing |
| B | cancel / back |
| Y | confirm / proceed / **end turn** |
| X | the top panel (relics/potions) |
| LB / RB | the pile views (draw, discard, exhaust) and tabs |
| RT / LT | view/zoom |
| Start | menu |

Two things players complained about, loudly: **end turn on the same button as
confirm** (accidental end turns lost runs; the keyboard guide now says "bind
End Turn to a deliberate, isolated key"), and multi-target fights where
targeting felt clunky.

Lesson: A = select, B = back, **Y = end phase but only from a resting state**
(never while a card is selected or a prompt is open), X = deck view, LB/RB =
cycle pile views, Start = menu. Show a legend strip at the bottom edge with
glyph + word, and change it per mode (in targeting: "A Place · B Back"). Hold
to repeat on the d-pad (350 ms then 120 ms) so walking a long row is quick.
Mouse/keyboard keep working (arrows, Enter, Esc, E, Q/R, Tab) so I can drive
it in Playwright.

## 7. Keywords teach the game; nothing else does

Every keyword on a card has a tooltip; every icon has a tooltip; there is no
tutorial worth the name. New ideas arrive one card at a time.

Lesson: when a card is focused, its keywords (Crime, Trash, Pollution, Slot,
Monument, Road frontage, Budget) show short definitions in a panel beside
the card, automatically. No manual, no walkthrough slides for now.

## 8. Feedback has weight, and never blocks you

Big exaggerated numbers float off the thing you hit; sounds are chunky; the
screen shakes a little; cards you can't afford are visibly greyed; but you
can queue the next card before the last animation ends. Nothing waits for
you to watch it.

Lesson: budget spent pops off the orb; population gained pops off the top
bar; a status card entering your deck shows a red card diving into the
discard pile; a disaster drawn shakes the screen. All animations are
interruptible and under ~400 ms.

## 9. The map is a screen, the fight is a screen

Between fights you get whole other screens (map, rewards, shop, rest). They
share the frame and the controls but not the layout.

Lesson: Build and Acquire are different jobs, so they get different
*emphasis*, not different screens: in Build the hand is lit and the market
dim; in Acquire the market rows slide forward and the hand dims. End of turn
is a short "intent" screen: budget reset, statuses eaten, disaster tick,
goals expiring, then the next hand deals.

## 10. Ten-foot rules we add on top

From the tvOS / Fire TV guidelines and the stfj legibility piece:

- Body text ≥ 28 px at 1080p, titles ≥ 44 px; medium/semibold weights, thin
  strokes vanish on TVs.
- One focus ring, high contrast, unmistakable; never rely on colour alone.
- Low density: fewer things, bigger. If it doesn't fit, it's a second screen.
- Dark background, light text, saturated flat colours for the families
  (Matt's taste: bold but simple, flat swatches on black and white).
- Design at a fixed 1920×1080 stage and scale it to the viewport. The layout
  is a picture, not a document.

## What we are deliberately not copying

- Painterly art. We have no art pipeline; flat colour + a clean glyph per
  building reads better from the couch than a bad painting would.
- Relics, potions, the vertical map. Different game.
- Mouse-first hover. Focus is the primary state; the mouse just moves focus.
