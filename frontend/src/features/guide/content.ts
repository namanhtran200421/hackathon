/**
 * The words in the Quick guide.
 */

/** The seven steps: [title, explanation]. */
export const STEPS: [string, string][] = [
  [
    "Choose the day and time",
    "Pick a weekday or a weekend day and the time counting should start, then press Restart. The traffic follows real SCATS counts for that time, and the warm-up runs just before it so the streets are already busy when counting starts.",
  ],
  [
    "Start the traffic",
    "Press Start to set the traffic moving and Pause to stop it. Step 1 second moves time forward by one second. Real traffic data, under Settings, shows how closely the simulated traffic matches the counts.",
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
    "First run with every road open until the warm-up is over plus at least one minute, then press Save baseline. The baseline is kept in this browser and used for every later run, so save a new one when you change the day or time. To test a closure, press Restart (this reopens every road), close your street and press Start. The results below the map compare the two runs.",
  ],
  [
    "Read the map",
    "In the Traffic jams view, roads turn yellow, orange and then dark red as they fill up. Traffic volume shows how many cars use each road. Change from baseline shows roads with more traffic than normal in orange and less in blue. Closed roads are red dashes. Hover over a road to see its numbers.",
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
  ["day-type, start-time", "Day and time"],
  ["informed-drivers-%, seed, fixed-seed?", "Scenario"],
  ["Choose street, Choose section, closure-type", "Road closures"],
  ["Apply closure, Reopen selected, Reopen all", "Road closures"],
  ["Click roads, close-whole-street?", "Road closures"],
  ["scheduled-closure?, closure-start-min", "Road closures"],
  [
    "speed-limit-kmh, cycle-length, adaptive-signals?, ew-green-share, signal-coordination",
    "Traffic lights & speed",
  ],
  ["reroute-interval, route-noise", "Route choice"],
  ["warm-up-s, measure-s", "Counting"],
  ["Save baseline, Export CSV", "Compare with normal traffic"],
  ["Cars, Waiting to enter, Completed, Mean trip, Stranded, Elapsed", "The yellow figures under the map"],
  ["Time of day, Trips per hour now, SCATS match", "Real traffic data"],
  ["Selected extent, Closures", "Road closures"],
  ["Output area", "Simulation log"],
  ["Info tab", "About the model, below"],
];
