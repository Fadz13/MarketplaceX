"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SearchBar({ initialQuery }: { initialQuery?: string | undefined }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (trimmed === "") {
      params.delete("q");
    } else {
      params.set("q", trimmed);
    }

    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex w-full max-w-md items-center gap-2"
    >
      <label htmlFor="search-input" className="sr-only">
        Cari produk
      </label>
      <input
        id="search-input"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Cari produk..."
        className="h-9 flex-1 rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
      />
      <button
        type="submit"
        className="h-9 shrink-0 rounded-lg bg-black px-4 text-sm font-medium text-white hover:bg-gray-800"
      >
        Cari
      </button>
    </form>
  );
}
