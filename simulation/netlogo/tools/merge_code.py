"""Recreate code/combined.nls from the team's original Hoddle Grid model.

The combined model started as the groupmate's Hoddle Grid prototype. This script
applies every change we made to it, one small edit at a time, and then adds our
closure controls (code/closures.nls), the real OpenStreetMap network loader
(code/osm_network.nls) and the real traffic from Victoria's SCATS counts
(code/real_traffic.nls).

The combined model only uses the real map and real traffic data, so the
original's made-up street grid, entry weights, car parks and hook turns are
taken out along the way.

Keeping the changes as a script means anyone can see exactly how the combined
model differs from the original. Running it overwrites code/combined.nls, so
any edits made directly to that file will be lost.

Run it from anywhere:  python3 simulation/netlogo/tools/merge_code.py
"""

from pathlib import Path
import re
import xml.etree.ElementTree as ElementTree


NETLOGO_FOLDER = Path(__file__).resolve().parent.parent
MODEL_FOLDER = NETLOGO_FOLDER / "code"
ORIGINAL_MODEL = NETLOGO_FOLDER / "originals" / "Hoddle_Grid_Traffic.nlogox"


def replace_procedure(code, name, body):
    """Swap one whole NetLogo procedure (from "to name" to "end") for a new one."""
    pattern = r"(?m)^to(?:-report)? " + re.escape(name) + r"(?:\s[^\n]*)?\n.*?^end\s*$"
    code, count = re.subn(pattern, body.strip(), code, count=1, flags=re.S | re.M)
    if count != 1:
        raise ValueError("Could not find procedure " + name)
    return code


def remove_procedure(code, name):
    """Take out one whole NetLogo procedure and the blank line after it."""
    pattern = r"(?m)^to(?:-report)? " + re.escape(name) + r"(?:\s[^\n]*)?\n.*?^end\s*?\n\n?"
    code, count = re.subn(pattern, "", code, count=1, flags=re.S | re.M)
    if count != 1:
        raise ValueError("Could not find procedure " + name)
    return code


def swap(code, old, new):
    """Replace text that must appear exactly once."""
    if code.count(old) != 1:
        raise ValueError("Expected exactly one copy of: " + old)
    return code.replace(old, new)


GENERATE_DEMAND = """to generate-demand
  refresh-trips
  let per-second slot-scale / 3600
  with-local-randomness [
    random-seed (demand-seed + ticks * 104729)
    (foreach zone-points hour-trips hour-totals [[z trips total] ->
      if total > 0 [
        repeat random-poisson (total * per-second) [
          set generated-total generated-total + 1
          let d pick-group trips total
          ifelse item d [dist-base] of z >= BIG [set stranded-count stranded-count + 1]
            [ask z [set gate-queue lput (list ticks d) gate-queue]]
        ]
      ]
    ])
  ]
  ask zone-set with [not empty? gate-queue] [try-release]
end"""

