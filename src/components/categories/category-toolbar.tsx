"use client";

type StatusFilter = "all" | "active" | "inactive";

type Props = {
  onSearch: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onAddClick: () => void;
  status: StatusFilter;
};

export function CategoryToolbar({
  onSearch,
  onStatusChange,
  onAddClick,
  status,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-1 items-center gap-3">
        <input
          type="text"
          placeholder="Search category..."
          onChange={(e) => onSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />

        <select
          value={status}
          onChange={(e) =>
            onStatusChange(
              e.target.value as StatusFilter,
            )
          }
          className="rounded-lg border bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <button
        type="button"
        onClick={onAddClick}
        className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        + Add Category
      </button>
    </div>
  );
}