import { createClient } from "@/lib/supabase/server";
import { BrandsClient } from "@/components/brands/brands-client";

export default async function BrandsPage() {
  const supabase = await createClient();

  const { data: brands, error } = await supabase
    .from("brands")
    .select(`
      id,
      name,
      slug,
      description,
      logo_url,
      website,
      is_verified,
      is_active,
      created_at,
      updated_at
    `)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Brands
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage product brands in MarketplaceX.
        </p>
      </div>

      <BrandsClient brands={brands ?? []} />
    </div>
  );
}