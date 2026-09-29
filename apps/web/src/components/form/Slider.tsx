/**
 * A labelled slider for one numeric setting. Its range, step, unit and words
 * come from the setting's rules and labels.
 */

import type { ReactNode } from "react";
import type { NumberSettingName } from "@traffic-lab/simulation";
import { twoDp } from "../../lib/format";
import { sliderInfo } from "../../features/settings/labels";
import RestartTag from "./RestartTag";

interface SliderProps {
  name: NumberSettingName;
  value: number;
  onChange: (value: number) => void;
  needsRestart?: boolean;
  disabled?: boolean;
  /** Replaces the value shown next to the label. */
  display?: string;
  /** Replaces the explanation under the slider; null hides it. */
  help?: ReactNode;
}

export default function Slider({
  name,
  value,
  onChange,
  needsRestart,
  disabled,
  display,
  help,
}: SliderProps) {
  const info = sliderInfo(name);
  const id = "control-" + name.replace(/[^a-z0-9]+/gi, "-");

  let shown = display;
  if (shown === undefined) {
    shown = twoDp(value);
    if (info.unit) {
      shown = shown + " " + info.unit;
    }
  }

  let explanation: ReactNode = info.help;
  if (help !== undefined) {
    explanation = help;
  }

  return (
    <div className="field">
      <div className="label-row">
        <label htmlFor={id}>
          {info.label}
          {needsRestart && <RestartTag />}
        </label>
        <span className="value">{shown}</span>
      </div>
      <input
        id={id}
        type="range"
        min={info.min}
        max={info.max}
        step={info.step}
        value={value}
        disabled={disabled}
        aria-valuetext={shown}
        onChange={function (event) {
          onChange(Number(event.target.value));
        }}
      />
      {explanation && <p className="help">{explanation}</p>}
    </div>
  );
}
