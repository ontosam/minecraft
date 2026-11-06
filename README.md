# Ezra's Blocks 🧱 + Ezra's Mine ⛏️

Two gentle games made for a 6-year-old:
**[Ezra's Blocks](https://ontosam.github.io/minecraft/)** (a 3D block world)
and **[Ezra's Mine](https://ontosam.github.io/minecraft/mine/)** (a tap-and-merge
mining game — see the bottom of this page).

A gentle, **third-person** Minecraft-style world made for a 6-year-old. It looks
and feels like Minecraft, but it's calmer and built to be easy to navigate:

- 🧒 You see **your character** from behind; the camera follows on its own, so
  you always know where you are.
- 🌞 Always daytime — **no monsters, nothing scary, and you can't "die."**
- 🧱 **Build & dig** by tapping where you want — ~30 kinds of blocks
  (grass, stone, wood, gold, diamond, glass, a pumpkin, colours, and more).
- 🐷 **Cute animals** to walk up to and **pet** (they can follow you).
- ⭐ **Goals** that earn stars and get a little harder over time, so there's
  always a next thing to do.
- 💾 **Auto-saves** on the device and picks up right where he left off.
- 📴 Works offline once added to the home screen. No ads, purchases, chat, or
  other players — completely self-contained.

## ▶️ Play it
Open the link on the iPad (or any computer):

**https://ontosam.github.io/minecraft/**

On the iPad, tap **Share → Add to Home Screen** so it opens fullscreen like a
real app (and so progress is saved durably).

> It updates automatically — whenever a change is pushed to the `main` branch,
> the link refreshes within about a minute.

## 🎮 How to play
**On the iPad (touch):**
- **Walk:** drag the **left** side of the screen. The camera follows behind.
  (Backing up is a gentle step-back.)
- **Look around:** drag the **right** side.
- **Build / Dig:** **press the spot** you want — a light outline (build) or glow
  (dig) shows where — then **lift your finger**. The **Build** / **Dig** buttons
  pick the tool (the active one has a gold ring) and also act right in front.
- **Pick a block:** tap the **block button** (top-left) to open the picker.
- **Pet an animal:** walk up and tap **Pet** 🐾.
- **Jump:** the **Jump** button (he also auto-hops small steps). **Goals:** ⭐.
  **Go home:** 🏠.

**On a laptop:** **W A S D / arrow keys** to move, **drag the mouse** to look,
**hover** to preview and **click** to build/dig.

## 👨‍👩‍👧 For grown-ups
Runs entirely on the device, offline-capable, no ads/purchases/chat. Creations
and goal stars save automatically. If an **"Oops"** screen ever appears, it shows
the details — screenshot it and send it.

## 🛠️ For developers
Zero-dependency static web app (hand-written WebGL, procedural textures, ES
modules, **no build step**). See **[CLAUDE.md](CLAUDE.md)** for full architecture,
the control/camera design, debug hooks, the headless testing approach, deploy
notes, and the roadmap.

```
node scripts/serve.mjs     # serve locally on http://localhost:8000
node scripts/make-icons.mjs # regenerate the PWA icons
```

## 🗺️ What's next
A friendly **"protect your house" creeper** (slow, never hurts him — real stakes
without the scary part), **giants**, **villagers with quests**, more goal
challenges, and a graphics/atmosphere pass. Details and rationale in CLAUDE.md.


---

# ⛏️ Ezra's Mine

**https://ontosam.github.io/minecraft/mine/** (Share → Add to Home Screen)

An original tap-and-merge mining game in the same style as the mobile games
Ezra likes — but with **nothing to buy, no ads, no energy limits, and no
tricks to keep him hooked**. Everything is earned by playing.

- ⛏️ **Tap the big block** to dig. A new block pops onto the board.
- 🤝 **Drag two matching blocks together** (or tap one, then its twin) to
  merge them into a bigger block — 20 to discover, from Dirt to the Star Block.
- 🪙 Every block on the board **earns gold**. Spend it on better pickaxes,
  a mole helper called Digby, and bigger blocks from the mine.
- 🔥 The **Furnace** melts blocks into bricks 🧱 and shiny ores into metal
  bars. Bricks build a little **Village** that helps you.
- 📖 **Quests** always show what to try next; the **Blocks** book shows every
  block you've found. Words can be **read aloud**.
- ⚡ The yellow bar under the big block *fills up* as you dig — when it's full
  you get a Super Swing. The **x2 Gold Rush** fills up as you merge.
- 💾 Saves automatically. Gold keeps trickling in (a little) while away.

**For grown-ups:** tap the ⚙️ and **hold the circle for 3 seconds** to open
settings: sound, read-aloud, numbers on blocks, an optional **break reminder**
(default 30 minutes — a friendly "time for a break?" card, never a lock), and
"start over".
