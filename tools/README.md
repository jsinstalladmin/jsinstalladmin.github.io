# tools: how the pictures and the film are made

There are no image prompts behind this site's layout pictures or its home
page film, and there never were in the version that is live. Everything
you see of a closet that is not a photograph of a real install is
**rendered by the site's own 3D engine**, through the handles the builder
exposes on `?audit=1`:

| handle | what it does |
|---|---|
| `__apply(plan)` | puts a whole design into the builder |
| `__cam({at, look, fov})` | stands the camera somewhere, in room inches |
| `__bare(true)` | takes the room away and puts the closet on plain white |
| `__shot(keepCamera)` | hands back the frame as a PNG |
| `__cur` | the built design: parts, geometry, room, bays |

That is on purpose. A generated or hand-drawn picture can show two runs
meeting in the corner, a rod at the wrong height, or a drawer box taller
than the ten inch cap. A frame that comes out of this engine cannot,
because it is the same engine that builds the drawing and the parts list.

The old Magnific prompt pack in the project notes is **history, not the
current method**. It describes corner-meeting U-shapes and a wall bed,
neither of which this company builds.

---

## Before either script

Serve the site root on a port and leave it running:

```
cd "<this folder>/.."
python3 -m http.server 8777
```

Both scripts need Playwright with Chromium, and the film needs ffmpeg.

```
npm i -D playwright && npx playwright install chromium
```

---

## The layout pictures

```
node tools/render-images.mjs            # renders into .image-out/, writes nothing
node tools/render-images.mjs --write    # puts them into img/nav/ and img/parts/
node tools/render-images.mjs --only drawers
```

Twelve pieces, two pictures each: a 480×480 menu tile at `img/nav/<preset>.jpg`
and a 900×1200 layout-page picture at `img/parts/<key>.jpg`. The camera
distance is solved from each tower's own size, so a short piece and a
full-height one sit the same in their frame.

The script checks its preset-to-filename table against `PRESETS` in
`assets/js/design.js` and stops if the two have drifted, so adding a
thirteenth piece cannot quietly write the picture to the wrong name.

Nothing in `img/` is touched without `--write`.

## The home page film

```
node tools/render-film.mjs              # renders into .film-out/, writes nothing
node tools/render-film.mjs --write      # puts them into video/ and img/
node tools/render-film.mjs --frames     # stops after the PNGs, for a look
```

Five stages of twenty frames: the empty room, the carcass, hanging, the
drawers and shelves, the finished closet, with the camera walking in and
pulling back at the end. It writes:

- `build-light.mp4`: 1600×900, 100 frames at 25fps, four seconds.
  **Every frame is a keyframe** (`-g 1`). The home page scrubs this film
  against the scroll position, and without that flag the browser jumps to
  the nearest keyframe instead and the film reads as a slideshow. It is
  about three times the size it would otherwise be, and that is the price
  of scrubbing.
- `build-loop.mp4`: the same frames forward then backward, so the video
  home page loops without a cut. This one is played, not scrubbed, so it
  does **not** get `-g 1`: with it the file goes from about 1.3 MB to
  nearly 8 MB for no gain.
- `poster-build.jpg`: the last frame, the poster for both.

Nothing in `video/` or `img/` is touched without `--write`.

The closet it builds is the U walk-in, so the twelve inch standoff and
both corner bridges are in shot.

It takes a while: on software GL it runs around seven seconds a frame, so
roughly twenty minutes for the hundred frames plus the encode. On a
machine with a real GPU it is a few minutes.

The film that is live was made with this choreography. Running the script
and comparing `.film-out/` against `video/` is the way to check a change
before you keep it.

## Changing the film

Everything you would want to change is at the top of `render-film.mjs`:
`STAGES` is what is in the closet at each stage, written in the same
shorthand as `ROOM_PLANS` in `assets/js/design.js`, and `CAM` is where the
camera stands at the first and last frame of each stage, in room inches.
Twenty frames are interpolated between the two with an ease, so a stage
neither starts nor stops with a jolt.
