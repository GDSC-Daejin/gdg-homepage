const ERROR_MESSAGES: Record<string, string> = {
  NOT_MEMBER: "회원만 이용할 수 있어요",
  ALREADY_REGISTERED: "이미 신청한 이벤트예요",
  NOT_REGISTERED: "신청 내역이 없어요",
  INVALID_CODE: "출석 코드가 올바르지 않아요",
  ALREADY_CHECKED: "이미 출석 처리됐어요",
  EVENT_NOT_FOUND: "이벤트를 찾을 수 없어요",
  NO_CODE_ISSUED: "출석 코드가 아직 발급되지 않았어요",
  FORBIDDEN: "권한이 없어요",
  INVALID_INPUT: "입력값이 올바르지 않아요",
  NOT_FOUND: "대상을 찾을 수 없어요",
  ORGANIZER_EXISTS: "오거나이저는 1명만 지정할 수 있어요",
  DUPLICATE_APPLICANT: "이미 같은 학번/연락처로 지원한 내역이 있어요",
  RATE_LIMITED: "잠시 후 다시 시도해주세요",
  TOO_MANY_ATTEMPTS: "시도 횟수를 초과했어요. 잠시 후 다시 해주세요",
  SLACK_ALREADY_LINKED: "이미 다른 회원에게 연결된 슬랙 계정이에요",
};

export function toKoreanError(e: unknown): string {
  const code =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e !== null && "message" in e
        ? String((e as { message: unknown }).message)
        : "";

  return ERROR_MESSAGES[code] ?? "요청을 처리하지 못했어요";
}
