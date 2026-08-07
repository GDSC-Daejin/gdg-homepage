"use client";

import { useEffect } from "react";

export function DeferredPretendard() {
  useEffect(() => {
    void import("./pretendard-subset.css");
  }, []);

  return null;
}
