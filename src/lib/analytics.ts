export const EVENTS = {
  applySubmit: "apply_submit",
  login: "login",
  attendanceCheck: "attendance_check",
  surveySubmit: "survey_submit",
} as const;

type Gtag = (
  command: "event",
  name: string,
  params?: Record<string, unknown>,
) => void;

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, params ?? {});
}