# Cars are drawn along their road's real shape. Each road keeps the distance
# from its start to every shape point (seg-ends), so placing a car needs no
# square roots; this runs for every moving car every second.
PLACE_CAR = """to place-car
  let L cur-link
  let points [geometry] of L
  let ends [seg-ends] of L
  let d max list 0 pos
  let index 1
  let last-index length ends - 1
  while [index < last-index and d > item index ends] [set index index + 1]
  let a item (index - 1) points let b item index points
  let start item (index - 1) ends
  let f min list 1 ((d - start) / max list 0.001 (item index ends - start))
  let ddx item 0 b - item 0 a let ddy item 1 b - item 1 a
  let h atan ddx ddy
  let off 0.35 + ([lanes] of L - 1 - lane) * 0.35
  setxy (item 0 a + f * ddx + off * sin (h - 90)) (item 1 a + f * ddy + off * cos (h - 90))
  set heading h
  set color (ifelse-value speed < 0.5 [15] speed < vmax * 0.5 [25] [103])
end

to-report cumulative-lengths [points]  ;; metres from the start of a shape to each of its points
  let total 0
  let result [0]
  (foreach but-last points but-first points [[a b] ->
    set total total + point-distance a b
    set result lput total result
  ])
  report result
end

to-report point-along [points distance-m]
  let remaining max list 0 distance-m
  let index 0
  while [index < length points - 2 and remaining > point-distance (item index points) (item (index + 1) points)] [
    set remaining remaining - point-distance (item index points) (item (index + 1) points)
    set index index + 1
  ]
  let a item index points let b item (index + 1) points
  let segment-length point-distance a b
  let f min list 1 (remaining / max list 0.001 segment-length)
  let ddx item 0 b - item 0 a let ddy item 1 b - item 1 a
  report (list (item 0 a + f * ddx) (item 1 a + f * ddy) (atan ddx ddy))
end

to-report point-distance [a b]
  report 10 * sqrt ((item 0 b - item 0 a) ^ 2 + (item 1 b - item 1 a) ^ 2)
end"""

# At Setup every road is open and nobody is driving yet, so travel times as
# built, at free flow and as currently driven are all the same: work them out
# once and copy them.
SETUP_ROUTING = """to setup-routing
  let D length dests
  ask nodes [
    set dist-live n-values D [ BIG ]
    set dist-free n-values D [ BIG ]
    set dist-base n-values D [ BIG ]
  ]
  compute-distances "base"   ;; network as built, no closures: reference for delay
  ask nodes [
    set dist-free dist-base
    set dist-live dist-base
  ]
end"""

BUILD_REAL_MAP = """  resize-world -120 120 -102 102
  ask patches [set pcolor [22 29 39]]
  build-osm-network
  setup-count-sites
  if baseline-signature != scenario-signature [
    set baseline table:make
    set baseline-signature ""
    set baseline-summary []
  ]"""

NODE_NAME = """to-report node-name [n]
  report (word [node-kind] of n " " [map-id] of n)
end"""

NO_HOOK_TURNS = """to-report is-hook? [in-l out-l]  ;; the real map has no hook-turn locations
  report false
end"""

# Every light shows east-west green, then north-south green, with an
# amber/all-red INTERGREEN between. With adaptive-signals? on, each
# intersection splits its green time by demand at the start of every cycle,
# as SCATS does; otherwise ew-green-share sets the split everywhere.
UPDATE_SIGNALS = """to update-signals
  if adaptive-signals? [
    (foreach range length site-offsets site-offsets [ [id offset] ->
      if (ticks + offset) mod cycle-length = 0 [
        set site-shares replace-item id site-shares demand-share item id site-approaches
      ]
    ])
  ]
  let usable cycle-length - 2 * INTERGREEN
  ask signals [
    let g-ew usable * ifelse-value adaptive-signals? [ item site-id site-shares ] [ ew-green-share / 100 ]
    let t (ticks + cycle-offset) mod cycle-length
    set green-axis (ifelse-value
      t < g-ew [ "EW" ]
      t < g-ew + INTERGREEN [ "none" ]
      t < usable + INTERGREEN [ "NS" ]
      [ "none" ])
    if green-axis != "none" [ set last-green green-axis ]
  ]
end"""

# OpenStreetMap often draws one intersection as several junctions. All the
# junctions of one DTP signal site run on a single controller.
SETUP_SIGNALS = """to setup-signals
  set signals nodes with [ signalised? ]
  set site-offsets n-values length signal-sites [ 0 ]
  set site-shares n-values length signal-sites [ ew-green-share / 100 ]
  set site-approaches n-values length signal-sites [ no-links ]
  foreach sort remove-duplicates [ site-id ] of signals [ id ->
    let members signals with [ site-id = id ]
    let offset ifelse-value signal-coordination = "green wave (east-west)"
      [ (cycle-length * 100 - round (mean [col] of members * BLOCK-W / vmax)) mod cycle-length ]
      [ random cycle-length ]
    ask members [ set cycle-offset offset ]
    set site-offsets replace-item id site-offsets offset
    set site-approaches replace-item id site-approaches approaches-to members
  ]
  update-signals
  ask roads [
    set free-tt compute-free-tt
    set tt-ema free-tt
    set cost-live free-tt
  ]
end"""


