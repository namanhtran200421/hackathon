"""Make a browser version of the desktop model.

The browser runs the same NetLogo code as the desktop model. Only the parts that
need a desktop computer are changed:

  * The road map is written straight into the code, because a browser cannot
    open data/map.txt from disk.
  * The desktop pop-up dialogs (Choose street, Choose section) and the CSV file
    export do nothing here. The web page has its own lists and download button.
  * The desktop drawing procedures do nothing. The web page draws the map itself.
  * A saved baseline is kept when you press Setup, even if settings change, so
    one "normal traffic" run can be reused for later scenarios. The web page
    lists any settings that differ from the baseline.
  * Two small procedures let the web page restore a baseline after a reload
    and clear it on request.

Traffic movement, demand, traffic lights and route choice are not touched.

This writes build/model.nlogox, which compile-model.ts then turns into
JavaScript. Run both with:  npm run model:web
"""

from pathlib import Path
import re
import xml.etree.ElementTree as ElementTree


NETLOGO_FOLDER = Path(__file__).resolve().parent.parent / "netlogo"
DESKTOP_MODEL = NETLOGO_FOLDER / "Melbourne Traffic Combined.nlogox"
MAP_FILE = NETLOGO_FOLDER / "data" / "map.txt"
OUTPUT = Path(__file__).resolve().parent / "model.nlogox"

LOAD_MAP_FROM_DISK = 'file-open "data/map.txt"\n  let node-data file-read\n  let edge-data file-read\n  file-close'

FORGET_BASELINE_ON_SETUP = """  if baseline-signature != scenario-signature [
    set baseline table:make
    set baseline-signature ""
    set baseline-summary []
  ]
"""

WEB_PROCEDURES = """

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


def empty_procedure(code, name):
    """Keep a procedure's name but remove everything it does."""
    pattern = r"^to " + name + r"\n.*?^end"
    code, count = re.subn(pattern, "to " + name + "\nend", code, flags=re.S | re.M)
    if count != 1:
        raise ValueError("Expected exactly one procedure called " + name)
    return code


def main():
    model = ElementTree.parse(DESKTOP_MODEL).getroot()
    code = model.find("code").text

    if LOAD_MAP_FROM_DISK not in code:
        raise ValueError("The desktop map-loading code changed. Please review this script.")
    nodes, edges = MAP_FILE.read_text().splitlines()
    code = code.replace(LOAD_MAP_FROM_DISK, "let node-data " + nodes + "\n  let edge-data " + edges)

    for name in ["choose-street", "choose-section", "export-link-results", "draw-background", "draw-osm-roads"]:
        code = empty_procedure(code, name)

    if FORGET_BASELINE_ON_SETUP not in code:
        raise ValueError("The baseline code in setup changed. Please review this script.")
    code = code.replace(FORGET_BASELINE_ON_SETUP, "")
    code = code + WEB_PROCEDURES

    # ElementTree would escape the code; wrap it in CDATA like NetLogo does.
    model.find("code").text = "WEB_CODE_PLACEHOLDER"
    xml = ElementTree.tostring(model, encoding="unicode")
    xml = xml.replace("WEB_CODE_PLACEHOLDER", "<![CDATA[" + code + "]]>")
    OUTPUT.write_text(xml)
    print("Prepared", OUTPUT.name)


if __name__ == "__main__":
    main()
