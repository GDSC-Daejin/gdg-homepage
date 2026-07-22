const block = "animate-pulse rounded-xl bg-gray-100 dark:bg-gray-100";

// ponytail: 라우트별 스켈레톤 대신 PageHeader + 카드 리스트 공통 골격 하나.
export function PageSkeleton() {
  return (
    <div aria-hidden>
      <div className="pb-6">
        <div className={`h-7 w-40 ${block}`} />
        <div className={`mt-2 h-4 w-64 ${block}`} />
      </div>
      <div className="flex flex-col gap-3">
        <div className={`h-24 ${block}`} />
        <div className={`h-24 ${block}`} />
        <div className={`h-24 ${block}`} />
      </div>
    </div>
  );
}
