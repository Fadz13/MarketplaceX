"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  currentPage: number;
  totalPages: number;
};

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > 3) {
    pages.push("...");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("...");
  }

  pages.push(total);

  return pages;
}

export function SearchPagination({ currentPage, totalPages }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <nav
      aria-label="Paginasi hasil pencarian"
      className="mt-8 flex items-center justify-center gap-1"
    >
      <button
        type="button"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Halaman sebelumnya"
        className="h-9 rounded-lg border px-3 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Sebelumnya
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="px-2 text-sm text-gray-400"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => goToPage(p)}
            aria-label={`Halaman ${p}`}
            aria-current={p === currentPage ? "page" : undefined}
            className={`h-9 min-w-9 rounded-lg px-3 text-sm font-medium ${
              p === currentPage
                ? "bg-black text-white"
                : "border hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Halaman berikutnya"
        className="h-9 rounded-lg border px-3 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Berikutnya →
      </button>
    </nav>
  );
}
