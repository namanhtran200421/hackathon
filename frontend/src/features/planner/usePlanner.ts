/**
 * The works planner's search, for the Report page.
 *
 * 1. Test the works at four traffic levels, repeated with different random
 *    seeds (the Monte Carlo part), in background workers.
 * 2. Rank every plan the limits allow (see plans.ts). The ranking updates as
 *    each repeat finishes, so the chart fills in while the search runs.
 * 3. Re-test the busiest hour of the best plans directly, at their real time
 *    of day, to check the estimate.
 *
 * Results are remembered (resultCache.ts), so repeating a search, or changing
 * only the limits or priority, is instant. The search lives above the pages,
 * so switching to the simulator does not stop it.
 */

import { useEffect, useRef, useState } from "react";
import type { ScenarioResult, Settings } from "@traffic-lab/simulation";
import { runBatch, workerCount, type Batch } from "./batchPool";
import type { SeedCurve } from "./delayCurve";
import { loadDayProfiles } from "./demandProfiles";
import {
  checkJobs,
  COUNT_SECONDS,
  levelJobs,
  plannerSettings,
  REPEATS,
  scenarioKey,
  seedsFor,
  WARM_UP_SECONDS,
  type Job,
} from "./jobs";
import { busiestHour, summarise, type PlanOutcome } from "./plans";
import { cachedResult, rememberResult, saveResults } from "./resultCache";
import { checksFrom, curvesFrom, worksFacts, type WorksFacts } from "./searchResults";
import type { DayProfiles, DirectCheck, WorksRequest } from "./types";

export type PlannerPhase = "idle" | "running" | "done" | "stopped" | "failed";

/** "levels" tests the traffic levels; "checks" re-tests the best plans directly. */
export type PlannerStage = "levels" | "checks";

export interface PlannerProgress {
  stage: PlannerStage;
  testsDone: number;
  testsTotal: number;
  /** How much of this stage's simulating is done, 0 to 1. */
  share: number;
  /** A rough estimate, once there is enough to go on. */
  secondsLeft: number | null;
}

export interface PlannerState {
  phase: PlannerPhase;
  request: WorksRequest | null;
  progress: PlannerProgress | null;
  curves: SeedCurve[];
  outcome: PlanOutcome | null;
  checks: DirectCheck[];
  facts: WorksFacts | null;
  /** Repeats the search was asked for (the outcome may use fewer if stopped). */
  repeatsWanted: number;
  error: string | null;
}

const IDLE: PlannerState = {
  phase: "idle",
  request: null,
  progress: null,
  curves: [],
  outcome: null,
  checks: [],
  facts: null,
  repeatsWanted: 0,
  error: null,
};

/** A rough time per background simulation, until real ones have been timed. */
const FIRST_GUESS_SECONDS = 20;

/** The search in progress: its jobs, what has finished, and the running batch. */
interface Search {
  request: WorksRequest;
  profiles: DayProfiles;
  base: Partial<Settings>;
  stage: PlannerStage;
  levelJobs: Job[];
  levelResults: (ScenarioResult | null)[];
  checkJobs: Job[];
  checkResults: (ScenarioResult | null)[];
  batch: Batch | null;
  finished: boolean;
}

export type Planner = ReturnType<typeof usePlanner>;

