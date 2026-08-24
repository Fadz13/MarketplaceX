"use client";

type Category = {
  id: string;
  name: string;
};

type Props = {
  search: string;
  categoryId: string;
  status: string;
  categories: Category[];
  onSearch: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onAddClick: () => void;
};

export function ProductToolbar({
  search,
  categoryId,
  status,
  categories,
  onSearch,
  onCategoryChange,
  onStatusChange,
  onAddClick,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-1 items-center gap-3">
        <input
          type="text"
          value={search}
          placeholder="Search product..."
          onChange={(e) =>
            onSearch(e.target.value)
          }
          className="w-full max-w-md rounded-lg border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />

        <select
          value={categoryId}
          onChange={(e) =>
            onCategoryChange(e.target.value)
          }
          className="rounded-lg border bg-white px-4 py-2 text-sm"
        >
          <option value="all">
            All categories
          </option>

          {categories.map((category) => (
            <option
              key={category.id}
              value={category.id}
            >
              {category.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) =>
            onStatusChange(e.target.value)
          }
          className="rounded-lg border bg-white px-4 py-2 text-sm"
        >
          <option value="all">
            All status
          </option>
          <option value="active">
            Active
          </option>
          <option value="inactive">
            Inactive
          </option>
          <option value="draft">
            Draft
          </option>
          <option value="suspended">
            Suspended
          </option>
          <option value="out_of_stock">
            Out of stock
          </option>
        </select>
      </div>

      <button
        type="button"
        onClick={onAddClick}
        className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        + Add Product
      </button>
    </div>
  );
}