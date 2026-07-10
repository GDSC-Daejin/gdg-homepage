import { fetchMaterials } from "@/lib/notion";
import { PageHeader } from "@/components/PageHeader";
import { MaterialsTable } from "@/components/MaterialsTable";

export const dynamic = "force-dynamic";

export default async function AdminMaterialsPage() {
  const { materials, error } = await fetchMaterials();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="자료실" description="등록된 모든 자료를 확인해요" />
      <MaterialsTable materials={materials} error={error} />
    </div>
  );
}
