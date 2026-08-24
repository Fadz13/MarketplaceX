"use client";

type Props = {
  search: string;
  filter: "all" | "active" | "inactive" | "verified";
  onSearch: (value: string) => void;
  onFilter: (
    value: "all" | "active" | "inactive" | "verified",
  ) => void;
  onAddClick: () => void;
};

export function BrandToolbar({
  search,
  filter,
  onSearch,
  onFilter,
  onAddClick,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-1 items-center gap-3">
        <input
          value={search}
          placeholder="Search brand..."
          onChange={(event) =>
            onSearch(event.target.value)
          }
          className="w-full max-w-md rounded-lg border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />

        <select
          value={filter}
          onChange={(event) =>
            onFilter(
              event.target.value as Props["filter"],
            )
          }
          className="rounded-lg border bg-white px-4 py-2 text-sm"
        >
          <option value="all">
            All brands
          </option>
          <option value="active">
            Active
          </option>
          <option value="inactive">
            Inactive
          </option>
          <option value="verified">
            Verified
          </option>
        </select>
      </div>

      <button
        type="button"
        onClick={onAddClick}
        className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        + Add Brand
      </button>
    </div>
  );
}