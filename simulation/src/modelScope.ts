/**
 * The NetLogo Web engine and the compiled model live in a global scope: the
 * browser worker's `self`, or a Node sandbox in the tests. These types describe
 * the few parts of that scope the controls use.
 */

interface NetLogoObserver {
  getGlobal(name: string): unknown;
  setGlobal(name: string, value: unknown): void;
}

interface NetLogoWorld {
  observer: NetLogoObserver;
  ticker: { tickCount(): number };
}

interface NetLogoWorkspace {
  rng: { withClone<Result>(action: () => Result): Result };
}

interface ProcedureCaller {
  callCommand(name: string, ...inputs: unknown[]): unknown;
}

/** The read-only questions compiled by build/compile-model.ts. */
export type ReporterName =
  | "metrics"
  | "cars"
  | "roads"
  | "styles"
  | "nodes"
  | "labels"
  | "bounds"
  | "csv"
  | "baseline"
  | "conservation";

/** How the model prints text and shows messages (NetLogo Web's "modelConfig"). */
export interface ModelConfig {
  output: { write(text: unknown): void; clear(): void };
  print: { write(text: unknown): void };
  dialog: {
    notify(message: unknown): void;
    confirm(message: unknown): boolean;
    yesOrNo(): boolean;
    input(): string;
  };
}

/** The global scope once the engine, model and reporters are loaded. */
export interface ModelScope {
  world: NetLogoWorld;
  workspace: NetLogoWorkspace;
  ProcedurePrims: ProcedureCaller;
  TRAFFIC_REPORTERS: Record<ReporterName, () => unknown>;
}

/**
 * The NetLogo compiler normally defines a "nobody" value that the engine checks
 * against. We only ship the engine, so add the same kind of object ourselves.
 * Call this before the model runs.
 */
export function installNobody(scope: object): void {
  const target = scope as { Nobody?: unknown };
  if (target.Nobody !== undefined) {
    return;
  }
  target.Nobody = {
    id: -1,
    isDead: function () {
      return true;
    },
    toString: function () {
      return "nobody";
    },
    getBreedName: function () {
      return "nobody";
    },
    ask: function () {},
  };
}
