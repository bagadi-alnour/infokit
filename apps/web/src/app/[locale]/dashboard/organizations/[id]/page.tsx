import { OrganizationDetailView } from "~/components/admin/organization-detail-page";

export default async function OrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const { notice } = await searchParams;
  return OrganizationDetailView({
    rawLocale,
    id,
    surface: "platform",
    notice,
  });
}