export function usePlanner(simulatorSettings: Settings | null) {
  const [state, setState] = useState<PlannerState>(IDLE);
  const [profiles, setProfiles] = useState<DayProfiles | null>(null);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const search = useRef<Search | null>(null);
  const secondsPerTest = useRef(FIRST_GUESS_SECONDS);
  const lastProgressUpdate = useRef(0);

  useEffect(function () {
    let current = true;
    loadDayProfiles()
      .then(function (loaded) {
        if (current) {
          setProfiles(loaded);
        }
      })
      .catch(function (error: unknown) {
        if (current) {
          setProfilesError(String((error as Error).message || error));
        }
      });
    return function () {
      current = false;
    };
  }, []);

  // Stop the background workers if the page goes away.
  useEffect(function () {
    return function () {
      if (search.current && search.current.batch) {
        search.current.batch.cancel();
      }
    };
  }, []);

  /** The ranking and facts from whatever has finished so far. */
  function snapshot(current: Search): Pick<PlannerState, "curves" | "outcome" | "checks" | "facts"> {
    const curves = curvesFrom(current.levelJobs, current.levelResults);
    let outcome: PlanOutcome | null = null;
    if (curves.length > 0) {
      outcome = summarise(current.request, curves, current.profiles);
    }
    return {
      curves: curves,
      outcome: outcome,
      checks: checksFrom(current.checkJobs, current.checkResults, curves, current.profiles),
      facts: worksFacts(current.levelJobs, current.levelResults),
    };
  }

  /**
   * Run the jobs of one stage that have no remembered result, then call
   * `next`. Progress counts simulated seconds, so part-finished tests count.
   */
  function runStage(current: Search, jobs: Job[], results: (ScenarioResult | null)[], next: () => void) {
    const perTest = WARM_UP_SECONDS + COUNT_SECONDS;
    const waiting: number[] = [];
    jobs.forEach(function (job, index) {
      const remembered = cachedResult(scenarioKey(job.scenario));
      if (remembered) {
        results[index] = remembered;
      } else {
        waiting.push(index);
      }
    });
    const secondsDone = waiting.map(function () {
      return 0;
    });
    const started = performance.now();

    function progress(): PlannerProgress {
      let simulated = 0;
      secondsDone.forEach(function (seconds) {
        simulated = simulated + seconds;
      });
      const total = waiting.length * perTest;
      let share = 1;
      if (total > 0) {
        share = simulated / total;
      }
      let secondsLeft: number | null = null;
      const elapsed = (performance.now() - started) / 1000;
      if (share > 0.04 && share < 1) {
        secondsLeft = (elapsed / share) * (1 - share);
      }
      const done = results.filter(function (result) {
        return result !== null;
      }).length;
      return {
        stage: current.stage,
        testsDone: done,
        testsTotal: jobs.length,
        share: share,
        secondsLeft: secondsLeft,
      };
    }

    function publish(): void {
      if (search.current !== current) {
        return;
      }
      const figures = snapshot(current);
      setState(function (previous) {
        return Object.assign({}, previous, figures, { progress: progress() });
      });
    }

    publish();
    current.batch = runBatch(
      waiting.map(function (index) {
        return jobs[index].scenario;
      }),
      {
        onResult: function (position, result, seconds) {
          if (search.current !== current) {
            return;
          }
          const index = waiting[position];
          results[index] = result;
          secondsDone[position] = perTest;
          rememberResult(scenarioKey(jobs[index].scenario), result);
          secondsPerTest.current = 0.8 * secondsPerTest.current + 0.2 * seconds;
          publish();
        },
        onProgress: function (position, done) {
          if (search.current !== current) {
            return;
          }
          secondsDone[position] = done;
          // Progress arrives often; a few updates a second is plenty.
          const now = performance.now();
          if (now - lastProgressUpdate.current > 250) {
            lastProgressUpdate.current = now;
            setState(function (previous) {
              return Object.assign({}, previous, { progress: progress() });
            });
          }
        },
        onFinished: function () {
          saveResults();
          if (search.current !== current) {
            return;
          }
          current.batch = null;
          next();
        },
        onError: function (message) {
          saveResults();
          if (search.current !== current) {
            return;
          }
          current.batch = null;
          current.finished = true;
          setState(function (previous) {
            return Object.assign({}, previous, {
              phase: "failed",
              progress: null,
              error: "The search stopped: " + message,
            });
          });
        },
      },
    );
  }

  /** Stage 3: re-test the busiest hour of the best plans at their real time of day. */
  function startChecks(current: Search): void {
    const figures = snapshot(current);
    const outcome = figures.outcome;
    if (!outcome) {
      finish(current, "done");
      return;
    }
    const repeats = REPEATS[current.request.thoroughness];
    const checks: { dayType: "weekday" | "weekend"; hour: number }[] = [];
    [outcome.best]
      .concat(outcome.others)
      .slice(0, repeats.plansChecked)
      .forEach(function (plan) {
        const hour = busiestHour(plan, figures.curves, current.profiles);
        const known = checks.some(function (check) {
          return check.dayType === plan.dayType && check.hour === hour;
        });
        if (!known) {
          checks.push({ dayType: plan.dayType, hour: hour });
        }
      });
    current.stage = "checks";
    current.checkJobs = checkJobs(current.request, current.base, seedsFor(repeats.checks), checks);
    current.checkResults = current.checkJobs.map(function () {
      return null;
    });
    runStage(current, current.checkJobs, current.checkResults, function () {
      finish(current, "done");
    });
  }

  function finish(current: Search, phase: "done" | "stopped"): void {
    current.finished = true;
    const figures = snapshot(current);
    let error: string | null = null;
    let finalPhase: PlannerPhase = phase;
    if (figures.curves.length === 0) {
      finalPhase = "idle";
      error = "The search was stopped before any test finished, so there is nothing to show yet.";
    }
    setState(function (previous) {
      return Object.assign({}, previous, figures, { phase: finalPhase, progress: null, error: error });
    });
  }

  /** Start a search. Replaces any search already running. */
  function start(request: WorksRequest): void {
    if (!profiles || !simulatorSettings) {
      return;
    }
    if (search.current && search.current.batch) {
      search.current.batch.cancel();
    }
    const base = plannerSettings(simulatorSettings);
    const repeats = REPEATS[request.thoroughness];
    const jobs = levelJobs(request, base, seedsFor(repeats.levels));
    const current: Search = {
      request: request,
      profiles: profiles,
      base: base,
      stage: "levels",
      levelJobs: jobs,
      levelResults: jobs.map(function () {
        return null;
      }),
      checkJobs: [],
      checkResults: [],
      batch: null,
      finished: false,
    };
    search.current = current;
    setState(Object.assign({}, IDLE, { phase: "running", request: request, repeatsWanted: repeats.levels }));
    runStage(current, jobs, current.levelResults, function () {
      startChecks(current);
    });
  }

  /** Stop now and show the best plan from the tests finished so far. */
  function stop(): void {
    const current = search.current;
    if (!current || current.finished) {
      return;
    }
    if (current.batch) {
      current.batch.cancel();
      current.batch = null;
    }
    saveResults();
    finish(current, "stopped");
  }

  /** Back to the form. */
  function reset(): void {
    const current = search.current;
    if (current && current.batch) {
      current.batch.cancel();
    }
    search.current = null;
    setState(IDLE);
  }

  /**
   * Roughly how long a search would take, in seconds: tests already
   * remembered are free. Null until the simulator and traffic data are ready.
   */
  function estimateSeconds(request: WorksRequest): number | null {
    if (!simulatorSettings || !profiles) {
      return null;
    }
    const repeats = REPEATS[request.thoroughness];
    const jobs = levelJobs(request, plannerSettings(simulatorSettings), seedsFor(repeats.levels));
    let toRun = 0;
    jobs.forEach(function (job) {
      if (!cachedResult(scenarioKey(job.scenario))) {
        toRun = toRun + 1;
      }
    });
    // Direct checks: an open and a works test per repeat and plan checked.
    // When every level test is remembered, the checks usually are too.
    if (toRun > 0) {
      toRun = toRun + 2 * repeats.checks * repeats.plansChecked;
    }
    const workers = workerCount();
    return Math.ceil(toRun / workers) * secondsPerTest.current;
  }

  return {
    state: state,
    profiles: profiles,
    profilesError: profilesError,
    ready: profiles !== null && simulatorSettings !== null,
    start: start,
    stop: stop,
    reset: reset,
    estimateSeconds: estimateSeconds,
  };
}
