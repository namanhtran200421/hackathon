/**
 * The small tag on settings that only take effect after Restart.
 */

export default function RestartTag() {
  return (
    <span className="setup-chip" title="Takes effect when you press Restart">
      <span aria-hidden="true">Restart</span>
      <span className="sr-only">(takes effect after Restart)</span>
    </span>
  );
}
