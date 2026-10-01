# Tawid EDSA

**Uwi na, Kokak!** It's raining in Manila, and Kokak the palaka has to get home to his family in the palayan. He has to hop across EDSA traffic, then ride the troso, the balsa and the pagong over the estero, to reach five gabi leaves. It's the classic lane-crossing arcade game, Pinoy style, in 3D.

**Play:** https://tawid-edsa.vercel.app

## How to play

- **Arrow keys / WASD** hop one space. Hold to keep hopping. On a phone, swipe (a tap hops forward) or use the d-pad. A controller works too: the d-pad or the stick hops, Options pauses, and ✕ presses buttons in the menus. **P** pauses and **M** toggles sound.
- On the road, don't touch the jeepneys, P2P buses, taxis, tricycles, motorsiklo, pedicabs, trucks or kalesa.
- On the water, you have to ride something: troso, balsa, pagong, batya, salbabida, banig, bangka, a ferry, water lilies. The water sweeps you away, and so does riding off the edge of the screen.
- Some things sink now and then: the pagong, the salbabida and the water lilies. You're safe while they're going under, but not once they're gone.
- Hop straight into a gabi leaf; landing on the dike loses a frog. Fill all five leaves to clear the level.
- **Bonuses:**
  - +10 for every new row.
  - Time left on the clock when you get home.
  - A lamok on a leaf: +200.
  - A lost anak na palaka riding a troso: hop onto it and carry it home for +200.
  - +1,000 when the whole family is home.
  - **Lusot!** +25 for a near miss: landing just behind a vehicle that's driving away, or hopping out of a lane a moment before a vehicle reaches you.
- **Watch out:**
  - A buwaya: its back is a ride, its head bites. In a leaf, its eyes are a warning and its jaws are not.
  - An ahas patrols the island in the later places.

## The places

1. **Cubao · EDSA**, over an estero.
2. **España**, in the baha (flood).
3. **Quiapo**, with a kalesa and the Ilog Pasig.
4. **Maynila** on a rainy night, on Taft Avenue.

After that it goes around again, faster, with everything turned on.

**Difficulty:**
- **Madali** (the default): 5 lives, 60 seconds, slower traffic, longer logs, and a wider leaf.
- **Katamtaman**: the classic, with 3 lives and 40 seconds.
- **Mahirap**: 2 lives, 30 seconds, rush hour, the buwaya from the start and the ahas from the second place.

## Safety

Kokak is a frog, and he's the only one who crosses like this. Manong Enforcer says it once before the first level: *"Tayo, sa footbridge o sa pedestrian lane!"* He adds that you should never wade through flood water, because of leptospirosis.

## How it looks, and how it's made

The game is drawn as a real-time 3D place in three.js, with no build step (native ES modules). The rules in `src/game.mjs` are untouched: the view only reads them.

- **The place.** Rainy EDSA: wet asphalt with lane paint, puddles that reflect the sky and the lamps, and headlights that throw pools of light, red tail-light streaks and beams through the rain. Streetlamps line the median. Behind the sidewalk there's a row of lit shophouses. Across the estero, the pilapil and the gabi grow on the far bank, and past them stand shanties with laundry lines, then the elevated railway with its train, billboards and the skyline. A footbridge crosses EDSA to the west, with Manong Enforcer on it and an MMDA "BAWAL TUMAWID" tarpaulin. Bridges cross the estero at both ends of the board, where the current sweeps you away.
- **Four places**, each with its own light, sky, water and colour grade:
  - **Cubao** at dusk under the MRT, with the big dome.
  - **España** in the flood: brown water over the road, overcast, heavy rain.
  - **Quiapo** by the Pasig in the golden hour, with the church and Quezon Bridge's arch.
  - **Maynila** at night under the LRT, with neon.
- **The traffic** is modelled in code:
  - jeepneys with chrome hoods, horses, skirts, wheel arches, route boards and loaded roof racks;
  - P2P buses with lit windows and running lights;
  - taxis shaped like sedans, with bumpers and mirrors;
  - tricycles, motorsiklo with riders, pedicabs, trucks with sacks of rice, and a kalesa whose horse trots.
  
  Every lamp glows.
