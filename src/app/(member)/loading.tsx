export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <svg
        className="h-6 w-6 animate-spin text-primary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
      >
        <circle cx="12" cy="12" r="9" strokeOpacity={0.3} />
        <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
      </svg>
    </div>
  );
}
