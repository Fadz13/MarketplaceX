import { getCategories } from "@/lib/actions/category";
import { CategoriesClient } from "@/components/categories/categories-client";

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Categories
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage all product categories in MarketplaceX.
        </p>
      </div>

      <CategoriesClient categories={categories} />
    </div>
  );
}