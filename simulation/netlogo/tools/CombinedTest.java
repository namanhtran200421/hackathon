import org.nlogo.headless.HeadlessWorkspace;
// Headless test of the desktop model: real traffic, paired demand, baseline, closures, clicks and export.
public class CombinedTest {
 static HeadlessWorkspace w;
 static void check(String expression, String message) throws Exception {
  if (!Boolean.TRUE.equals(w.report(expression))) throw new Exception(message+": "+expression);
 }
 public static void main(String[] args) throws Exception {
  w=HeadlessWorkspace.newInstance();
  try {
   w.open(args[0]);
   // Light 3 am traffic keeps the test quick.
   w.command("set start-time \"03:00\" set warm-up-s 60 setup");
   check("clock-seconds = 3 * 3600 - 60", "Clock does not start one warm-up before the start time");
   check("count nodes with [signalised?] = sum map length signal-sites", "Signals are not only at the DTP sites");
   check("count gates + count carparks = length zone-groups", "Trip ends do not match the data");
   check("any? roads with [street = \"King St\"] and any? roads with [street = \"Wurundjeri Way\"]", "Trunk roads missing");
   w.command("repeat 360 [go]");
   System.out.println("Real traffic baseline " + w.report("(list ticks clock-label count cars generated-total completed-total stranded-count queued-at-gates scats-comparison)"));
   check("completed-total > 0", "No completed trips");
   check("generated-total = completed-total + stranded-count + count cars + queued-at-gates", "Vehicle conservation failed");
   check("item 0 scats-comparison = length count-sites and item 3 scats-comparison > 0", "No comparison with the SCATS counts");
   double demand=((Number)w.report("generated-total")).doubleValue();
   w.command("save-baseline");
   check("baseline-signature != \"\"", "Baseline not saved");
   w.command("setup");
   check("baseline-signature != \"\"", "Baseline did not survive Setup");
   w.command("set selected-street \"Collins St\" set selected-block 0 close-selection repeat 360 [go]");
   check("generated-total = " + demand, "Demand differs between scenarios");
   check("all? selected-links [closed?]", "Street closure failed");
   check("generated-total = completed-total + stranded-count + count cars + queued-at-gates", "Closure conservation failed");
   w.command("set view-mode \"change vs baseline\" update-link-colors export-link-results export-view \"combined-preview.png\"");
   w.command("reopen-all");
   check("all? roads [not closed? and lanes-open = lanes]", "Capacity not restored");
   w.command("let L one-of roads with [lanes >= 2 and road-kind = \"main\"] set selected-street [street] of L set selected-block [seg] of L set closure-type \"One lane each direction\" close-selection");
   check("all? selected-links [lanes-open = lanes - 1]", "Lane reduction failed");
   w.command("reopen-selection");
   check("all? roads [not closed? and lanes-open = lanes]", "Lane reopening failed");
   // Test click debouncing at a real polyline midpoint, including while paused.
   w.command("set closure-type \"Both directions\" set close-whole-street? false let L max-one-of roads with [street = \"Collins St\"] [len] let pt point-along [geometry] of L ([len] of L / 2) handle-map-pointer false true item 0 pt item 1 pt handle-map-pointer true true item 0 pt item 1 pt");
   check("any? roads with [closed?]", "Map click failed");
   w.command("handle-map-pointer true true 0 0");
   check("any? roads with [closed?]", "Held click toggled again");
   // A different time of day is a different scenario: the desktop clears the baseline.
   w.command("reopen-all set start-time \"03:15\" setup");
   check("baseline-signature = \"\"", "Incompatible baseline retained");
   check("clock-seconds = 3 * 3600 + 15 * 60 - 60", "Clock ignores the new start time");
   w.command("set closure-type \"East / north direction\" set selected-street \"Collins St\" set selected-block 0 close-selection");
   check("any? selected-links with [closed?] and any? selected-links with [not closed?]", "Directional closure failed");
   w.command("reopen-all set scheduled-closure? true set closure-start-min 1 set closure-type \"Both directions\" setup repeat 180 [go]");
   check("closure-applied? and any? roads with [closed?]", "Scheduled closure failed");
   check("generated-total = completed-total + stranded-count + count cars + queued-at-gates", "Scheduled closure conservation failed");
   check("sum [sum map length lane-cars] of roads + sum [length hook-box] of nodes = count cars", "Vehicle membership failed");
   System.out.println("Scheduled closure " + w.report("(list ticks clock-label count cars generated-total completed-total stranded-count queued-at-gates)"));
   System.out.println("PASS: real traffic, clock, signals, paired demand, baseline, closures, lanes, clicks, export, vehicle conservation");
  } finally {w.dispose();}
 }
}
