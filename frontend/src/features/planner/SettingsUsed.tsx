/**
 * Which simulator settings a planner search used, and a warning when the
 * simulator's settings have changed since, so the plan may be out of date.
 */

import type { Settings } from "@traffic-lab/simulation";
import { describeSetting, settingLabel } from "../baseline/differences";
import { COPIED_SETTINGS, plannerSettings } from "./jobs";

interface SettingsUsedProps {
  used: Partial<Settings>;
  current: Settings;
}

export default function SettingsUsed({ used, current }: SettingsUsedProps) {
  const now = plannerSettings(current);
  const changed = COPIED_SETTINGS.filter(function (name) {
    return now[name] !== used[name];
  }).map(function (name) {
    return (
      settingLabel(name) + " " + describeSetting(name, used[name]) + " → " + describeSetting(name, now[name])
    );
  });

  return (
    <div className="settings-used">
      <p className="help">
        Uses the simulator&rsquo;s settings: {describeSetting("network-source", used["network-source"])},{" "}
        {describeSetting("demand-veh-per-hour", used["demand-veh-per-hour"])} at the busiest time of day,{" "}
        {describeSetting("informed-drivers-%", used["informed-drivers-%"])} of drivers using live traffic
        info.
      </p>
      {changed.length > 0 && (
        <p className="planner-note">
          <strong>The simulator&rsquo;s settings have changed since this search:</strong> {changed.join("; ")}
          . Press Find the best plan to update the plan.
        </p>
      )}
    </div>
  );
}