def add_state_and_setup(code):
    """New breeds, globals and link/node variables, and the new Setup steps."""
    code = code.replace(
        "breed [ cars car ]",
        "breed [ cars car ]\nbreed [ map-labels map-label ]\nbreed [ painters painter ]",
    )
    code = code.replace(
        "  ;; ---- physical constants ----",
        "  selected-street selected-block baseline-signature baseline-summary\n"
        "  generated-total completed-total run-finished? demand-seed\n"
        "  ;; ---- real traffic (see real_traffic.nls) ----\n"
        "  data-version signal-sites count-sites weekday-counts weekend-counts zone-groups\n"
        "  weekday-trips weekend-trips weekday-scales weekend-scales\n"
        "  active-day-type run-start-s trips-hour hour-trips hour-totals\n"
        "  zone-points zone-set site-roads site-offsets site-shares site-approaches\n"
        "  ;; ---- physical constants ----",
        1,
    )
    # The made-up grid, entry weights and car parks are gone.
    code = swap(
        code,
        "  ew-config ns-config carpark-config no-car-segments\n"
        "  node-grid          ;; node-grid: item col -> item row -> node\n"
        "  dests              ;; list of destination nodes; index = dest-id\n"
        "  gates carparks signals\n"
        "  gate-weight-sum\n",
        "  dests              ;; destination groups; a node's dest-id is its group, -1 if none\n"
        "  gates carparks signals\n",
    )
    code = code.replace("nodes-own [", "nodes-own [\n  map-id zone-group site-id", 1)
    code = code.replace("roads-own [", "roads-own [\n  geometry seg-ends posted-speed within-site?", 1)
    code = code.replace(
        "  setup-constants",
        "  set run-finished? false\n"
        "  set generated-total 0 set completed-total 0\n"
        "  set demand-seed ifelse-value fixed-seed? [seed] [random 1000000]\n"
        '  if not is-string? selected-street [set selected-street "Collins St"]\n'
        "  setup-constants\n"
        "  load-real-traffic",
        1,
    )
    code = swap(code, "  setup-config\n  draw-background\n  build-network", BUILD_REAL_MAP)
    code = code.replace("  setup-signals\n", "  reset-ticks\n  setup-signals\n", 1)
    code = code.replace(
        'if closure-street != "none" and closure-start-min = 0',
        "if scheduled-closure? and closure-start-min = 0",
    )
    code = swap(
        code,
        '  output-print "Hoddle Grid prototype ready."',
        '  output-print (word "Melbourne CBD traffic ready: " day-type " from " start-time ", shaped by SCATS counts.")',
    )
    code = code.replace("  set node-kind kind", "  set map-id who\n  set zone-group -1\n  set site-id -1\n  set node-kind kind", 1)
    code = code.replace(
        "      set street nm",
        "      set geometry (list (list [xcor] of a [ycor] of a) (list [xcor] of b [ycor] of b))\n"
        "      set posted-speed speed-limit-kmh\n"
        "      set within-site? false\n"
        "      set street nm",
        1,
    )
    # Real roads have their own posted speed limits.
    code = code.replace("[ vmax ])", "[ min (list vmax (posted-speed / 3.6)) ])", 1)
    return code


def remove_made_up_grid(code):
    """Take out the original's schematic street grid, which the real map replaces."""
    for name in ["setup-config", "draw-background", "short-name", "build-network", "node-at", "make-gate"]:
        code = remove_procedure(code, name)
    code = replace_procedure(code, "node-name", NODE_NAME)
    code = replace_procedure(code, "is-hook?", NO_HOOK_TURNS)
    return code


