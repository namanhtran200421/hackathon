/**
 * An on/off switch: a real checkbox with the switch role, drawn as a track.
 */

import type { ReactNode } from "react";
import RestartTag from "./RestartTag";

interface ToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: ReactNode;
  needsRestart?: boolean;
  disabled?: boolean;
}

export default function Toggle({ id, label, checked, onChange, help, needsRestart, disabled }: ToggleProps) {
  return (
    <div className="toggle-field">
      <label className="toggle" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={function (event) {
            onChange(event.target.checked);
          }}
        />
        <span className="toggle-track" aria-hidden="true" />
        <span className="toggle-label">
          {label}
          {needsRestart && <RestartTag />}
        </span>
      </label>
      {help && <p className="help">{help}</p>}
    </div>
  );
}
