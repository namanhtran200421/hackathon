from pathlib import Path
import re
R=Path(__file__).resolve().parent
s=(R/'hoddle-original.nls').read_text()
s=s.replace('breed [ cars car ]','breed [ cars car ]\nbreed [ map-labels map-label ]\nbreed [ painters painter ]')
s=s.replace('  ;; ---- physical constants ----','  selected-street selected-block baseline-signature baseline-summary\n  generated-total completed-total run-finished? active-network demand-seed\n  ;; ---- physical constants ----',1)
s=s.replace('nodes-own [','nodes-own [\n  map-id',1).replace('roads-own [','roads-own [\n  geometry posted-speed',1)
s=s.replace('  setup-constants','  set active-network network-source\n  set run-finished? false\n  set generated-total 0 set completed-total 0\n  set demand-seed ifelse-value fixed-seed? [seed] [random 1000000]\n  if not is-string? selected-street [set selected-street "Collins St"]\n  setup-constants',1)
s=s.replace('  draw-background\n  build-network','''  ifelse active-network = "Real OSM map" [
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
  ]''')
s=s.replace('  setup-signals\n', '  reset-ticks\n  setup-signals\n', 1)
s=s.replace('if closure-street != "none" and closure-start-min = 0','if scheduled-closure? and closure-start-min = 0')
s=s.replace('Hoddle Grid prototype ready.','Combined Melbourne traffic simulator ready. Synthetic demand and signals.')
s=s.replace('  set node-kind kind','  set map-id who\n  set node-kind kind',1)
s=s.replace('      set street nm','      set geometry (list (list [xcor] of a [ycor] of a) (list [xcor] of b [ycor] of b))\n      set posted-speed speed-limit-kmh\n      set street nm',1)
s=s.replace('[ vmax ])','[ min (list vmax (posted-speed / 3.6)) ])',1)
s=s.replace('  if ticks >= warm-up-s + measure-s [ final-report stop ]','  if ticks >= warm-up-s + measure-s [ if not run-finished? [final-report set run-finished? true] stop ]')
s=s.replace('if not closure-applied? and closure-street != "none" and ticks >= closure-start-min * 60','if not closure-applied? and scheduled-closure? and ticks >= closure-start-min * 60')
s=s.replace('  report (word [who] of end1 "-" [who] of end2)','  report (word active-network ":" [map-id] of end1 "-" [map-id] of end2)')
s=s.replace('set color 0 set thickness 1.4', 'set color 15 set thickness 1.4')
s=s.replace('  set pos max list 0 (min list p g)','  set pos max list 0 (min (list p g ([len] of L - 0.01)))')
s=s.replace('  ifelse arrived? [\n    if measuring?', '  ifelse arrived? [\n    set completed-total completed-total + 1\n    if measuring?')
s=s.replace('  report [trams?] of in-l', '  report [trams?] of in-l')
# Cache-free route candidates must actually be reachable; otherwise avoid falsely stranding a vehicle.
s=s.replace('  if any? cands with [ end2 != back-node ]', '''  let live? informed?
  set cands cands with [ifelse-value live? [item k [dist-live] of end2 < BIG] [item k [dist-free] of end2 < BIG]]
  if any? cands with [ end2 != back-node ]''')
s=s.replace('  let live? informed?\n  let best','  let best')
# Demand must not change just because route computation consumed random numbers.
def replace_proc(name,body):
 global s
 s,n=re.subn(r'(?m)^to(?:-report)? '+re.escape(name)+r'(?:\s[^\n]*)?\n.*?^end\s*$',body.strip(),s,count=1,flags=re.S|re.M)
 if n!=1:raise ValueError(name)
replace_proc('generate-demand','''to generate-demand
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
end''')
s=s.replace('([dist-free] of g) < BIG','([dist-base] of g) < BIG')
s=s.replace('    if item ([dest-id] of d)', '    if d != nobody and item ([dest-id] of d)')
# Gate closure should drain waiting demand into the stranded counter only if no path remains.
s=s.replace('  if not [any-lane-room?] of out [ stop ]','''  if out = nobody [stop]
  let waiting-dest item 1 first gate-queue
  if item [dest-id] of waiting-dest dist-free >= BIG [
    set gate-queue but-first gate-queue
    set stranded-count stranded-count + 1
    stop
  ]
  if not [usable? and any-lane-room?] of out [stop]''')
replace_proc('place-car','''to place-car
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
end''')
# Replace block-only scenario controls with shared whole-street / section controls.
a=s.index('to apply-scenario-closure\n');b=s.index(';; =====================================================================\n;;  OUTPUT',a)
s=s[:a]+(R/'closures.nls').read_text()+'\n'+s[b:]
s=s.replace('  if measured-seconds < 60 [','''  if any? roads with [closed? or lanes-open < lanes] [
    user-message "Reopen all roads and run a fresh baseline before saving."
    stop
  ]
  if measured-seconds < 60 [''',1)
s=s.replace('  set baseline table:make\n  let hrs', '  set baseline-signature scenario-signature\n  set baseline-summary (list trips-done mean-trip-time-min queued-at-gates stranded-count measured-seconds)\n  set baseline table:make\n  let hrs',1)
s=s.replace('      [ ;; change vs baseline','      baseline-signature = "" [set color gray]\n      [ ;; change vs baseline')
s=s.replace('  ask roads with [ not hidden? ] [', '  ask roads [',1)
# Once colors assigned, render real road geometry instead of straight graph chords.
pos=s.index('\nend',s.index('to update-link-colors'))
s=s[:pos]+'\n  if active-network = "Real OSM map" [draw-osm-roads]'+s[pos:]
s=s.replace('  if [node-kind] of n = "grid" [','  if active-network = "Real OSM map" [report (word [node-kind] of n " " [map-id] of n)]\n  if [node-kind] of n = "grid" [')
s=s.replace('  let fname "hoddle-link-results.csv"','  let fname "combined-link-results.csv"')
s=s.replace('    set cycle-offset ifelse-value','    set cycle-offset ifelse-value')
s += '\n'+(R/'osm_network.nls').read_text()
(R/'combined.nls').write_text(s)
print('Merged',len(s.splitlines()),'lines')
