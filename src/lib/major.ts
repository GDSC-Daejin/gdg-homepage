const MAJOR_ALIASES: Record<string, string> = {
  "컴퓨터공학": "컴퓨터공학",
  "컴퓨터공학과": "컴퓨터공학",
  "컴퓨터공학전공": "컴퓨터공학",
  "시각정보디자인": "시각디자인",
  "시각디자인": "시각디자인",
};

export function normalizeMajor(major: string): string {
  const trimmed = major.trim();
  return MAJOR_ALIASES[trimmed.replace(/\s+/g, "")] ?? trimmed;
}