- **The buildings** have depth: the shophouses have framed, grilled windows, aircon units, balconies with plants, striped awnings, lit and blade signs, and water tanks. The skyline's towers have podiums, setbacks, crowns, masts with warning lights and LED bands.
- **The estero** is a water shader. Each lane's current carries its own ripples and foam, so you can read the flow. Rain rings open everywhere. Troso, balsa, bangka, the ferry, banig, styro, batya, salbabida and water lilies float on it. The pagong paddle, wobble before they dive, and show as shadows while under. The buwaya's jaw snaps and its eyes glow.
- **Kokak** is modelled and animated in code: glossy spotted skin, big eyes that blink and follow the traffic, a breathing throat, and jointed legs. A hop crouches, stretches and lands with a springy squash. The family waits on the leaves; a lamok buzzes over them, and a buwaya peeks up. The ahas slithers along the median.
- **The camera** frames the whole width of the board from a tilted three-quarter view and follows Kokak up the rows. Settings has a whole-board option. On a phone held upright, it looks nearly straight down, and the lives and timer sit in a compact strip right under the board, above a bigger d-pad.
- **Moments:**
  - Each level opens with a letterboxed flyover. Any key, tap or button skips it, and it's shorter after the first time you see a level.
  - A death gets a short punch-in and a beat of slow motion.
  - A near miss gets a whoosh, a flash of speed lines and **LUSOT!**
  - Landings and falls send rings across the water.
  - A family home gets a small hit-stop.
  - A full family gets fireworks, a low dolly along the leaves as the family hops, and a cut to Manong Enforcer's whistle and wave.
- **The film look** (`src/post.mjs`, from Tumbang Preso): ambient occlusion, bloom, a filmic tone map, a grade per place, vignette, grain, and SMAA. It steps itself down on slow devices; `?gfx=0|1|2` pins the level, and so does the Graphics setting. **Bawas-galaw** (or the system's reduced-motion setting) turns off shake, flashes, camera swings and slow motion.
- **Without WebGL**, the original flat 2D board (`src/render.mjs`) plays instead.

Where things come from:
- The scanned surfaces (asphalt, pavers, concrete, mud, grass, bark, bamboo), the four skies and a few props (trash bags, crates, a tyre, ferns, rocks, barriers, a utility box) are CC0 from [Poly Haven](https://polyhaven.com). They were converted with the Bakbakan tools into `assets/env/`. Without them the game uses its own painted surfaces.
- The recordings in `assets/sfx/` (hits, landings, steel-drum jingles, menu clicks) are CC0 from [Kenney](https://kenney.nl). The music and the rest of the sound are synthesized. The recordings are normalised as they load, the music sits under the effects, and everything goes through a limiter.
- Everything else (models, textures, water, rain) is made in code.

Modules: `view3d.mjs` (the view, pools, camera, events), `world3d.mjs` (the static place), `models3d.mjs` and `kit.mjs` (the models), `frog3d.mjs` (Kokak), `water3d.mjs`, `fx3d.mjs` (rain, particles, floating words), `envpack.mjs` (the Poly Haven assets), `tex.mjs` (procedural textures) and `space.mjs` (where the board sits in the world). three.js r186 is bundled in `src/vendor/` (MIT).

## Run locally

```sh
python3 -m http.server 8000
```

Tests (Node 20+): `node --test test/*.test.mjs`. For headless checks, `?test=1` adds `window.__te`, plus `seed`, `go=1`, `level`, `difficulty`, `autoplay=1`, `intro=0` (skip the flyover), `snap=1` (the camera jumps instead of gliding), `gfx=0|1|2` and `flat=1` (the 2D board).
- **The rules:** every lane wraps out of sight and never overlaps, hops and the hop buffer, traffic, riding, sinking, the leaves, the bonuses, the buwaya, the ahas, the timer, lives, and exact replays.
- **Balance:** every lane is a pure function of time, so a planner (`src/bot.mjs`) can run the rules' own frog step on copies and look ahead exactly.
  - Played perfectly, it clears every place, in both rounds, on every difficulty, without losing a frog. So no level is unfair.
  - A person-like version plans ten moves ahead but presses up to 5 ticks late. It sets the difficulty floors.

One choice differs from the arcade: after a hop onto the road or the island, Kokak lines up with the column, so it's easier to aim for the leaves.

Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT. The Poly Haven and Kenney assets are CC0.
