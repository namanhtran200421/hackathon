/**
 * A labelled slider for any number, with the value shown in words next to
 * the label. (Slider is the version tied to a model setting.)
 */

import type { ReactNode } from "react";

interface RangeFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** The value in words, such as "6 hours". */
  display: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  help?: ReactNode;
}

export default function RangeField(props: RangeFieldProps) {
  return (
    <div className="field">
      <div className="label-row">
        <label htmlFor={props.id}>{props.label}</label>
        <span className="value">{props.display}</span>
      </div>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        aria-valuetext={props.display}
        onChange={function (event) {
          props.onChange(Number(event.target.value));
        }}
      />
      {props.help && <p className="help">{props.help}</p>}
    </div>
  );
}
