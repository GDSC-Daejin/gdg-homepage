import Link from "next/link";

export type PokedexTab = "collection" | "probabilities" | "store";

const tabs: { id: PokedexTab; href: string; label: string }[] = [
  { id: "collection", href: "/pokedex", label: "내 도감" },
  { id: "probabilities", href: "/pokedex?tab=probabilities", label: "확률표" },
  { id: "store", href: "/store", label: "프렌들리숍" },
];

/** 포켓몬 화면(도감·확률표)과 프렌들리숍이 함께 쓰는 탭 줄. */
export function PokedexTabs({ active }: { active: PokedexTab }) {
  return (
    <nav aria-label="포켓몬 도감" className="mb-6 flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => (
        <Link key={tab.id} href={tab.href} aria-current={active === tab.id ? "page" : undefined} className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${active === tab.id ? "bg-primary-soft text-primary" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>{tab.label}</Link>
      ))}
    </nav>
  );
}
