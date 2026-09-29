"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import {
  CAR_FIELDS,
  STYLE,
  type RenderStore,
  type RoadInfo,
  type World,
} from "@/lib/types";

type Props = {
  store: RefObject<RenderStore>;
  worldVersion: number;
  selection: { street: string; block: number };
  viewMode: string;
  clickMode: boolean;
  closeWhole: boolean;
  hasBaseline: boolean;
  description: string;
  onSelect: (street: string, section: number) => void;
  onToggle: (x: number, y: number) => void;
};

type Palette = Record<
  | "road"
  | "access"
  | "restricted"
  | "light"
  | "busy"
  | "jam"
  | "more"
  | "less"
  | "closed"
  | "reduced"
  | "selected"
  | "hover"
  | "car"
  | "slow"
  | "stopped"
  | "gate"
  | "dest"
  | "label"
  | "halo",
  string
> & { volume: string[] };

const MAX_ZOOM = 14;
const HIT_PX = 9;

function readPalette(element: HTMLElement): Palette {
  const css = getComputedStyle(element);
  const v = (name: string) => css.getPropertyValue(name).trim() || "#888";
  const hex = (value: string) => {
    const n = parseInt(value.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const low = hex(v("--vol-low")),
    high = hex(v("--vol-high"));
  const volume = Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    const c = low.map((a, k) => Math.round(a + (high[k] - a) * t));
    return `rgb(${c.join(",")})`;
  });
  return {
    road: v("--road"),
    access: v("--road-access"),
    restricted: v("--road-restricted"),
    light: v("--cong-light"),
    busy: v("--cong-busy"),
    jam: v("--cong-jam"),
    more: v("--change-more"),
    less: v("--change-less"),
    closed: v("--closed"),
    reduced: v("--reduced"),
    selected: v("--map-selected"),
    hover: v("--ink"),
    car: v("--car"),
    slow: v("--car-slow"),
    stopped: v("--car-stopped"),
    gate: v("--gate"),
    dest: v("--dest"),
    label: v("--muted"),
    halo: v("--map-bg"),
    volume,
  };
}

/** Maps the model's own road colour (update-link-colors) to the web palette. */
function roadColour(p: Palette, view: string, color: number) {
  if (color === 117) return p.restricted;
  if (color === 6) return p.access;
  if (view === "congestion")
    return color === 44
      ? p.light
      : color === 25
        ? p.busy
        : color === 14
          ? p.jam
          : p.road;
  if (view === "volume") {
    if (color >= 10 && color < 20)
      return p.volume[Math.round((1 - (color - 10) / 9.9) * 16)];
    return p.road;
  }
  return color === 15 ? p.more : color === 105 ? p.less : p.road;
}

const drivable = (r: RoadInfo) =>
  r.carsAllowed && r.kind !== "gate" && r.kind !== "access";

function extent(world: World) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const r of world.roads)
    for (const [x, y] of r.geometry) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  for (const n of world.nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  if (!Number.isFinite(minX))
    return { minX: -120, maxX: 120, minY: -102, maxY: 102 };
  return { minX, maxX, minY, maxY };
}

/** Distance from (x, y) to a road polyline, and the closest point on it. */
function closestOnRoad(r: RoadInfo, x: number, y: number) {
  let best = { d: Infinity, x, y };
  const g = r.geometry;
  for (let i = 0; i < g.length - 1; i++) {
    const [x1, y1] = g[i],
      [x2, y2] = g[i + 1];
    const dx = x2 - x1,
      dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    const t = l2
      ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2))
      : 0;
    const px = x1 + t * dx,
      py = y1 + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { d, x: px, y: py };
  }
  return best;
}

type Tip = { x: number; y: number; road: RoadInfo } | null;

