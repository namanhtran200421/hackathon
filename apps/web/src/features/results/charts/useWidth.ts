/**
 * Measure the width available to a chart, and follow it as the window resizes.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

export function useWidth<Element extends HTMLElement>(): [RefObject<Element | null>, number] {
  const ref = useRef<Element>(null);
  const [width, setWidth] = useState(560);
  useEffect(function () {
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    const watcher = new ResizeObserver(function (entries) {
      setWidth(Math.max(260, Math.round(entries[0].contentRect.width)));
    });
    watcher.observe(element);
    return function () {
      watcher.disconnect();
    };
  }, []);
  return [ref, width];
}
