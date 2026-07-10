import { fetchMaterials } from "@/lib/notion";
import { PageHeader } from "@/components/PageHeader";
import { MaterialsTable } from "@/components/MaterialsTable";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const { materials, error } = await fetchMaterials();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="자료실" description="세션 및 스터디 자료를 확인해요" />
      <MaterialsTable materials={materials} error={error} />
    </div>
  );
}
