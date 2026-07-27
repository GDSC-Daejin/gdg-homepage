"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/Card";
import { formatKst } from "@/lib/format";
import type { PointLog } from "@/lib/types";

const PAGE_SIZE = 10;

export function PointLogTable({
  logs,
  nameById,
}: {
  logs: PointLog[];
  nameById: Record<string, string>;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(logs.length / PAGE_SIZE);
  const pages = Array.from({ length: pageCount }, (_, i) =>
    logs.slice(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE),
  );

  return (
    <Card className="p-0">
      {/* ponytail: 스와이프는 CSS scroll-snap에 맡긴다. 터치·트랙패드는 그대로 동작,
          마우스 드래그가 필요해지면 그때 pointer 핸들러를 얹는다. */}
      <div
        ref={scrollerRef}
        onScroll={(e) =>
          setPage(
            Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth),
          )
        }
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((pageLogs, i) => (
          <div key={i} className="w-full shrink-0 snap-start">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">회원</th>
                  <th className="px-4 py-3 font-medium">포인트</th>
                  <th className="px-4 py-3 font-medium">사유</th>
                  <th className="px-4 py-3 font-medium">일시</th>
                </tr>
              </thead>
              <tbody>
                {pageLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-900">
                      {nameById[log.user_id] || "(탈퇴)"}
                    </td>
                    <td
                      className={
                        log.amount >= 0
                          ? "px-4 py-3 font-bold text-success"
                          : "px-4 py-3 font-bold text-danger"
                      }
                    >
                      {log.amount >= 0 ? `+${log.amount}` : log.amount}P
                    </td>
                    <td className="px-4 py-3 text-gray-700">{log.reason}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatKst(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" />
          지급 (+)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-danger" />
          차감 (-)
        </span>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 border-t border-gray-100 py-3">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}페이지`}
              aria-current={i === page ? "true" : undefined}
              onClick={() => {
                const el = scrollerRef.current;
                el?.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
              }}
              className={
                i === page
                  ? "h-1.5 w-1.5 rounded-full bg-primary"
                  : "h-1.5 w-1.5 rounded-full bg-gray-300"
              }
            />
          ))}
        </div>
      )}
    </Card>
  );
}
