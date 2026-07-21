import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(path, "utf8");

describe("접근성 primitive", () => {
  it("폼 오류를 컨트롤과 alert로 연결한다", async () => {
    const [input, textarea, select, datePicker] = await Promise.all([
      read("src/components/Input.tsx"),
      read("src/components/Textarea.tsx"),
      read("src/components/Select.tsx"),
      read("src/components/DatePicker.tsx"),
    ]);

    for (const source of [input, textarea, select, datePicker]) {
      expect(source).toContain("aria-invalid={error ? true : undefined}");
      expect(source).toContain("aria-describedby={error ? errorId : undefined}");
      expect(source).toContain('role="alert"');
    }
  });

  it("Select는 listbox 키보드 상호작용과 활성 옵션을 제공한다", async () => {
    const source = await read("src/components/Select.tsx");

    expect(source).toContain('role="combobox"');
    expect(source).toContain("aria-controls={listboxId}");
    expect(source).toContain("aria-activedescendant");
    expect(source).toContain("function handleKeyDown");
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"]) {
      expect(source).toContain(`"${key}"`);
    }
    expect(source).toContain("optionId(index)");
    expect(source).toContain("aria-labelledby={label ? labelId : undefined}");
  });
});

describe("탐색과 상태 안내", () => {
  it("skip link, 현재 페이지, 테마와 모달 이름을 노출한다", async () => {
    const [shell, theme, modal, sidebar, adminSidebar] = await Promise.all([
      read("src/components/ResponsiveShell.tsx"),
      read("src/app/(member)/ThemeToggle.tsx"),
      read("src/components/Modal.tsx"),
      read("src/app/(member)/SidebarNav.tsx"),
      read("src/app/admin/AdminSidebarNav.tsx"),
    ]);

    expect(shell).toContain('href="#main-content"');
    expect(shell).toContain('id="main-content"');
    expect(shell).toContain("tabIndex={-1}");
    expect(theme).toContain('role="group"');
    expect(theme).toContain('aria-label="테마"');
    expect(theme).toContain("aria-pressed={theme === option.key}");
    expect(modal).toContain("ariaLabel?: string");
    expect(modal).toContain("aria-label={ariaLabel}");
    expect(sidebar).toContain('aria-current={active ? "page" : undefined}');
    expect(adminSidebar).toContain('aria-current={active ? "page" : undefined}');
  });

  it("캘린더와 드롭다운 상태를 키보드와 라이브 리전으로 안내한다", async () => {
    const [datePicker, bell, avatar, css] = await Promise.all([
      read("src/components/DatePicker.tsx"),
      read("src/app/(member)/NotificationBell.tsx"),
      read("src/app/(member)/profile/ProfileAvatar.tsx"),
      read("src/app/globals.css"),
    ]);

    expect(datePicker).toContain('role="dialog"');
    expect(datePicker).toContain('role="grid"');
    expect(datePicker).toContain("calendarRef.current?.focus()");
    expect(datePicker).toContain("aria-label={`${viewY}년 ${viewM}월 ${d}일`}");
    expect(datePicker).toContain("aria-pressed={isSelected(d)}");
    expect(datePicker).toContain('aria-current={isToday(d) ? "date" : undefined}');
    expect(bell).toContain("function handleMenuKeyDown");
    expect(bell).toContain('aria-live="polite"');
    expect(avatar).toContain('role="status"');
    expect(avatar).toContain('aria-live="polite"');
    expect(css).toContain("a:focus-visible");
    expect(css).toContain("[role=\"button\"]:focus-visible");
  });
});
