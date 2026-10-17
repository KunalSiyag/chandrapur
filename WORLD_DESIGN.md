# Chandpur — a town reached on foot

An original, fictional North Indian lower-hill railway town, just after the last
passenger service. One river valley, one local building tradition: grey
fieldstone foundations, worn lime plaster, indigo or bottle-green timber,
slate roofs, corrugated repairs, brass and terracotta. No regional attraction
collage. The station is a useful place people live around, not a display piece.

## What was studied

Source: [Sakura Crossing](https://github.com/Kenton-GMI/sakura-crossing), README
and its documented layout/terrain/verification rationale. The applicable
principles are:

- Reach a district through a spatial threshold; do not merely arrange landmarks
  beside one another. Constriction, bends and elevation reveal the next place.
- The land **between** landmarks matters: ordinary housing, service lanes,
  household traces, drainage, retaining walls and useful shortcuts.
- Keep a few load-bearing sightlines open. Foreground, middle distance and a
  recognisable destination give a view depth without demanding the moon.
- Place evidence of use for a reason: deliveries behind shops, transport at
  the station, washing by houses, offerings at the shrine, mooring equipment
  at the river, fuel and ropes at the balloon landing.
- Rendered ground and walkable ground must agree. Verify connectivity with
  collision-aware reachability and actual movement, then inspect real frames.

The setting, names, parcels, geometry, layout, artwork and vehicle designs in
that repository are not used. This is a flat valley with graded hills, not a
planet. New town generators and district arrangements are authored here.

## Construction order

1. **Station → old bazaar → river.** Complete this route, its back-alley loop,
   platform access, ghat stairs, river bridge and western return lane; inspect
   the four ground-level milestone views before extending it.
2. Add the railway crossing, graded village switchbacks, fort and shrine walk.
3. Add the valley and upper balloon platforms and a real return-capable flight.
4. Inspect six requested views and test all ground routes and the flight cycle.

## Districts and their compositions

| District | Landmark / silhouette | Material character | Evidence of habitation | Memorable composition |
| --- | --- | --- | --- | --- |
| Old railway station | Long veranda, slim square clock, blue passenger coaches | Faded ochre plaster, slate, maroon timber | Timetable, luggage trolley, cycle rack, late chai, route board | Clock off-axis over the forecourt, tracks receding behind the veranda; a visible bazaar mouth |
| Old bazaar | Crooked continuous two-storey frontage; a peepal at a small widening | Dusty apricot/cream limewash, indigo shutters, canvas awnings | Product shelves, tailor's cloth, delivery crates, a shuttered shop, balcony washing, repaired wires | Compression under awnings, a bend hiding the river, then the water appearing beyond the final shop |
| Riverside ghats | Broad stone treads, modest pavilion, arched footbridge | Cool grey stone, moss, muted teal water, small warm diyas | Water pots, folded washing, boat rope, a swept sitting place | Quiet horizontal water after the bazaar; broken moon reflection beside the bridge |
| Hill village | Staggered houses on two retaining terraces | Same stone/slate tradition; pale sage plaster and painted timber | Laundry courts, log stacks, water drums, kitchen window, planted steps | A turn between houses reveals the station clock and roofscape below |
| Hill fort | Low fieldstone ramparts and two square ruined bastions | Unplastered grey/brown masonry and dry grass | Patched parapet, survey marker, resting bench, old trail notice | Town and river below an open crenellated foreground; moon to one side |
| Shrine hill | Small North Indian shikhara and open bell porch | Limewashed ivory, vermilion trim, local stone | Shoes, brass bell, marigolds, offerings, water pot | Moon beside the shikhara / through the bell porch, with a second view downhill |
| Balloon landing | Wicker basket under a saffron/indigo envelope; low flight shed | Timber decking, rope, canvas, brass burner | Flight ledger, fuel cylinders, wind sock, coiled lines, cargo basket | Seated basket rim and rigging frame the station, bazaar, ghats and fort during a scenic crossing |

## Physical network

```
                    SHRINE ───── ridge walk ───── FORT
                       │                            │
                 upper village ───────── upper landing
                       │                            │
                 switchback lane                    │ scenic balloon flight
                       │                            │ (both ends also walkable)
                railway crossing                    │
                       │                            │
 western return ─── STATION ── entry lane ── BAZAAR  │
       │                                 ╱     │    │
       │                         back alley ───┘    │
       │                                       │    │
       └──────────── GHATS / riverbank ─────────┘    │
                          │                         │
                    stone footbridge                │
                          │                         │
                    south-bank footpath ── valley landing
```

The graph, grades, landing heights and district anchors are data in
`src/world/layout.js`. The same functions seat the geometry, feet, camera,
stairs and bridge. Streets are continuous ribbons rather than isolated slabs.
Furniture is assigned to authored frontages/courts/working areas; seed-based
variation changes detail and wear, not the town plan.

## Moon and flight

The moon hangs over the south-east valley, away from the starting camera's
centre. It is encountered over roofs and wires, through the river-end passage,
on the water, by the shrine porch, from the fort and from the basket. Looking
away still exposes coherent streets and silhouettes.

`E` boards a grounded balloon at its access step. A boarding blend lowers the
camera to a seated eye above the basket floor. Walking is suspended. Ascent,
scenic cruise and descent are explicit states, with a continuous prescribed
route and authored default look targets. Mouse/drag free-look offsets those
targets throughout the trip. Only a grounded basket permits exit; the player
steps onto its destination platform and can continue on foot or ride back.
There is no district teleport, aerial reset, or hidden transport shortcut.

## Evaluation

Keep a station view, bazaar entrance, bazaar interior, river view, seated flight
view and hilltop view in `agent/shots/town/`. Judge legibility, density,
foreground/middle/background depth, local material consistency, physical
thresholds and traces of use. Connectivity and movement tests must check
colliders and water, not just distances between labelled landmarks.
