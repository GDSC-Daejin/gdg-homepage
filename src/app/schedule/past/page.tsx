import { PollList } from "../PollList";
import { loadPollCards } from "../queries";
import styles from "../schedule.module.css";

export const dynamic = "force-dynamic";

export default async function SchedulePastPage() {
  const cards = await loadPollCards("past");

  return (
    <div className={styles.page}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <h1 style={{ margin: 0, font: "700 28px/1.35 var(--wds-font-sans)", letterSpacing: "-0.025em" }}>
          지난 일정
        </h1>
        <p
          style={{
            margin: 0,
            font: "400 15px/1.5 var(--wds-font-sans)",
            color: "var(--wds-label-alternative)",
          }}
        >
          확정했거나 응답 마감이 지난 조율이에요.
        </p>
      </div>
      <PollList
        cards={cards}
        emptyTitle="지난 일정이 없어요"
        emptyBody="확정하거나 마감이 지난 조율이 여기로 모여요"
      />
    </div>
  );
}
