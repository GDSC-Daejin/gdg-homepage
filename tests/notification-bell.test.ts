import * as bell from "@/app/(member)/NotificationBell";
import { describe, expect, it } from "vitest";

type PositionMenu = (
  trigger: Pick<DOMRect, "top" | "bottom" | "right">,
  viewport: { width: number; height: number },
) => { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

describe("NotificationBell", () => {
  it("뷰포트 안에서 알림 패널을 버튼 위로 배치한다", () => {
    const positionMenu = (bell as { notificationMenuPosition?: PositionMenu }).notificationMenuPosition;

    expect(positionMenu).toBeTypeOf("function");
    expect(positionMenu?.({ top: 374, bottom: 406, right: 208 }, { width: 482, height: 422 })).toMatchObject({
      left: 16,
      width: 320,
      bottom: 56,
      maxHeight: 350,
    });
  });
});
