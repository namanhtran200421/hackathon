/**
 * The eight yellow tiles under the map with the latest numbers.
 */

import {
  Ban,
  Car,
  Clock,
  FlagTriangleRight,
  Gauge,
  Hourglass,
  Timer,
  TrafficCone,
  type LucideIcon,
} from "lucide-react";
import type { Metrics } from "@traffic-lab/simulation";
import { clock, oneDp, whole } from "../../lib/format";

interface Tile {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}

function tilesFor(metrics: Metrics | null): Tile[] {
  if (!metrics) {
    return [
      { icon: Car, label: "Cars on the road", value: "—", note: "Driving in the city now" },
      { icon: Hourglass, label: "Cars waiting to enter", value: "—", note: "Queued at the edge of the city" },
      { icon: FlagTriangleRight, label: "Trips finished", value: "—", note: "Finished while counting" },
      { icon: Timer, label: "Average trip time", value: "—", note: "Waiting for finished trips" },
      { icon: Ban, label: "Cars with no route", value: "—", note: "No way to their destination" },
      { icon: Clock, label: "Time simulated", value: "—", note: "Minutes and seconds of traffic" },
      { icon: TrafficCone, label: "Average delay", value: "—", note: "Extra time compared with empty roads" },
      { icon: Gauge, label: "Hours spent driving", value: "—", note: "All cars together" },
    ];
  }

  let tripTime = "—";
  let tripNote = "Waiting for finished trips";
  let delay = "—";
  if (metrics.completed > 0) {
    tripTime = oneDp(metrics.meanTrip) + " min";
    tripNote = "Finished trips only";
    delay = oneDp(metrics.meanDelay) + " min";
  }

  return [
    { icon: Car, label: "Cars on the road", value: whole(metrics.cars), note: "Driving in the city now" },
    {
      icon: Hourglass,
      label: "Cars waiting to enter",
      value: whole(metrics.waiting),
      note: "Queued at the edge of the city",
    },
    {
      icon: FlagTriangleRight,
      label: "Trips finished",
      value: whole(metrics.completed),
      note: "Finished while counting",
    },
    { icon: Timer, label: "Average trip time", value: tripTime, note: tripNote },
    {
      icon: Ban,
      label: "Cars with no route",
      value: whole(metrics.stranded),
      note: "No way to their destination",
    },
    {
      icon: Clock,
      label: "Time simulated",
      value: clock(metrics.ticks),
      note: whole(metrics.ticks) + " seconds of traffic",
    },
    { icon: TrafficCone, label: "Average delay", value: delay, note: "Extra time compared with empty roads" },
    {
      icon: Gauge,
      label: "Hours spent driving",
      value: oneDp(metrics.vehicleHours),
      note: "All cars together",
    },
  ];
}

export default function Figures({ metrics }: { metrics: Metrics | null }) {
  return (
    <div className="metrics">
      {tilesFor(metrics).map(function (tile) {
        const Icon = tile.icon;
        return (
          <div className="metric" key={tile.label}>
            <Icon size={26} strokeWidth={1.8} aria-hidden="true" />
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
            <small>{tile.note}</small>
          </div>
        );
      })}
    </div>
  );
}
