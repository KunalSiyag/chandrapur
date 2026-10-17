# Chandpur — screenshot and traversal review

Reviewed the rendered world, not only the route graph. Captures use the real
toon/post pipeline at 1280 × 800 and paused simulation; the aerial views are
made by boarding and stepping the actual balloon system.

## First milestone

Preserved in `shots/town/milestone/`: station, bazaar entrance, bazaar interior,
river. The town was first built as that continuous route and evaluated before
the hill districts were enabled.

Found and fixed:

- A final shop and a rear house interrupted the opening from the bazaar to
  the water; move the building footprint and continue the rear lane behind it.
- Prop footprints and rear house corners obstructed the back-alley centreline.
- The footbridge parapet prevented a lateral approach from the riverbank;
  bring the bank lane to a landing north of the bridge and turn onto the deck.
- A bench and a tree occupied the western return route. Re-seat them beside
  the route rather than weakening collision or moving the player through them.
- An isolated Vite test import read a second, empty collider singleton. All
  town checks now read the running application's registry, with an assertion
  on the registry count. Clearance without actual colliders is not a pass.

## Six required final views

| Capture in `shots/town/final/` | Evaluation |
| --- | --- |
| `station.png` | Long veranda, off-axis clock and open platform passage establish the hub. The village and shrine are glimpsed uphill; benches, cycles, luggage, passenger and timetable identify its use. The moon is absent and the composition still works. |
| `bazaar-entrance.png` | The street compresses under awnings and a modest hanging sign. Receding balconies, product shelves and a crooked sightline lead inward; a shopkeeper and shopper give scale. Moon is a partial roof-gap accent. |
| `bazaar-interior.png` | Close stock shelves provide foreground, staggered facades and bulbs form the middle distance, and the last bend releases a thin river view. The moon is occluded here. This is the strongest spatial threshold, rather than a collection of shops in a field. |
| `river.png` | Horizontal teal water, low stone stairs, restrained diyas, pigeons and the arched bridge slow the pace. Across the water, the usable balloon and its working landing signal another reachable place. Local slate/stone continue across the district. |
| `balloon.png` | Actual seated basket rim and rigging frame the station, railway crossing and hill approach. No walking camera floats independently of the balloon. Additional `balloon-fort.png` and `balloon-shrine.png` verify the cue sequence and changing vista. |
| `hilltop.png` | A low fort coping in the foreground frames housing terraces, station/train, bazaar roofscape, river, bridge and meadow landing. The repeated slate/timber/limewash connect those layers. The moon stays off-centre. |

Additional motif views: `alley-moon.png` (moon behind a utility cross-arm),
`moon-wires.png` (moon partly behind rooflines and service wires),
`river-moon.png` (broken viewer-aligned reflection), `temple-moon.png` (moon
through the bell porch), plus `village.png`, `shrine.png`,
`balloon-station.png` and `town-overview.png`.

## Aerial findings and corrections

- Blank house backs looked like stage-set cubes from the fort. Every generator
  now has side windows, rear windows, a service door and small household court.
- The first basket had too high a rim for seated downward sightlines. The
  seated eye, rim and bounded default pitch were measured and reworked;
  free-look can still intentionally look into the basket.
- A fort camera behind the crenellations showed only a wall. The actual
  lookout has a lower coping and a clear slot; the capture is taken from
  that walkable spot, not from a floating camera above the wall.
- Balloon position and camera cues used different curve-length parameters,
  making a cue occur over the wrong landmark. Camera targets now use the same
  curve-station mapping as the physical flight.
- Visible bridge piers did not reach the deck. A swept structural arch and
  measured pier tops now join the bank, deck and supports continuously.
- Hill house parcels were not cut to the foundation grade. Authored parcel
  pads and route-first height selection now keep the terrace and lane coherent.

## Physical checks

- Collision-aware flood fill reaches all seven district anchors and the
  far-bank bridge landing. No route centreline overlaps a collider or enters
  deep water. `connectivity.json` records the results.
- `walking-check.json`: actual W/mouse input walks all 12 authored routes,
  the open station passage and the entire footbridge. Arrival is measured;
  setting the player position at a destination is not the test.
- `balloon-check.json`: actual E input boards; walking suspends; free-look
  works; boarding/ascent/cruise/descent/landing are continuous; both trips and
  empty calling work; walking/avatar/parked collider restore; exit movement
  is a continuous short disembark onto the platform.
  The final check recorded roughly 7 m minimum terrain clearance, under 8 cm
  maximum per-tick flight displacement, and under 6 cm per-tick exit movement.
- Guided flight projects station, bazaar, river, fort and shrine into view
  during their cues. Screenshots are used separately to judge occlusion and
  framing; a projected point alone is not a visual-quality judgment.
- `life-check.json`: seven resident skeletons and geometry remain finite;
  the shopper's complete route stays clear. Local wildlife and clothes have
  bounded, deterministic motions.
- Player posture regression preserves upright idle, fixed foot plants,
  motion-only walking lean, and camera-independent core bones.
- The map works by keyboard, retains player coordinates, and fits a narrow
  mobile viewport. It is navigation information, not fast travel.

## Assessment

The town now reads as a small connected place: distinct foreground/middle/
background layers, identifiable approaches and exits, repeatable household
materials, useful service alleys, a quieter water edge, and a gradual hill
reveal. The bazaars and hub carry most detail; outer valley land is deliberately
quieter. It remains a stylised procedural prototype—the slate roof forms,
vegetation and shop-stock patterns are visibly repeated—but the route network
and inhabited parcels give those repetitions a place and purpose.
