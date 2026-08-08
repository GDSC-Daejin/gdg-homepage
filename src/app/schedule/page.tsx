import { PollList } from "./PollList";
import { loadPollCards } from "./queries";
import { isDemoMode } from "@/lib/demo";
import styles from "./schedule.module.css";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const [cards, tour] = await Promise.all([loadPollCards("active"), isDemoMode()]);

  return (
    <div className={styles.page}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <h1 style={{ margin: 0, font: "700 28px/1.35 var(--wds-font-sans)", letterSpacing: "-0.025em" }}>
          내 일정
        </h1>
        <p
          style={{
            margin: 0,
            font: "400 15px/1.5 var(--wds-font-sans)",
            color: "var(--wds-label-alternative)",
          }}
        >
          응답을 받고 있는 조율이에요. 확정하거나 마감이 지나면 지난 일정으로 옮겨져요.
        </p>
      </div>
      <PollList
        cards={cards}
        emptyTitle="아직 진행 중인 일정이 없어요"
        emptyBody="오른쪽 위 새 일정 만들기로 첫 조율을 시작해보세요"
        tour={tour}
      />
    </div>
  );
}