export default function TrafficMap(props: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const view = useRef({ zoom: 1, cx: 0, cy: 0 });
  const [zoom, setZoom] = useState(1);
  const [tip, setTip] = useState<Tip>(null);
  const hoverRef = useRef<RoadInfo | null>(null);
  const invalidate = useRef(() => {});
  const zoomBy = useRef<(factor: number) => void>(() => {});

  useEffect(() => {
    const stage = stageRef.current!,
      canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const layer = document.createElement("canvas");
    const lctx = layer.getContext("2d")!;
    let palette = readPalette(stage);
    let size = { w: 0, h: 0, dpr: 1 };
    let bounds = { minX: -120, maxX: 120, minY: -102, maxY: 102 };
    let paths: Path2D[] = [];
    let worldVersion = -1;
    let layerKey = "";
    let drawnFrame = -1;
    let needsDraw = true;
    let raf = 0;

    const scale = () => {
      const pad = 18;
      const w = Math.max(1, bounds.maxX - bounds.minX),
        h = Math.max(1, bounds.maxY - bounds.minY);
      const base = Math.min((size.w - pad * 2) / w, (size.h - pad * 2) / h);
      return Math.max(0.1, base) * view.current.zoom;
    };
    const worldTransform = (c: CanvasRenderingContext2D, s: number) => {
      const { cx, cy } = view.current;
      c.setTransform(
        s * size.dpr,
        0,
        0,
        -s * size.dpr,
        (size.w / 2 - cx * s) * size.dpr,
        (size.h / 2 + cy * s) * size.dpr,
      );
    };
    const toScreen = (x: number, y: number, s: number) => [
      (x - view.current.cx) * s + size.w / 2,
      size.h / 2 - (y - view.current.cy) * s,
    ];
    const toWorld = (px: number, py: number) => {
      const s = scale();
      return [
        (px - size.w / 2) / s + view.current.cx,
        view.current.cy - (py - size.h / 2) / s,
      ];
    };
    const fit = () => {
      view.current = {
        zoom: 1,
        cx: (bounds.minX + bounds.maxX) / 2,
        cy: (bounds.minY + bounds.maxY) / 2,
      };
      setZoom(1);
    };
    const clampView = () => {
      const v = view.current;
      v.zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
      v.cx = Math.min(bounds.maxX, Math.max(bounds.minX, v.cx));
      v.cy = Math.min(bounds.maxY, Math.max(bounds.minY, v.cy));
    };

    const buildLayer = (world: World, s: number) => {
      const store = propsRef.current.store.current;
      const p = propsRef.current;
      layer.width = canvas.width;
      layer.height = canvas.height;
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, layer.width, layer.height);
      worldTransform(lctx, s);
      lctx.lineCap = "round";
      lctx.lineJoin = "round";
      const styles =
        store.styles &&
        store.styles.length === world.roads.length * STYLE.fields
          ? store.styles
          : null;
      const px = (n: number) => n / s;
      // Selected extent halo under the roads.
      lctx.strokeStyle = palette.selected;
      lctx.globalAlpha = 0.85;
      for (const r of world.roads) {
        if (!drivable(r) || r.street !== p.selection.street) continue;
        if (p.selection.block !== 0 && r.section !== p.selection.block)
          continue;
        lctx.lineWidth = px(Math.max(7, 0.7 * s * 0.6 + 6));
        lctx.stroke(paths[r.index]);
      }
      lctx.globalAlpha = 1;
      // Plain roads first, highlighted states on top.
      const passes: number[][] = [[], [], [], []];
      for (const r of world.roads) {
        const o = r.index * STYLE.fields;
        const rank = !styles
          ? 0
          : styles[o + STYLE.pairClosed]
            ? 3
            : styles[o + STYLE.pairReduced]
              ? 2
              : roadColour(
                    palette,
                    store.stylesView,
                    styles[o + STYLE.color],
                  ) === palette.road
                ? 0
                : 1;
        passes[rank].push(r.index);
      }
      for (let rank = 0; rank < 4; rank++) {
        for (const i of passes[rank]) {
          const r = world.roads[i];
          const o = i * STYLE.fields;
          const thickness = styles
            ? styles[o + STYLE.thickness]
            : r.kind === "little"
              ? 0.35
              : 0.7;
          const minimum = r.kind === "main" || r.kind === "gate" ? 1.3 : 0.9;
          lctx.lineWidth = px(Math.max(minimum, thickness * s * 0.6));
          if (rank === 3) {
            lctx.strokeStyle = palette.closed;
            lctx.setLineDash([
              px(Math.max(4, 3 * s * 0.6)),
              px(Math.max(3, 2 * s * 0.6)),
            ]);
          } else {
            lctx.strokeStyle =
              rank === 2
                ? palette.reduced
                : styles
                  ? roadColour(
                      palette,
                      store.stylesView,
                      styles[o + STYLE.color],
                    )
                  : palette.road;
            lctx.setLineDash([]);
          }
          lctx.stroke(paths[i]);
        }
      }
      lctx.setLineDash([]);
      // Boundary gates and synthetic destinations.
      for (const n of world.nodes) {
        const half = px(
          n.kind === "gate" ? Math.max(2.5, s * 0.8) : Math.max(4, s * 0.9),
        );
        lctx.fillStyle = n.kind === "gate" ? palette.gate : palette.dest;
        lctx.fillRect(n.x - half, n.y - half, half * 2, half * 2);
      }
      // Labels in screen space.
      lctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      lctx.textAlign = "center";
      lctx.textBaseline = "middle";
      for (const n of world.nodes) {
        if (!n.label) continue;
        const [x, y] = toScreen(n.x, n.y, s);
        lctx.font = `600 ${Math.max(7, Math.min(11, s * 1.2))}px Arial, sans-serif`;
        lctx.fillStyle = "#ffffff";
        lctx.fillText(n.label, x, y + 0.5);
      }
      lctx.font = "9px ui-monospace, monospace";
      lctx.lineWidth = 3;
      lctx.strokeStyle = palette.halo;
      lctx.fillStyle = palette.label;
      for (const l of world.labels) {
        const [x, y] = toScreen(l.x, l.y, s);
        const text = l.text.toUpperCase();
        lctx.textAlign = l.align ?? "center";
        lctx.strokeText(text, x, y - 7);
        lctx.fillText(text, x, y - 7);
      }
    };

    const draw = (now: number) => {
      const p = propsRef.current;
      const store = p.store.current;
      const world = store.world;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!world || !size.w) return false;
      if (store.worldVersion !== worldVersion) {
        worldVersion = store.worldVersion;
        paths = world.roads.map((r) => {
          const path = new Path2D();
          r.geometry.forEach(([x, y], i) =>
            i ? path.lineTo(x, y) : path.moveTo(x, y),
          );
          return path;
        });
        bounds = extent(world);
        fit();
        layerKey = "";
      }
      const s = scale();
      const key = [
        worldVersion,
        store.stylesVersion,
        p.selection.street,
        p.selection.block,
        size.w,
        size.h,
        size.dpr,
        view.current.zoom,
        view.current.cx,
        view.current.cy,
      ].join("|");
      if (key !== layerKey) {
        buildLayer(world, s);
        layerKey = key;
      }
      ctx.drawImage(layer, 0, 0);
      worldTransform(ctx, s);
      const px = (n: number) => n / s;
      // Hovered road.
      const hover = hoverRef.current;
      if (hover) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = p.clickMode ? palette.closed : palette.hover;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = px(Math.max(3, 0.7 * s * 0.6 + 2));
        ctx.stroke(paths[hover.index]);
        ctx.globalAlpha = 1;
      }
      // Cars, interpolated between the last two model ticks.
      const { cars, from, fromIndex, frameAt, duration } = store;
      const t = duration > 0 ? Math.min(1, (now - frameAt) / duration) : 1;
      const length = px(Math.max(4.5, 1.1 * s * 0.6)),
        width = px(Math.max(2.3, 0.55 * s * 0.6));
      const groups = [new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < cars.length; i += CAR_FIELDS) {
        let x = cars[i + 1],
          y = cars[i + 2],
          h = cars[i + 3];
        if (t < 1) {
          const j = fromIndex.get(cars[i]);
          if (j !== undefined) {
            x = from[j + 1] + (x - from[j + 1]) * t;
            y = from[j + 2] + (y - from[j + 2]) * t;
            h = from[j + 3] + (((h - from[j + 3] + 540) % 360) - 180) * t;
          }
        }
        const a = (h * Math.PI) / 180;
        const fx = Math.sin(a) * length * 0.5,
          fy = Math.cos(a) * length * 0.5;
        const rx = Math.cos(a) * width * 0.5,
          ry = -Math.sin(a) * width * 0.5;
        const colour = cars[i + 4];
        const path = groups[colour === 15 ? 2 : colour === 25 ? 1 : 0];
        path.moveTo(x + fx + rx, y + fy + ry);
        path.lineTo(x + fx - rx, y + fy - ry);
        path.lineTo(x - fx - rx, y - fy - ry);
        path.lineTo(x - fx + rx, y - fy + ry);
        path.closePath();
      }
      ctx.fillStyle = palette.car;
      ctx.fill(groups[0]);
      ctx.fillStyle = palette.slow;
      ctx.fill(groups[1]);
      ctx.fillStyle = palette.stopped;
      ctx.fill(groups[2]);
      drawnFrame = store.frameVersion;
      return t < 1;
    };

    let animating = false;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const store = propsRef.current.store.current;
      if (
        !needsDraw &&
        !animating &&
        store.frameVersion === drawnFrame &&
        layerKey.startsWith(`${store.worldVersion}|${store.stylesVersion}|`)
      )
        return;
      needsDraw = false;
      animating = draw(now);
    };
    invalidate.current = () => {
      needsDraw = true;
    };

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      palette = readPalette(stage);
      layerKey = "";
      needsDraw = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    raf = requestAnimationFrame(loop);

    // Pointer: click selects or toggles, drag pans when zoomed.
    let down: {
      x: number;
      y: number;
      cx: number;
      cy: number;
      moved: boolean;
      id: number;
    } | null = null;
    const local = (e: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };
    const nearest = (px: number, py: number) => {
      const world = propsRef.current.store.current.world;
      if (!world) return null;
      const [x, y] = toWorld(px, py);
      const limit = HIT_PX / scale();
      let best: { road: RoadInfo; x: number; y: number } | null = null,
        bestD = limit;
      for (const r of world.roads) {
        if (!drivable(r)) continue;
        const hit = closestOnRoad(r, x, y);
        if (hit.d < bestD) {
          bestD = hit.d;
          best = { road: r, x: hit.x, y: hit.y };
        }
      }
      return best;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const [x, y] = local(e);
      down = {
        x,
        y,
        cx: view.current.cx,
        cy: view.current.cy,
        moved: false,
        id: e.pointerId,
      };
    };
    const onMove = (e: PointerEvent) => {
      const [x, y] = local(e);
      if (down && down.id === e.pointerId) {
        const dx = x - down.x,
          dy = y - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 5 && view.current.zoom > 1) {
          down.moved = true;
          canvas.setPointerCapture(e.pointerId);
        }
        if (down.moved) {
          const s = scale();
          view.current.cx = down.cx - dx / s;
          view.current.cy = down.cy + dy / s;
          clampView();
          needsDraw = true;
          return;
        }
      }
      if (e.pointerType === "touch") return;
      const road = nearest(x, y)?.road ?? null;
      if (road !== hoverRef.current) {
        hoverRef.current = road;
        needsDraw = true;
      }
      setTip(road ? { x, y, road } : null);
    };
    const onUp = (e: PointerEvent) => {
      if (!down || down.id !== e.pointerId) return;
      const wasDrag = down.moved;
      down = null;
      if (wasDrag) return;
      const [x, y] = local(e);
      const p = propsRef.current;
      const hit = nearest(x, y);
      if (!hit) return;
      // Click roads: hand the model a point on the highlighted road, so its own
      // pointer handler (2.5-patch radius) picks the road the user sees.
      if (p.clickMode) p.onToggle(hit.x, hit.y);
      else p.onSelect(hit.road.street, p.closeWhole ? 0 : hit.road.section);
    };
    const onLeave = () => {
      hoverRef.current = null;
      setTip(null);
      needsDraw = true;
    };
    const zoomAt = (factor: number, px = size.w / 2, py = size.h / 2) => {
      const [wx, wy] = toWorld(px, py);
      view.current.zoom *= factor;
      clampView();
      const s = scale();
      view.current.cx = wx - (px - size.w / 2) / s;
      view.current.cy = wy + (py - size.h / 2) / s;
      clampView();
      setZoom(view.current.zoom);
      needsDraw = true;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const [x, y] = local(e);
      zoomAt(Math.exp(-e.deltaY * 0.004), x, y);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", () => (down = null));
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    zoomBy.current = (factor: number) =>
      factor === 0 ? (fit(), (needsDraw = true)) : zoomAt(factor);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Selection, view and mode changes need a redraw even when paused.
  useEffect(() => {
    invalidate.current();
  }, [
    props.selection.street,
    props.selection.block,
    props.viewMode,
    props.clickMode,
    props.worldVersion,
  ]);

  const store = props.store.current;
  const tipRoad = tip?.road;
  const o = tipRoad ? tipRoad.index * STYLE.fields : 0;
  const styles = store?.styles;
  const hours = Math.max(1 / 3600, (store?.measured ?? 0) / 3600);
  return (
    <div
      ref={stageRef}
      className={`map-canvas ${props.clickMode ? "click-mode" : ""} ${zoom > 1 ? "zoomed" : ""}`}
    >
      <canvas ref={canvasRef} role="img" aria-label={props.description} />
      <div className="zoom-controls">
        <button
          className="icon-button"
          onClick={() => zoomBy.current(1.6)}
          aria-label="Zoom in"
          title="Zoom in (or Ctrl + scroll)"
        >
          <Plus size={16} />
        </button>
        <button
          className="icon-button"
          onClick={() => zoomBy.current(1 / 1.6)}
          aria-label="Zoom out"
          disabled={zoom <= 1}
        >
          <Minus size={16} />
        </button>
        <button
          className="icon-button"
          onClick={() => zoomBy.current(0)}
          aria-label="Fit map to view"
          disabled={zoom <= 1}
        >
          <Maximize2 size={14} />
        </button>
      </div>
      {tipRoad && tip && (
        <div
          className="map-tip"
          style={{
            left: Math.min(
              tip.x + 14,
              (stageRef.current?.clientWidth ?? 400) - 210,
            ),
            top: Math.max(8, tip.y - 12),
          }}
          aria-hidden="true"
        >
          <strong>{tipRoad.street}</strong>
          <span>
            Section {tipRoad.section} · {tipRoad.direction} ·{" "}
            {styles
              ? styles[o + STYLE.closed]
                ? "closed"
                : `${styles[o + STYLE.lanesOpen]}/${tipRoad.lanes} lanes open`
              : `${tipRoad.lanes} lanes`}
          </span>
          {styles && store.measured > 0 && (
            <span>
              {Math.round(styles[o + STYLE.winCount] / hours).toLocaleString(
                "en-AU",
              )}{" "}
              veh/h
              {props.hasBaseline
                ? ` · baseline ${Math.round(styles[o + STYLE.baseCount]).toLocaleString("en-AU")}`
                : ""}
            </span>
          )}
          <small>
            {props.clickMode
              ? "Click to close or reopen"
              : "Click to select this street"}
          </small>
        </div>
      )}
    </div>
  );
}
