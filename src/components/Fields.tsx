"use client";
import type { ReactNode } from "react";
import { SLIDERS } from "@/lib/controls.mjs";

const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });

export function SetupChip() {
  return (
    <span className="setup-chip" title="Takes effect after you press Setup">
      <span aria-hidden="true">Setup</span>
      <span className="sr-only">(applies after Setup)</span>
    </span>
  );
}

export function Slider({
  name,
  value,
  onChange,
  setupOnly,
  disabled,
  display,
  help,
}: {
  name: keyof typeof SLIDERS;
  value: number;
  onChange: (value: number) => void;
  setupOnly?: boolean;
  disabled?: boolean;
  display?: string;
  help?: ReactNode;
}) {
  const spec = SLIDERS[name] as {
    label: string;
    min: number;
    max: number;
    step: number;
    unit: string;
    help?: string;
  };
  const id = `control-${String(name).replace(/[^a-z0-9]+/gi, "-")}`;
  const shown =
    display ?? `${number.format(value)}${spec.unit ? ` ${spec.unit}` : ""}`;
  return (
    <div className="field">
      <div className="label-row">
        <label htmlFor={id}>
          {spec.label}
          {setupOnly && <SetupChip />}
        </label>
        <span className="value">{shown}</span>
      </div>
      <input
        id={id}
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        disabled={disabled}
        aria-valuetext={shown}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {(help ?? spec.help) && <p className="help">{help ?? spec.help}</p>}
    </div>
  );
}

export function Toggle({
  id,
  label,
  checked,
  onChange,
  help,
  setupOnly,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  help?: ReactNode;
  setupOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="toggle-field">
      <label className="toggle" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-track" aria-hidden="true" />
        <span className="toggle-label">
          {label}
          {setupOnly && <SetupChip />}
        </span>
      </label>
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function Choice({
  id,
  label,
  value,
  options,
  onChange,
  setupOnly,
  disabled,
  help,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly (readonly string[])[];
  onChange: (value: string) => void;
  setupOnly?: boolean;
  disabled?: boolean;
  help?: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {setupOnly && <SetupChip />}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      {help && <p className="help">{help}</p>}
    </div>
  );
}
