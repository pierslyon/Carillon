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

- **Choose your bells** with the *Bells* slider (3–12). The bells are tuned to a
  major scale — biggest/lowest on the left, smallest/highest on the right.
- **Ring a bell** by pressing its highlighted key (`A S D F G H J K L ; ' \`),
  or by clicking/tapping it.
- **Volume** is adjustable from the base.

## How it works

- **Sound** is synthesised live with the Web Audio API — no audio files. Each
  bell is built from several inharmonic partials (including the characteristic
  minor-third partial that makes a bell sound like a bell) plus a short filtered
  noise burst for the metallic strike.
- **Visuals** are CSS + SVG. The tower frame, bells, swing and halo are all drawn
  and animated in the browser.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure: tower frame, belfry, controls |
| `styles.css` | Stonework, bells and animations |
| `carillon.js` | Bell building, keyboard mapping, audio synthesis |

## License

MIT — see `LICENSE`.
