"use client";
import { useEffect, useRef, useState } from "react";

/** Odometer-lite: when `value` changes, old number slides up+fades, new slides in. */
export function RollingNumber({ value }: { value: number }) {
  const prev = useRef(value);
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setAnim(true);
      const t = setTimeout(() => setAnim(false), 240);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <span className="relative inline-block overflow-hidden tabular-nums">
      <span key={value} className={anim ? "roll-in inline-block" : "inline-block"}>{value}</span>
    </span>
  );
}
