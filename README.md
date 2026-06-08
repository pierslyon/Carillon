# 🔔 Carillon

A tiny web game: pick a number of bells and play them like a [carillon](https://en.wikipedia.org/wiki/Carillon) using your keyboard. The bells hang inside an animated stone bell tower that frames the page — each one swings and glows when it rings.

No build step, no dependencies. It's plain HTML, CSS and JavaScript.

## Play

Just open `index.html` in a browser:

```bash
open index.html
```

Or serve it locally (handy on some browsers for audio autoplay rules):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How to play

- **Choose your bells** with the *Bells* slider (3–16). The bells are tuned to a
  G‑major scale — biggest/lowest (G) on the left, climbing to the smallest/highest
  on the right.
- **Ring a bell** by pressing its highlighted key (`A S D F G H J K L` then
  `Q W E R T Y U I O P` for the higher bells), or by clicking/tapping it.
- **Volume** is adjustable from the base.
- **Resonance** sets how long the bells ring out — like a piano's sustain
  (forte) pedal: low for a short, damped tap; high for a long cathedral ring.

## How it works

- **Sound** is synthesised live with the Web Audio API — no audio files. Each
  bell is built from several inharmonic partials (including the characteristic
  minor-third partial that makes a bell sound like a bell) plus a short filtered
  noise burst for the metallic strike.
- **Visuals** are CSS + SVG. The tower frame, bells, swing and halo are all drawn
  and animated in the browser.

## Two pages

There are two pages, switched with the tab bar at the top:

- **Carillon** (`index.html`) — the keyboard instrument described above.
- **Bell Pull** (`ring.html`) — a single large tower bell on a full-length,
  striped woolly **sally** rope. Grab the sally and pull down (mouse or finger) to ring it;
  pull harder for a louder strike. A **Bell size** selector swaps between bells
  from a small high treble to a giant deep bourdon (bigger = lower & longer).

## Files

| File | Purpose |
|------|---------|
| `index.html` | Carillon page: tower frame, belfry, controls |
| `ring.html` | Bell Pull page: big bell, rope + sally |
| `styles.css` | Stonework, bells, sally and animations (shared) |
| `carillon.js` | Carillon: bell building, keyboard mapping, audio |
| `pull.js` | Bell Pull: rope drag, size selector, tower-bell audio |

## License

MIT — see `LICENSE`.
