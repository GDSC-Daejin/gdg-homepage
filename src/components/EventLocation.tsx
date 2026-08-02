"use client";

import { useState } from "react";

export function EventLocation({
  location,
  address,
}: {
  location: string;
  address: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const mapUrl = `https://map.naver.com/p/search/${encodeURIComponent(address)}`;

  return (
    <div className="text-sm text-gray-700">
      {location && <p>장소: {location}</p>}
      {address && (
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-gray-500">
          <span>{address}</span>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            지도
          </a>
          <button
            type="button"
            onClick={copy}
            className="text-primary hover:underline"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </p>
      )}
    </div>
  );
}
