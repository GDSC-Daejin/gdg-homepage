"use client";

import { useTheme, type Theme } from "@/lib/theme";

const options: { key: Theme; label: string }[] = [
  { key: "light", label: "라이트" },
  { key: "dark", label: "다크" },
  { key: "auto", label: "자동" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 text-xs font-medium">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => setTheme(option.key)}
          className={`flex-1 rounded-md px-2 py-1.5 ${
            theme === option.key
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-300"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
