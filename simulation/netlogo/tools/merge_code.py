"""Recreate code/combined.nls from the team's original Hoddle Grid model.

The combined model started as the groupmate's Hoddle Grid prototype. This script
applies every change we made to it, one small edit at a time, and then adds our
closure controls (code/closures.nls) and the real OpenStreetMap network loader
(code/osm_network.nls).

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


GENERATE_DEMAND = """to generate-demand
  with-local-randomness [
    random-seed (demand-seed + ticks * 104729)
    let rate demand-veh-per-hour / 3600
    foreach sort gates [g -> ask g [
      repeat random-poisson (rate * weight / gate-weight-sum) [
        set generated-total generated-total + 1
        let d pick-dest self
        ifelse d = nobody [set stranded-count stranded-count + 1]
          [set gate-queue lput (list ticks d) gate-queue]
      ]
    ]]
  ]
  ask gates with [not empty? gate-queue] [try-release]
end"""

PLACE_CAR = """to place-car
  let point point-along geometry-of-car pos
  let h item 2 point
  let off 0.35 + ([lanes] of cur-link - 1 - lane) * 0.35
  setxy (item 0 point + off * sin (h - 90)) (item 1 point + off * cos (h - 90))
  set heading h
  set color (ifelse-value speed < 0.5 [15] speed < vmax * 0.5 [25] [103])
end

to-report geometry-of-car
  report [geometry] of cur-link
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

CHOOSE_NETWORK = """  ifelse active-network = "Real OSM map" [
    resize-world -120 120 -102 102
    ask patches [set pcolor [22 29 39]]
    build-osm-network
  ] [
    resize-world -30 172 -14 94
    draw-background
    build-network
  ]
  if baseline-signature != scenario-signature [
    set baseline table:make
    set baseline-signature ""
    set baseline-summary []
  ]"""


def add_state_and_setup(code):
    """New breeds, globals and link/node variables, and the new Setup steps."""
    code = code.replace(
        "breed [ cars car ]",
        "breed [ cars car ]\nbreed [ map-labels map-label ]\nbreed [ painters painter ]",
    )
    code = code.replace(
        "  ;; ---- physical constants ----",
        "  selected-street selected-block baseline-signature baseline-summary\n"
        "  generated-total completed-total run-finished? active-network demand-seed\n"
        "  ;; ---- physical constants ----",
        1,
    )
    code = code.replace("nodes-own [", "nodes-own [\n  map-id", 1)
    code = code.replace("roads-own [", "roads-own [\n  geometry posted-speed", 1)
    code = code.replace(
        "  setup-constants",
        "  set active-network network-source\n"
        "  set run-finished? false\n"
        "  set generated-total 0 set completed-total 0\n"
        "  set demand-seed ifelse-value fixed-seed? [seed] [random 1000000]\n"
        '  if not is-string? selected-street [set selected-street "Collins St"]\n'
        "  setup-constants",
        1,
    )
    # Setup can now build either the real map or the original schematic grid.
    code = code.replace("  draw-background\n  build-network", CHOOSE_NETWORK)
    code = code.replace("  setup-signals\n", "  reset-ticks\n  setup-signals\n", 1)
    code = code.replace(
        'if closure-street != "none" and closure-start-min = 0',
        "if scheduled-closure? and closure-start-min = 0",
    )
    code = code.replace(
        "Hoddle Grid prototype ready.",
        "Combined Melbourne traffic simulator ready. Synthetic demand and signals.",
    )
    code = code.replace("  set node-kind kind", "  set map-id who\n  set node-kind kind", 1)
    code = code.replace(
        "      set street nm",
        "      set geometry (list (list [xcor] of a [ycor] of a) (list [xcor] of b [ycor] of b))\n"
        "      set posted-speed speed-limit-kmh\n"
        "      set street nm",
        1,
    )
    # Real roads have their own posted speed limits.
    code = code.replace("[ vmax ])", "[ min (list vmax (posted-speed / 3.6)) ])", 1)
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
        "  report (word active-network \":\" [map-id] of end1 \"-\" [map-id] of end2)",
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
    """Only offer routes that can actually reach the destination."""
    code = code.replace(
        "  if any? cands with [ end2 != back-node ]",
        "  let live? informed?\n"
        "  set cands cands with [ifelse-value live? [item k [dist-live] of end2 < BIG] [item k [dist-free] of end2 < BIG]]\n"
        "  if any? cands with [ end2 != back-node ]",
    )
    code = code.replace("  let live? informed?\n  let best", "  let best")
    return code


def fix_demand(code):
    """Demand uses its own random numbers, so routing cannot change who arrives."""
    code = replace_procedure(code, "generate-demand", GENERATE_DEMAND)
    code = code.replace("([dist-free] of g) < BIG", "([dist-base] of g) < BIG")
    code = code.replace("    if item ([dest-id] of d)", "    if d != nobody and item ([dest-id] of d)")
    # A car waiting at a gate with no possible route is counted as stranded.
    code = code.replace(
        "  if not [any-lane-room?] of out [ stop ]",
        "  if out = nobody [stop]\n"
        "  let waiting-dest item 1 first gate-queue\n"
        "  if item [dest-id] of waiting-dest dist-free >= BIG [\n"
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
    code = code[:position] + '\n  if active-network = "Real OSM map" [draw-osm-roads]' + code[position:]

    code = code.replace(
        '  if [node-kind] of n = "grid" [',
        '  if active-network = "Real OSM map" [report (word [node-kind] of n " " [map-id] of n)]\n'
        '  if [node-kind] of n = "grid" [',
    )
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
    code = code + "\n" + (MODEL_FOLDER / "osm_network.nls").read_text()

    (MODEL_FOLDER / "combined.nls").write_text(code)
    print("Merged", len(code.splitlines()), "lines")


if __name__ == "__main__":
    main()