def share_signal_controllers(code):
    """One controller per intersection; cars already inside it do not stop again."""
    code = replace_procedure(code, "setup-signals", SETUP_SIGNALS)
    code = replace_procedure(code, "update-signals", UPDATE_SIGNALS)
    code = swap(
        code,
        '  if [signalised?] of end2 and axis != "access" [',
        '  if [signalised?] of end2 and axis != "access" and not within-site? [',
    )
    code = swap(code, "  if [signalised?] of n [\n", "  if [signalised?] of n and not [within-site?] of L and [axis] of L != \"access\" [\n")
    # Car park driveways have no traffic light of their own: they give way.
    code = swap(code, "  if not [signalised?] of n [\n    let r [rank] of L", "  if not [signalised?] of n or [axis] of L = \"access\" [\n    let r [rank] of L")
    return code


def fix_run_loop(code):
    """Print the final report once, count every finished trip and keep cars on their road."""
    code = code.replace(
        "  if ticks >= warm-up-s + measure-s [ final-report stop ]",
        "  if ticks >= warm-up-s + measure-s [ if not run-finished? [final-report set run-finished? true] stop ]",
    )
    code = code.replace(
        'if not closure-applied? and closure-street != "none" and ticks >= closure-start-min * 60',
        "if not closure-applied? and scheduled-closure? and ticks >= closure-start-min * 60",
    )
    code = code.replace(
        "  report (word [who] of end1 \"-\" [who] of end2)",
        "  report (word [map-id] of end1 \"-\" [map-id] of end2)",
    )
    code = code.replace("set color 0 set thickness 1.4", "set color 15 set thickness 1.4")
    code = code.replace(
        "  set pos max list 0 (min list p g)",
        "  set pos max list 0 (min (list p g ([len] of L - 0.01)))",
    )
    code = code.replace(
        "  ifelse arrived? [\n    if measuring?",
        "  ifelse arrived? [\n    set completed-total completed-total + 1\n    if measuring?",
    )
    return code


def fix_routing(code):
    """Only offer routes that can reach the destination, which is now a group of places."""
    code = code.replace(
        "  if any? cands with [ end2 != back-node ]",
        "  let live? informed?\n"
        "  set cands cands with [ifelse-value live? [item k [dist-live] of end2 < BIG] [item k [dist-free] of end2 < BIG]]\n"
        "  if any? cands with [ end2 != back-node ]",
    )
    code = code.replace("  let live? informed?\n  let best", "  let best")
    # A trip ends at the first place of its destination group it reaches.
    code = swap(code, "  if n = dest [ report nobody ]", "  if [dest-id] of n = dest [ report nobody ]")
    code = swap(code, "  let k [dest-id] of dest", "  let k dest")
    code = swap(code, '[node-kind] of end2 = "grid" or end2 = d', '[node-kind] of end2 = "grid" or [dest-id] of end2 = d')
    code = swap(code, "    let arrived? [end2] of L = dest", "    let arrived? [dest-id] of [end2] of L = dest")
    # Distances are measured to the nearest place in each group.
    code = swap(code, "    let target item k dests\n", "")
    code = swap(code, "    ask target [ set tmp-dist 0 ]\n", "    ask nodes with [ dest-id = k ] [ set tmp-dist 0 ]\n")
    code = swap(code, "    let open-set (turtle-set target)", "    let open-set nodes with [ dest-id = k ]")
    code = swap(code, '      if u = target or [node-kind] of u = "grid" [', '      if [dest-id] of u = k or [node-kind] of u = "grid" [')
    return code


