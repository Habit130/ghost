# Third-party assets

All third-party assets below are by **Kenney Vleugels (Kenney.nl)** and licensed under
**Creative Commons Zero (CC0)** — free for personal and commercial use, no attribution
required (credit appreciated). Pack licenses are vendored next to the files.

| Asset | Source pack | In repo |
| --- | --- | --- |
| Furniture/indoor tiles (16×16) | [Roguelike Indoor pack](https://kenney.nl/assets/roguelike-indoors) | `public/assets/spritesheets/indoor.png` |
| Character tiles (16×16) | [Roguelike Characters pack](https://kenney.nl/assets/roguelike-characters) | `public/assets/spritesheets/chars.png` |
| Object/item tiles (16×16) | [Roguelike/RPG pack](https://kenney.nl/assets/roguelike-rpg-pack) | `public/assets/spritesheets/objects.png` |
| Sound effects | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `public/assets/audio/sfx/*.ogg` |
| BGM loop | [Music Jingles](https://kenney.nl/assets/music-jingles) | `public/assets/audio/music/bgm.ogg` (currently `jingles_NES00`; swap the file to change tracks) |

The ghost protagonist (`public/assets/ghost.png`, 3 frames: idle / dash / bounce) is a
programmatically drawn 16×16 placeholder — replace it with a hand-drawn version freely;
the loader reads any 48×16 spritesheet with 16px frames.

Sound effect mapping (RPG Audio → game event):

- `cloth1.ogg` — dash
- `creak1.ogg` — possess
- `handleCoins.ogg` — rare host
- `knifeSlice2.ogg` — near miss
- `chop.ogg` — death
