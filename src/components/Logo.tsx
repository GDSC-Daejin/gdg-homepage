import type { SVGProps } from "react";

// GDG DJU 코드 브래킷 로고 마크. 파비콘(src/app/icon.svg)과 동일한 지오메트리.
export function Logo({
  className = "h-7 w-7",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      strokeWidth={60}
      strokeLinecap="round"
      className={className}
      aria-hidden
      {...props}
    >
      <line x1="80" y1="256" x2="210" y2="182" stroke="#EA4335" />
      <line x1="80" y1="256" x2="210" y2="330" stroke="#4285F4" />
      <line x1="432" y1="256" x2="302" y2="330" stroke="#FBBC04" />
      <line x1="432" y1="256" x2="302" y2="182" stroke="#34A853" />
    </svg>
  );
}
