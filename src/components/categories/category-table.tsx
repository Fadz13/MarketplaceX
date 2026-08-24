import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { CategoryActions } from "./category-actions";

type Category = {
  id: string;
  name: string;
  slug?: string;
  created_at?: string;
  parent_id: string | null;
  parent: {
    id: string;
    name: string;
  } | null;
  status: string;
  depth: number;
};

type Props = {
  categories: Category[];
};

export function CategoryTable({ categories }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[320px]">Category</TableHead>
            <TableHead>Parent</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {categories.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-12 text-center text-sm text-gray-500"
              >
                No categories found.
              </TableCell>
            </TableRow>
          ) : (
            categories.map((category) => (
              <TableRow
                key={category.id}
                className="transition-colors hover:bg-gray-50"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-lg">
                      📁
                    </div>

                    <div>
                      <p className="font-semibold">
                        {category.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {category.slug ?? "-"}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {category.parent?.name ?? "-"}
                </TableCell>

                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      category.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {category.status}
                  </span>
                </TableCell>

                <TableCell>
                  {category.created_at
                    ? new Date(
                        category.created_at,
                      ).toLocaleDateString()
                    : "-"}
                </TableCell>

                <TableCell className="text-right">
                  <CategoryActions
                    categoryId={category.id}
                    categoryName={category.name}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}