"use client";

import { useCallback, useEffect, useState } from "react";
import { Callout } from "./primitives";

type ToastTone = "neutral" | "primary" | "positive" | "negative";

/**
 * 화면 아래 가운데에 잠깐 떴다 사라지는 알림.
 *
 *   const { show, toast } = useToast();
 *   ...
 *   <Button onClick={() => show("초대 링크를 복사했어요")}>복사</Button>
 *   {toast}
 *
 * 모양은 Callout 그대로 쓴다. 위치·등장·사라짐만 여기서 얹는다(.wds-toast, globals.css).
 */
export function useToast(duration = 2000) {
  const [current, setCurrent] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [open, setOpen] = useState(false);

  // ponytail: 한 번에 하나. 새 메시지가 앞엣것을 밀어낸다. 쌓아 보여야 할 때 큐로 바꾸면 된다.
  const show = useCallback((text: string, tone: ToastTone = "primary") => {
    setCurrent({ text, tone });
    setOpen(true);
  }, []);

  // current가 바뀌면(같은 문구여도 객체가 새로 생기므로) 타이머도 처음부터 다시 센다.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), duration);
    return () => clearTimeout(timer);
  }, [open, current, duration]);

  // 사라지는 애니메이션을 마치려면 닫힌 뒤에도 DOM에 남아 있어야 한다. 감추는 건 CSS가 한다.
  const toast = current ? (
    <div className="wds-toast" data-open={open || undefined} role="status" aria-live="polite">
      <Callout tone={current.tone} style={{ boxShadow: "var(--wds-shadow-heavy)" }}>
        {current.text}
      </Callout>
    </div>
  ) : null;

  return { show, toast };
}
