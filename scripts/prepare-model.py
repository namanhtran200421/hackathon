"""Adapt desktop I/O only; preserve the model's traffic and routing procedures."""
from pathlib import Path
import re
import xml.etree.ElementTree as E
root = Path(__file__).resolve().parent.parent
model = E.parse(root / 'combined/Melbourne Traffic Combined.nlogox').getroot()
code = model.find('code').text
nodes, edges = (root / 'combined/data/map.txt').read_text().splitlines()
old = 'file-open "data/map.txt"\n  let node-data file-read\n  let edge-data file-read\n  file-close'
assert old in code, 'Desktop map-loading procedure changed; review the adapter.'
code = code.replace(old, f'let node-data {nodes}\n  let edge-data {edges}')
for name in ['choose-street', 'choose-section', 'export-link-results']:
    code, count = re.subn(r'^to ' + name + r'\n.*?^end', f'to {name}\nend', code, flags=re.S | re.M)
    assert count == 1, f'Expected exactly one {name} procedure'
# Rendering is owned by the web SVG. Avoid generating drawing updates on the server.
for name in ['draw-background', 'draw-osm-roads']:
    code, count = re.subn(r'^to ' + name + r'\n.*?^end', f'to {name}\nend', code, flags=re.S | re.M)
    assert count == 1
# The web keeps a saved baseline across Setup, even when settings change, so one
# open-road run can be reused as the reference for later scenarios. The page lists
# any settings that differ from the baseline's. A different network simply has no
# matching links, so street comparisons show zero there.
old = """  if baseline-signature != scenario-signature [
    set baseline table:make
    set baseline-signature ""
    set baseline-summary []
  ]
"""
assert old in code, 'Baseline invalidation in setup changed; review the adapter.'
code = code.replace(old, '')
# Browser storage restores a saved baseline after a reload; Clear baseline removes it.
code += """

to restore-baseline [pairs summary signature]
  set baseline table:make
  foreach pairs [kv -> table:put baseline item 0 kv item 1 kv]
  set baseline-summary summary
  set baseline-signature signature
  ask roads [ set base-count ifelse-value table:has-key? baseline link-key [ table:get baseline link-key ] [ 0 ] ]
  update-link-colors
end

to clear-baseline
  set baseline table:make
  set baseline-signature ""
  set baseline-summary []
  ask roads [ set base-count 0 ]
  update-link-colors
  output-print "Baseline cleared."
end
"""
model.find('code').text = 'WEB_CODE_PLACEHOLDER'
xml = E.tostring(model, encoding='unicode').replace('WEB_CODE_PLACEHOLDER', '<![CDATA[' + code + ']]>')
(root / 'simulation-runtime/model.nlogox').write_text(xml)
