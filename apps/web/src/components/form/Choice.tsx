/**
 * A labelled drop-down list. `options` is a list of [value, text people see].
 */

import type { ReactNode } from "react";
import RestartTag from "./RestartTag";

interface ChoiceProps<Value extends string> {
  id: string;
  label: string;
  value: Value;
  options: [Value, string][];
  onChange: (value: Value) => void;
  needsRestart?: boolean;
  disabled?: boolean;
  help?: ReactNode;
}

export default function Choice<Value extends string>(props: ChoiceProps<Value>) {
  return (
    <div className="field">
      <label htmlFor={props.id}>
        {props.label}
        {props.needsRestart && <RestartTag />}
      </label>
      <select
        id={props.id}
        value={props.value}
        disabled={props.disabled}
        onChange={function (event) {
          props.onChange(event.target.value as Value);
        }}
      >
        {props.options.map(function (option) {
          return (
            <option key={option[0]} value={option[0]}>
              {option[1]}
            </option>
          );
        })}
      </select>
      {props.help && <p className="help">{props.help}</p>}
    </div>
  );
}
