# Tawid EDSA

**Uwi na, Kokak!** It's raining in Manila, and Kokak the palaka has to get home to his family in the palayan. He has to hop across EDSA traffic, then ride the troso, the balsa and the pagong over the estero, to reach five gabi leaves. It's the classic lane-crossing arcade game, Pinoy style.

**Play:** https://tawid-edsa.vercel.app

## How to play

- **Arrow keys / WASD** hop one space. Hold to keep hopping. On a phone, swipe (a tap hops forward) or use the d-pad. **P** pauses and **M** toggles sound.
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

## Run locally

```sh
python3 -m http.server 8000
```

Tests (Node 20+): `node --test test/*.test.mjs`.
- **The rules:** every lane wraps out of sight and never overlaps, hops and the hop buffer, traffic, riding, sinking, the leaves, the bonuses, the buwaya, the ahas, the timer, lives, and exact replays.
- **Balance:** every lane is a pure function of time, so a planner (`src/bot.mjs`) can run the rules' own frog step on copies and look ahead exactly.
  - Played perfectly, it clears every place, in both rounds, on every difficulty, without losing a frog. So no level is unfair.
  - A person-like version plans ten moves ahead but presses up to 5 ticks late. It sets the difficulty floors.

One choice differs from the arcade: after a hop onto the road or the island, Kokak lines up with the column, so it's easier to aim for the leaves.

Made by [Lemmuel Turaya](https://kon2raya.netlify.app). All art, music and sounds are drawn or synthesized in code.

## License

MIT
