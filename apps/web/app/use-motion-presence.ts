"use client";

import { useEffect, useState } from "react";

export function useMotionPresence(open: boolean, duration = 180) {
  const [present, setPresent] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    let nextFrame = 0;
    let timeout = 0;

    if (open) {
      frame = window.requestAnimationFrame(() => {
        setPresent(true);
        nextFrame = window.requestAnimationFrame(() => setVisible(true));
      });
    } else {
      frame = window.requestAnimationFrame(() => setVisible(false));
      timeout = window.setTimeout(() => setPresent(false), duration);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(nextFrame);
      window.clearTimeout(timeout);
    };
  }, [duration, open]);

  return { present, visible };
}
