import { fetchMaterials } from "@/lib/notion";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { formatKstDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const { materials, error } = await fetchMaterials();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="자료실" description="세션 및 스터디 자료를 확인해요" />

      {error ? (
        <EmptyState title="자료를 불러오지 못했어요" description={error} />
      ) : materials.length === 0 ? (
        <EmptyState title="등록된 자료가 없어요" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">제목</th>
                <th className="px-4 py-3 font-medium">유형</th>
                <th className="px-4 py-3 font-medium">이벤트</th>
                <th className="px-4 py-3 font-medium">날짜</th>
                <th className="px-4 py-3 font-medium">링크</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr
                  key={material.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {material.title || "(제목 없음)"}
                  </td>
                  <td className="px-4 py-3">
                    {material.type && (
                      <Badge tone="neutral">{material.type}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {material.event || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {material.date ? formatKstDate(material.date) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {material.url && (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          자료 열기
                        </a>
                      )}
                      <a
                        href={material.notionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:underline"
                      >
                        노션에서 보기
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