def fix_demand(code):
    """Trips come from the SCATS-shaped data and use their own random numbers."""
    code = replace_procedure(code, "generate-demand", GENERATE_DEMAND)
    code = replace_procedure(code, "setup-routing", SETUP_ROUTING)
    code = remove_procedure(code, "pick-dest")
    code = remove_procedure(code, "weighted-pick")
    code = swap(code, "item ([dest-id] of d) ([dist-base] of g)", "item d ([dist-base] of g)")
    code = swap(code, "item ([dest-id] of d) ([dist-free] of g)", "item d ([dist-free] of g)")
    code = swap(code, "report sum [ length gate-queue ] of gates", "report sum [ length gate-queue ] of zone-set")
    # A car waiting at a gate with no possible route is counted as stranded.
    code = code.replace(
        "  if not [any-lane-room?] of out [ stop ]",
        "  if out = nobody [stop]\n"
        "  let waiting-dest item 1 first gate-queue\n"
        "  if item waiting-dest dist-free >= BIG [\n"
        "    set gate-queue but-first gate-queue\n"
        "    set stranded-count stranded-count + 1\n"
        "    stop\n"
        "  ]\n"
        "  if not [usable? and any-lane-room?] of out [stop]",
    )
    return code


def add_real_geometry_and_closures(code):
    """Cars follow real road shapes; closures work on whole streets or sections."""
    code = replace_procedure(code, "place-car", PLACE_CAR)
    # A car standing still, already drawn red, does not need drawing again.
    code = swap(
        code,
        "    ifelse can-go? [ do-transfer (pos - Llen) ] [ hold-at-line ]\n  ] [\n    place-car\n  ]",
        "    ifelse can-go? [ do-transfer (pos - Llen) ] [ hold-at-line ]\n  ] [\n    if speed > 0 or color != 15 [ place-car ]\n  ]",
    )

    start = code.index("to apply-scenario-closure\n")
    end = code.index(";; =====================================================================\n;;  OUTPUT", start)
    closures = (MODEL_FOLDER / "closures.nls").read_text()
    code = code[:start] + closures + "\n" + code[end:]
    return code


def fix_baseline_and_output(code):
    """Baseline rules, colours and export names for the combined model."""
    code = code.replace(
        "  if measured-seconds < 60 [",
        "  if any? roads with [closed? or lanes-open < lanes] [\n"
        '    user-message "Reopen all roads and run a fresh baseline before saving."\n'
        "    stop\n"
        "  ]\n"
        "  if measured-seconds < 60 [",
        1,
    )
    code = code.replace(
        "  set baseline table:make\n  let hrs",
        "  set baseline-signature scenario-signature\n"
        "  set baseline-summary (list trips-done mean-trip-time-min queued-at-gates stranded-count measured-seconds)\n"
        "  set baseline table:make\n"
        "  let hrs",
        1,
    )
    code = code.replace(
        "      [ ;; change vs baseline",
        '      baseline-signature = "" [set color gray]\n      [ ;; change vs baseline',
    )
    code = code.replace("  ask roads with [ not hidden? ] [", "  ask roads [", 1)

    # After colouring, redraw the real road shapes instead of straight lines.
    position = code.index("\nend", code.index("to update-link-colors"))
    code = code[:position] + "\n  draw-osm-roads" + code[position:]

    code = code.replace('  let fname "hoddle-link-results.csv"', '  let fname "combined-link-results.csv"')
    return code


def main():
    original = ElementTree.parse(ORIGINAL_MODEL).getroot()
    code = original.find("code").text

    code = add_state_and_setup(code)
    code = fix_run_loop(code)
    code = fix_routing(code)
    code = fix_demand(code)
    code = add_real_geometry_and_closures(code)
    code = fix_baseline_and_output(code)
    code = remove_made_up_grid(code)
    code = share_signal_controllers(code)
    code = code + "\n" + (MODEL_FOLDER / "osm_network.nls").read_text()
    code = code + "\n" + (MODEL_FOLDER / "real_traffic.nls").read_text()
    (MODEL_FOLDER / "combined.nls").write_text(code)
    print("Merged", len(code.splitlines()), "lines")


if __name__ == "__main__":
    main()
