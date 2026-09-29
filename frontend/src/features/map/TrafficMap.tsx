/**
 * The live traffic map, drawn on a canvas.
 *
 * Roads are drawn once into a hidden canvas and reused until their colours
 * change. On every screen refresh only the cars are drawn on top, each placed
 * part-way between its last two positions so movement looks smooth.
 *
 * Mouse: hover a road to see its details; click to choose a street (or, with
 * click-to-close on, to close or reopen it). Ctrl + scroll or the buttons zoom;
 * drag to move around when zoomed in.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import {
  CAR_COLOUR,
  CAR_FIELDS,
  STYLE,
  isDrivable,
  type RoadInfo,
  type ViewMode,
  type World,
} from "@traffic-lab/simulation";
import { glideProgress, type RenderStore } from "../simulation/renderStore";
import type { Selection } from "../simulation/types";
import { closestPointOnRoad, mapExtent, readPalette, roadColour, type Extent, type Palette } from "./drawing";
import RoadTooltip, { type TooltipPosition } from "./RoadTooltip";

const MAX_ZOOM = 14;
const CLICK_DISTANCE_PX = 9;
const PADDING_PX = 18;

export interface TrafficMapProps {
  store: RefObject<RenderStore>;
  worldVersion: number;
  selection: Selection;
  viewMode: ViewMode;
  clickMode: boolean;
  closeWholeStreet: boolean;
  hasBaseline: boolean;
  description: string;
  onSelect: (street: string, section: number) => void;
  onToggle: (x: number, y: number) => void;
}

interface View {
  zoom: number;
  centreX: number;
  centreY: number;
}

interface Size {
  width: number;
  height: number;
  pixelRatio: number;
}

interface RoadHit {
  road: RoadInfo;
  x: number;
  y: number;
}

interface Press {
  x: number;
  y: number;
  centreX: number;
  centreY: number;
  dragging: boolean;
  id: number;
}

export default function TrafficMap(props: TrafficMapProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  const view = useRef<View>({ zoom: 1, centreX: 0, centreY: 0 });
  const hoveredRoad = useRef<RoadInfo | null>(null);
  const redraw = useRef(function () {});
  const zoomBy = useRef(function (_factor: number) {});
  const [zoom, setZoom] = useState(1);
  const [tooltip, setTooltip] = useState<TooltipPosition | null>(null);

  // The drawing loop reads the newest props without restarting.
  propsRef.current = props;

  useEffect(function setUpCanvas() {
    if (!stageRef.current || !canvasRef.current) {
      return undefined;
    }
    const stage: HTMLDivElement = stageRef.current;
    const canvas: HTMLCanvasElement = canvasRef.current;
    const context = canvas.getContext("2d");
    const roadLayer = document.createElement("canvas");
    const roadContext = roadLayer.getContext("2d");
    if (!context || !roadContext) {
      return undefined;
    }
    const screen = context;
    const layer = roadContext;

    let palette: Palette = readPalette(stage);
    let size: Size = { width: 0, height: 0, pixelRatio: 1 };
    let bounds: Extent = { minX: -120, maxX: 120, minY: -102, maxY: 102 };
    let roadShapes: Path2D[] = [];
    let drawnWorld = -1;
    let roadLayerKey = "";
    let drawnFrame = -1;
    let needsDrawing = true;
    let stillMoving = false;
    let animation = 0;
    let press: Press | null = null;

    function storeNow(): RenderStore {
      return propsRef.current.store.current;
    }

    /** Screen pixels per map patch at the current zoom. */
    function scale(): number {
      const width = Math.max(1, bounds.maxX - bounds.minX);
      const height = Math.max(1, bounds.maxY - bounds.minY);
      const fit = Math.min((size.width - PADDING_PX * 2) / width, (size.height - PADDING_PX * 2) / height);
      return Math.max(0.1, fit) * view.current.zoom;
    }

    /** Draw in map units: x to the right, y up. */
    function useMapUnits(drawing: CanvasRenderingContext2D, pixelsPerPatch: number): void {
      const ratio = size.pixelRatio;
      drawing.setTransform(
        pixelsPerPatch * ratio,
        0,
        0,
        -pixelsPerPatch * ratio,
        (size.width / 2 - view.current.centreX * pixelsPerPatch) * ratio,
        (size.height / 2 + view.current.centreY * pixelsPerPatch) * ratio,
      );
    }

    function toScreen(x: number, y: number, pixelsPerPatch: number): [number, number] {
      return [
        (x - view.current.centreX) * pixelsPerPatch + size.width / 2,
        size.height / 2 - (y - view.current.centreY) * pixelsPerPatch,
      ];
    }

    function toMap(screenX: number, screenY: number): [number, number] {
      const pixelsPerPatch = scale();
      return [
        (screenX - size.width / 2) / pixelsPerPatch + view.current.centreX,
        view.current.centreY - (screenY - size.height / 2) / pixelsPerPatch,
      ];
    }

    function fitToView(): void {
      view.current = {
        zoom: 1,
        centreX: (bounds.minX + bounds.maxX) / 2,
        centreY: (bounds.minY + bounds.maxY) / 2,
      };
      setZoom(1);
    }

    function keepInsideMap(): void {
      const current = view.current;
      current.zoom = Math.min(MAX_ZOOM, Math.max(1, current.zoom));
      current.centreX = Math.min(bounds.maxX, Math.max(bounds.minX, current.centreX));
      current.centreY = Math.min(bounds.maxY, Math.max(bounds.minY, current.centreY));
    }

    /** Which drawing pass a road belongs to: plain roads first, closures last. */
    function drawingPass(styles: Float32Array | null, offset: number): number {
      if (!styles) {
        return 0;
      }
      if (styles[offset + STYLE.pairClosed]) {
        return 3;
      }
      if (styles[offset + STYLE.pairReduced]) {
        return 2;
      }
      const colour = roadColour(palette, storeNow().stylesView, styles[offset + STYLE.color]);
      if (colour === palette.road) {
        return 0;
      }
      return 1;
    }

    /** Draw every road, gate and label into the hidden road layer. */
    function drawRoads(world: World, pixelsPerPatch: number): void {
      const current = propsRef.current;
      const store = storeNow();
      let styles: Float32Array | null = null;
      if (store.styles && store.styles.length === world.roads.length * STYLE.fields) {
        styles = store.styles;
      }

      function pixels(amount: number): number {
        return amount / pixelsPerPatch;
      }

      roadLayer.width = canvas.width;
      roadLayer.height = canvas.height;
      layer.setTransform(1, 0, 0, 1, 0, 0);
      layer.clearRect(0, 0, roadLayer.width, roadLayer.height);
      useMapUnits(layer, pixelsPerPatch);
      layer.lineCap = "round";
      layer.lineJoin = "round";

      // A yellow glow under the chosen street.
      layer.strokeStyle = palette.selected;
      layer.globalAlpha = 0.85;
      layer.lineWidth = pixels(Math.max(7, 0.7 * pixelsPerPatch * 0.6 + 6));
      world.roads.forEach(function (road) {
        if (!isDrivable(road) || road.street !== current.selection.street) {
          return;
        }
        if (current.selection.section !== 0 && road.section !== current.selection.section) {
          return;
        }
        layer.stroke(roadShapes[road.index]);
      });
      layer.globalAlpha = 1;

      const passes: RoadInfo[][] = [[], [], [], []];
      world.roads.forEach(function (road) {
        passes[drawingPass(styles, road.index * STYLE.fields)].push(road);
      });

      passes.forEach(function (roads, pass) {
        roads.forEach(function (road) {
          const offset = road.index * STYLE.fields;
          let thickness = 0.7;
          if (styles) {
            thickness = styles[offset + STYLE.thickness];
          } else if (road.kind === "little") {
            thickness = 0.35;
          }
          let thinnest = 0.9;
          if (road.kind === "main" || road.kind === "gate") {
            thinnest = 1.3;
          }
          layer.lineWidth = pixels(Math.max(thinnest, thickness * pixelsPerPatch * 0.6));

          if (pass === 3) {
            layer.strokeStyle = palette.closed;
            layer.setLineDash([
              pixels(Math.max(4, 3 * pixelsPerPatch * 0.6)),
              pixels(Math.max(3, 2 * pixelsPerPatch * 0.6)),
            ]);
          } else if (pass === 2) {
            layer.strokeStyle = palette.reduced;
            layer.setLineDash([]);
          } else if (styles) {
            layer.strokeStyle = roadColour(palette, store.stylesView, styles[offset + STYLE.color]);
            layer.setLineDash([]);
          } else {
            layer.strokeStyle = palette.road;
            layer.setLineDash([]);
          }
          layer.stroke(roadShapes[road.index]);
        });
      });
      layer.setLineDash([]);

      // Entry gates (grey) and destinations (black).
      world.nodes.forEach(function (node) {
        let half = pixels(Math.max(4, pixelsPerPatch * 0.9));
        layer.fillStyle = palette.destination;
        if (node.kind === "gate") {
          half = pixels(Math.max(2.5, pixelsPerPatch * 0.8));
          layer.fillStyle = palette.gate;
        }
        layer.fillRect(node.x - half, node.y - half, half * 2, half * 2);
      });

      // Text is drawn in screen pixels so it stays sharp at every zoom.
      layer.setTransform(size.pixelRatio, 0, 0, size.pixelRatio, 0, 0);
      layer.textBaseline = "middle";
      layer.textAlign = "center";
      layer.fillStyle = "#ffffff";
      layer.font = "600 " + Math.max(7, Math.min(11, pixelsPerPatch * 1.2)) + "px Arial, sans-serif";
      world.nodes.forEach(function (node) {
        if (!node.label) {
          return;
        }
        const position = toScreen(node.x, node.y, pixelsPerPatch);
        layer.fillText(node.label, position[0], position[1] + 0.5);
      });

      layer.font = "9px ui-monospace, monospace";
      layer.lineWidth = 3;
      layer.strokeStyle = palette.halo;
      layer.fillStyle = palette.label;
      world.labels.forEach(function (label) {
        const position = toScreen(label.x, label.y, pixelsPerPatch);
        const text = label.text.toUpperCase();
        layer.textAlign = label.align || "center";
        layer.strokeText(text, position[0], position[1] - 7);
        layer.fillText(text, position[0], position[1] - 7);
      });
    }

    /** Draw one screen refresh. Returns true while cars are still gliding. */
    function drawFrame(now: number): boolean {
      const current = propsRef.current;
      const store = storeNow();
      const world = store.world;
      screen.setTransform(1, 0, 0, 1, 0, 0);
      screen.clearRect(0, 0, canvas.width, canvas.height);
      if (!world || !size.width) {
        return false;
      }

      // A new road layout: rebuild the road shapes and fit the map to the view.
      if (store.worldVersion !== drawnWorld) {
        drawnWorld = store.worldVersion;
        roadShapes = world.roads.map(function (road) {
          const shape = new Path2D();
          road.geometry.forEach(function (point, index) {
            if (index === 0) {
              shape.moveTo(point[0], point[1]);
            } else {
              shape.lineTo(point[0], point[1]);
            }
          });
          return shape;
        });
        bounds = mapExtent(world);
        fitToView();
        roadLayerKey = "";
      }

      const pixelsPerPatch = scale();
      const key = [
        drawnWorld,
        store.stylesVersion,
        current.selection.street,
        current.selection.section,
        size.width,
        size.height,
        size.pixelRatio,
        view.current.zoom,
        view.current.centreX,
        view.current.centreY,
      ].join("|");
      if (key !== roadLayerKey) {
        drawRoads(world, pixelsPerPatch);
        roadLayerKey = key;
      }
      screen.drawImage(roadLayer, 0, 0);
      useMapUnits(screen, pixelsPerPatch);

      function pixels(amount: number): number {
        return amount / pixelsPerPatch;
      }

      // Outline the road under the mouse.
      if (hoveredRoad.current) {
        screen.lineCap = "round";
        screen.lineJoin = "round";
        screen.strokeStyle = palette.hover;
        if (current.clickMode) {
          screen.strokeStyle = palette.closed;
        }
        screen.globalAlpha = 0.55;
        screen.lineWidth = pixels(Math.max(3, 0.7 * pixelsPerPatch * 0.6 + 2));
        screen.stroke(roadShapes[hoveredRoad.current.index]);
        screen.globalAlpha = 1;
      }

      // Cars, part-way between their last two positions.
      const progress = glideProgress(store, now);
      const carLength = pixels(Math.max(4.5, 1.1 * pixelsPerPatch * 0.6));
      const carWidth = pixels(Math.max(2.3, 0.55 * pixelsPerPatch * 0.6));
      const moving = new Path2D();
      const slow = new Path2D();
      const stopped = new Path2D();
      const cars = store.cars;

      for (let i = 0; i < cars.length; i += CAR_FIELDS) {
        let x = cars[i + 1];
        let y = cars[i + 2];
        let heading = cars[i + 3];
        if (progress < 1) {
          const previous = store.fromIndex.get(cars[i]);
          if (previous !== undefined) {
            const from = store.from;
            x = from[previous + 1] + (x - from[previous + 1]) * progress;
            y = from[previous + 2] + (y - from[previous + 2]) * progress;
            const turn = ((heading - from[previous + 3] + 540) % 360) - 180;
            heading = from[previous + 3] + turn * progress;
          }
        }

        // A small rectangle pointing the way the car is heading.
        const angle = (heading * Math.PI) / 180;
        const forwardX = Math.sin(angle) * carLength * 0.5;
        const forwardY = Math.cos(angle) * carLength * 0.5;
        const sideX = Math.cos(angle) * carWidth * 0.5;
        const sideY = -Math.sin(angle) * carWidth * 0.5;

        let shape = moving;
        if (cars[i + 4] === CAR_COLOUR.stopped) {
          shape = stopped;
        } else if (cars[i + 4] === CAR_COLOUR.slow) {
          shape = slow;
        }
        shape.moveTo(x + forwardX + sideX, y + forwardY + sideY);
        shape.lineTo(x + forwardX - sideX, y + forwardY - sideY);
        shape.lineTo(x - forwardX - sideX, y - forwardY - sideY);
        shape.lineTo(x - forwardX + sideX, y - forwardY + sideY);
        shape.closePath();
      }
      screen.fillStyle = palette.car;
      screen.fill(moving);
      screen.fillStyle = palette.slow;
      screen.fill(slow);
      screen.fillStyle = palette.stopped;
      screen.fill(stopped);

      drawnFrame = store.frameVersion;
      return progress < 1;
    }

    /** Runs every screen refresh, but only draws when something changed. */
    function loop(now: number): void {
      animation = requestAnimationFrame(loop);
      const store = storeNow();
      const layerCurrent = roadLayerKey.startsWith(store.worldVersion + "|" + store.stylesVersion + "|");
      if (!needsDrawing && !stillMoving && store.frameVersion === drawnFrame && layerCurrent) {
        return;
      }
      needsDrawing = false;
      stillMoving = drawFrame(now);
    }

    redraw.current = function () {
      needsDrawing = true;
    };

    function resize(): void {
      const box = stage.getBoundingClientRect();
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      size = { width: box.width, height: box.height, pixelRatio: pixelRatio };
      canvas.width = Math.max(1, Math.round(box.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(box.height * pixelRatio));
      palette = readPalette(stage);
      roadLayerKey = "";
      needsDrawing = true;
    }

    const resizeWatcher = new ResizeObserver(resize);
    resizeWatcher.observe(stage);
    resize();
    animation = requestAnimationFrame(loop);

    function pointerPosition(event: PointerEvent | WheelEvent): [number, number] {
      const box = canvas.getBoundingClientRect();
      return [event.clientX - box.left, event.clientY - box.top];
    }

    /** The drivable road nearest to a screen position, if one is close enough. */
    function roadNear(screenX: number, screenY: number): RoadHit | null {
      const world = storeNow().world;
      if (!world) {
        return null;
      }
      const position = toMap(screenX, screenY);
      let best: RoadHit | null = null;
      let bestDistance = CLICK_DISTANCE_PX / scale();
      world.roads.forEach(function (road) {
        if (!isDrivable(road)) {
          return;
        }
        const hit = closestPointOnRoad(road, position[0], position[1]);
        if (hit.distance < bestDistance) {
          bestDistance = hit.distance;
          best = { road: road, x: hit.x, y: hit.y };
        }
      });
      return best;
    }

    function onPointerDown(event: PointerEvent): void {
      if (event.button !== 0) {
        return;
      }
      const position = pointerPosition(event);
      press = {
        x: position[0],
        y: position[1],
        centreX: view.current.centreX,
        centreY: view.current.centreY,
        dragging: false,
        id: event.pointerId,
      };
    }

    function onPointerMove(event: PointerEvent): void {
      const position = pointerPosition(event);
      if (press && press.id === event.pointerId) {
        const dx = position[0] - press.x;
        const dy = position[1] - press.y;
        if (!press.dragging && Math.hypot(dx, dy) > 5 && view.current.zoom > 1) {
          press.dragging = true;
          canvas.setPointerCapture(event.pointerId);
        }
        if (press.dragging) {
          const pixelsPerPatch = scale();
          view.current.centreX = press.centreX - dx / pixelsPerPatch;
          view.current.centreY = press.centreY + dy / pixelsPerPatch;
          keepInsideMap();
          needsDrawing = true;
          return;
        }
      }
      if (event.pointerType === "touch") {
        return;
      }
      const hit = roadNear(position[0], position[1]);
      let road: RoadInfo | null = null;
      if (hit) {
        road = hit.road;
      }
      if (road !== hoveredRoad.current) {
        hoveredRoad.current = road;
        needsDrawing = true;
      }
      if (road) {
        setTooltip({ x: position[0], y: position[1], road: road, stageWidth: stage.clientWidth });
      } else {
        setTooltip(null);
      }
    }

    function onPointerUp(event: PointerEvent): void {
      if (!press || press.id !== event.pointerId) {
        return;
      }
      const wasDragging = press.dragging;
      press = null;
      if (wasDragging) {
        return;
      }
      const position = pointerPosition(event);
      const hit = roadNear(position[0], position[1]);
      if (!hit) {
        return;
      }
      const current = propsRef.current;
      if (current.clickMode) {
        // Give the model a point exactly on the highlighted road, so its own
        // click handler picks the same road the user sees.
        current.onToggle(hit.x, hit.y);
      } else if (current.closeWholeStreet) {
        current.onSelect(hit.road.street, 0);
      } else {
        current.onSelect(hit.road.street, hit.road.section);
      }
    }

    function onPointerCancel(): void {
      press = null;
    }

    function onPointerLeave(): void {
      hoveredRoad.current = null;
      setTooltip(null);
      needsDrawing = true;
    }

    function zoomAround(factor: number, screenX: number, screenY: number): void {
      const before = toMap(screenX, screenY);
      view.current.zoom = view.current.zoom * factor;
      keepInsideMap();
      const pixelsPerPatch = scale();
      view.current.centreX = before[0] - (screenX - size.width / 2) / pixelsPerPatch;
      view.current.centreY = before[1] + (screenY - size.height / 2) / pixelsPerPatch;
      keepInsideMap();
      setZoom(view.current.zoom);
      needsDrawing = true;
    }

    function onWheel(event: WheelEvent): void {
      // Plain scrolling scrolls the page; Ctrl or Cmd + scroll zooms the map.
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      const position = pointerPosition(event);
      zoomAround(Math.exp(-event.deltaY * 0.004), position[0], position[1]);
    }

    zoomBy.current = function (factor: number) {
      if (factor === 0) {
        fitToView();
        needsDrawing = true;
        return;
      }
      zoomAround(factor, size.width / 2, size.height / 2);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return function cleanUp() {
      cancelAnimationFrame(animation);
      resizeWatcher.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Redraw when the selection, view or click mode changes, even while paused.
  useEffect(
    function () {
      redraw.current();
    },
    [props.selection.street, props.selection.section, props.viewMode, props.clickMode, props.worldVersion],
  );

  let stageClass = "map-canvas";
  if (props.clickMode) {
    stageClass = stageClass + " click-mode";
  }
  if (zoom > 1) {
    stageClass = stageClass + " zoomed";
  }

  return (
    <div ref={stageRef} className={stageClass}>
      <canvas ref={canvasRef} role="img" aria-label={props.description} />
      <div className="zoom-controls">
        <button
          className="icon-button"
          onClick={function () {
            zoomBy.current(1.6);
          }}
          aria-label="Zoom in"
          title="Zoom in (or hold Ctrl and scroll)"
        >
          <Plus size={16} />
        </button>
        <button
          className="icon-button"
          onClick={function () {
            zoomBy.current(1 / 1.6);
          }}
          aria-label="Zoom out"
          disabled={zoom <= 1}
        >
          <Minus size={16} />
        </button>
        <button
          className="icon-button"
          onClick={function () {
            zoomBy.current(0);
          }}
          aria-label="Show the whole map"
          disabled={zoom <= 1}
        >
          <Maximize2 size={14} />
        </button>
      </div>
      <RoadTooltip
        tooltip={tooltip}
        store={props.store.current}
        clickMode={props.clickMode}
        hasBaseline={props.hasBaseline}
      />
    </div>
  );
}
