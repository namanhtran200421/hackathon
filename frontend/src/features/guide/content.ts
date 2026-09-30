/**
 * The words in the Quick guide.
 */

/** The seven steps: [title, explanation]. */
export const STEPS: [string, string][] = [
  [
    "Start the traffic",
    "The road map is ready when the page opens. Press Start to set the traffic moving and Pause to stop it. Step 1 second moves time forward by one second.",
  ],
  [
    "Choose the speed, or keep it running",
    "The speed slider sets how fast time passes: 20× means 20 seconds of traffic every real second. Max goes as fast as your computer can. Normally the simulation stops at the end of the counting time. Turn on Keep running to let it go until you press Pause.",
  ],
  [
    "Close a street",
    "Pick a street, which part of it, and how to close it, then press Close this street. You can also turn on Close roads by clicking and click any road on the map; click it again to reopen it. Closures work straight away, even while the traffic is moving.",
  ],
  [
    "Compare with normal traffic",
    "First run with every road open until the warm-up is over plus at least one minute, then press Save baseline. You only need to do this once: the baseline is kept in this browser and used for every later run. To test a closure, press Restart (this reopens every road), close your street and press Start. The Report page compares the two runs.",
  ],
  [
    "Read the map",
    "In the Traffic jams view, roads turn yellow, orange and then dark red as they fill up. Traffic volume shows how many cars use each road. Change from baseline shows roads with more traffic than normal in orange and less in blue. Closed roads are red dashes. Hover over a road to see its numbers.",
  ],
  [
    "Plan road works",
    "On the Report page, describe the works: the street, how it is closed, how many hours of work, and when the crew can work. Find the best plan tests the works at quiet and busy times, each repeated with different random traffic, and recommends when to close the road and over how many shifts, with a range of likely delay. Watch it in the simulator sets the plan up on the map.",
  ],
  [
    "Download the numbers",
    "Download CSV saves the traffic on every road as a spreadsheet file, in the same format as the desktop model.",
  ],
];

/** Where each desktop NetLogo control is on this page: [NetLogo, this page]. */
export const WHERE_TO_FIND: [string, string][] = [
  ["Setup, Go / pause, Step 1 second", "Restart, Start / Pause, Step 1 second (under the map)"],
  ["NetLogo speed slider", "Simulation speed (under the map)"],
  ["view-mode", "View (above the map)"],
  ["network-source, seed, fixed-seed?", "Scenario"],
  ["demand-veh-per-hour, through-traffic-%, informed-drivers-%", "Scenario"],
  ["Choose street, Choose section, closure-type", "Road closures"],
  ["Apply closure, Reopen selected, Reopen all", "Road closures"],
  ["Click roads, close-whole-street?", "Road closures"],
  ["scheduled-closure?, closure-start-min", "Road closures"],
  [
    "speed-limit-kmh, cycle-length, ew-green-share, signal-coordination, hook-turns?",
    "Traffic lights & speed",
  ],
  ["reroute-interval, route-noise", "Route choice"],
  ["warm-up-s, measure-s", "Counting"],
  ["Save baseline, Export CSV", "Compare with normal traffic"],
  ["Cars, Waiting at gates, Completed, Mean trip, Stranded, Elapsed", "The yellow figures under the map"],
  ["Selected extent, Closures", "Road closures"],
  ["Output area", "Simulation log"],
  ["Info tab", "About the model, below"],
];
