import org.nlogo.headless.HeadlessWorkspace;
public class SmokeTest {
 public static void main(String[] args) throws Exception {
  HeadlessWorkspace w=HeadlessWorkspace.newInstance();
  try {
   w.open(args[0]);
   w.command("setup");
   System.out.println("Setup: " + w.report("(list count junctions count roads count cars)"));
   w.command("set close-whole-street? true set selected-road one-of roads with [street = \"Collins Street\"]");
   w.command("let mx mean [xcor] of [both-ends] of selected-road let my mean [ycor] of [both-ends] of selected-road handle-map-pointer false true mx my handle-map-pointer true true mx my");
   if (!w.report("any? roads with [closed?]").equals(true)) throw new Exception("Map click did not close");
   w.command("handle-map-pointer true true 0 0");
   if (!w.report("any? roads with [closed?]").equals(true)) throw new Exception("Held mouse toggled twice");
   w.command("let mx mean [xcor] of [both-ends] of selected-road let my mean [ycor] of [both-ends] of selected-road handle-map-pointer false true mx my handle-map-pointer true true mx my");
   if (!w.report("not any? roads with [closed?]").equals(true)) throw new Exception("Second map click did not reopen");
   w.command("setup");
   w.command("repeat 300 [go]");
   System.out.println("Baseline: " + w.report("(list ticks count cars completed failed-trips average-trip-seconds)"));
   if (!w.report("completed > 0 and failed-trips = 0").equals(true)) throw new Exception("Baseline routing failed");
   w.command("set selected-street \"Collins Street\" close-selected-street set selected-street \"Bourke Street\" close-selected-street");
   if (!w.report("length closed-streets = 2 and selected-street-status = \"Closed\"").equals(true)) throw new Exception("Multiple closures failed");
   w.command("reopen-selected-street");
   if (!w.report("closed-streets = [\"Collins Street\"] and selected-street-status = \"Open\"").equals(true)) throw new Exception("Selective reopen failed");
   w.command("ask one-of roads with [street = selected-street] [set closed? true]");
   if (!w.report("selected-street-status = \"Partly closed\"").equals(true)) throw new Exception("Partial status failed");
   w.command("reopen-selected-street repeat 300 [go]");
   if (!w.report("any? roads with [closed?]").equals(true)) throw new Exception("Closure failed");
   System.out.println("Closure: " + w.report("(list ticks count cars completed failed-trips count roads with [closed?])"));
   w.command("reopen-all repeat 60 [go]");
   if (!w.report("all? roads [not closed?]").equals(true)) throw new Exception("Reopen failed");
   w.command("export-view \"preview.png\"");
   w.command("ask roads [set closed? true] ask cars [die] spawn-car");
   if (!w.report("not any? cars").equals(true)) throw new Exception("Spawn ignored closure");
  } finally {w.dispose();}
 }
}
