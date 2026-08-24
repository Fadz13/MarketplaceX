"use client";

import { useMemo, useState } from "react";

import {
  getSellerDetail,
  updateWithdrawalStatus,
} from "@/lib/actions/seller";

type Seller = {
  id: string;
  email: string;
  role: string;
  status: string;

  store_id: string | null;
  store_name: string | null;
  store_status: string | null;
  rating: number;
  review_count: number;
  follower_count: number;
  total_sales: number;
  total_revenue: number;

  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
};

type SellerDetail = Awaited<
  ReturnType<typeof getSellerDetail>
>;

type WithdrawalStatus =
  | "pending"
  | "approved"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

type Props = {
  sellers: Seller[];
};

const ITEMS_PER_PAGE = 10;

const STATUS_OPTIONS = [
  "all",
  "active",
  "suspended",
  "banned",
] as const;

const WITHDRAWAL_TRANSITIONS: Record<
  WithdrawalStatus,
  WithdrawalStatus[]
> = {
  pending: [
    "approved",
    "cancelled",
  ],

  approved: [
    "processing",
    "cancelled",
  ],

  processing: [
    "completed",
    "failed",
  ],

  completed: [],

  failed: [],

  cancelled: [],
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

function getStatusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";

    case "suspended":
      return "bg-yellow-100 text-yellow-700";

    case "banned":
      return "bg-red-100 text-red-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getWithdrawalStatusClass(
  status: string,
) {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-700";

    case "approved":
      return "bg-blue-100 text-blue-700";

    case "processing":
      return "bg-purple-100 text-purple-700";

    case "completed":
      return "bg-green-100 text-green-700";

    case "failed":
      return "bg-red-100 text-red-700";

    case "cancelled":
      return "bg-gray-100 text-gray-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function SellersClient({
  sellers,
}: Props) {
  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState<
      (typeof STATUS_OPTIONS)[number]
    >("all");

  const [page, setPage] =
    useState(1);

  const [
    selectedSellerId,
    setSelectedSellerId,
  ] = useState<string | null>(null);

  const [
    detail,
    setDetail,
  ] = useState<SellerDetail | null>(
    null,
  );

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    detailError,
    setDetailError,
  ] = useState("");

  const [
    withdrawalPending,
    setWithdrawalPending,
  ] = useState(false);

  const [
    withdrawalError,
    setWithdrawalError,
  ] = useState("");

  const filteredSellers = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return sellers.filter((seller) => {
      const matchesSearch =
        !keyword ||
        seller.email
          .toLowerCase()
          .includes(keyword) ||
        seller.store_name
          ?.toLowerCase()
          .includes(keyword);

      const matchesStatus =
        status === "all" ||
        seller.status === status;

      return (
        Boolean(matchesSearch) &&
        matchesStatus
      );
    });
  }, [sellers, search, status]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredSellers.length /
        ITEMS_PER_PAGE,
    ),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const paginatedSellers =
    filteredSellers.slice(
      (currentPage - 1) *
        ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE,
    );

  const start =
    filteredSellers.length === 0
      ? 0
      : (currentPage - 1) *
          ITEMS_PER_PAGE +
        1;

  const end = Math.min(
    currentPage * ITEMS_PER_PAGE,
    filteredSellers.length,
  );

  async function openSeller(
    sellerId: string,
  ) {
    setSelectedSellerId(sellerId);
    setDetail(null);
    setDetailError("");
    setWithdrawalError("");
    setDetailLoading(true);

    try {
      const data =
        await getSellerDetail(
          sellerId,
        );

      setDetail(data);
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Failed to load seller detail.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeSeller() {
    setSelectedSellerId(null);
    setDetail(null);
    setDetailError("");
    setWithdrawalError("");
  }

  async function handleWithdrawalStatus(
    withdrawalId: string,
    nextStatus: WithdrawalStatus,
  ) {
    setWithdrawalPending(true);
    setWithdrawalError("");

    const dangerous =
      nextStatus === "cancelled" ||
      nextStatus === "failed";

    if (dangerous) {
      const confirmed =
        window.confirm(
          `Change withdrawal status to "${formatStatus(
            nextStatus,
          )}"?`,
        );

      if (!confirmed) {
        setWithdrawalPending(false);
        return;
      }
    }

    try {
      await updateWithdrawalStatus(
        withdrawalId,
        nextStatus,
      );

      if (selectedSellerId) {
        const data =
          await getSellerDetail(
            selectedSellerId,
          );

        setDetail(data);
      }
    } catch (error) {
      setWithdrawalError(
        error instanceof Error
          ? error.message
          : "Failed to update withdrawal status.",
      );
    } finally {
      setWithdrawalPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <input
          value={search}
          onChange={(event) => {
            setSearch(
              event.target.value,
            );
            setPage(1);
          }}
          placeholder="Search seller or store..."
          className="w-full max-w-md rounded-lg border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />

        <select
          value={status}
          onChange={(event) => {
            setStatus(
              event.target
                .value as (typeof STATUS_OPTIONS)[number],
            );
            setPage(1);
          }}
          className="rounded-lg border bg-white px-4 py-2 text-sm"
        >
          {STATUS_OPTIONS.map(
            (option) => (
              <option
                key={option}
                value={option}
              >
                {option === "all"
                  ? "All status"
                  : formatStatus(option)}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">
                  Seller
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Store
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Status
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Sales
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Revenue
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Available
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedSellers.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-500"
                  >
                    No sellers found.
                  </td>
                </tr>
              ) : (
                paginatedSellers.map(
                  (seller) => (
                    <tr
                      key={seller.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            openSeller(
                              seller.id,
                            )
                          }
                          className="text-left"
                        >
                          <p className="font-semibold hover:underline">
                            {
                              seller.email
                            }
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {seller.id}
                          </p>
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        {seller.store_name ??
                          "No store"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                            seller.status,
                          )}`}
                        >
                          {formatStatus(
                            seller.status,
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {seller.total_sales}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {formatPrice(
                          seller.total_revenue,
                        )}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {formatPrice(
                          seller.available_balance,
                        )}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {start}-{end} of{" "}
          {filteredSellers.length} sellers
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() =>
              setPage(
                (value) =>
                  value - 1,
              )
            }
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from(
              { length: totalPages },
              (_, index) =>
                index + 1,
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() =>
                  setPage(pageNumber)
                }
                className={`h-9 min-w-9 rounded-lg px-3 text-sm ${
                  currentPage ===
                  pageNumber
                    ? "bg-black text-white"
                    : "border hover:bg-gray-100"
                }`}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={
              currentPage ===
              totalPages
            }
            onClick={() =>
              setPage(
                (value) =>
                  value + 1,
              )
            }
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      {selectedSellerId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeSeller}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-bold">
                  Seller Detail
                </h2>

                {detail?.user.email && (
                  <p className="mt-1 text-sm text-gray-500">
                    {detail.user.email}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={closeSeller}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-6">
              {detailLoading ? (
                <div className="py-12 text-center text-sm text-gray-500">
                  Loading seller...
                </div>
              ) : detailError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {detailError}
                </div>
              ) : detail ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-gray-500">
                        Account Status
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatStatus(
                          detail.user
                            .status,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-gray-500">
                        Store
                      </p>

                      <p className="mt-1 font-semibold">
                        {detail.store
                          ?.store_name ??
                          "No store"}
                      </p>
                    </div>

                    <div className="rounded-xl border p-4">
                      <p className="text-xs text-gray-500">
                        Store Status
                      </p>

                      <p className="mt-1 font-semibold">
                        {detail.store
                          ? formatStatus(
                              detail.store
                                .status,
                            )
                          : "No store"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold">
                      Store Statistics
                    </h3>

                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Sales
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {detail.store
                            ?.total_sales ??
                            0}
                        </p>
                      </div>

                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Revenue
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {formatPrice(
                            Number(
                              detail.store
                                ?.total_revenue ??
                                0,
                            ),
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Rating
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {Number(
                            detail.store
                              ?.rating ??
                              0,
                          ).toFixed(1)}
                        </p>
                      </div>

                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Reviews
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {
                            detail.store
                              ?.review_count
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold">
                      Seller Balance
                    </h3>

                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Available
                        </p>

                        <p className="mt-1 font-bold">
                          {formatPrice(
                            Number(
                              detail.balance
                                ?.available_balance ??
                                0,
                            ),
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Pending
                        </p>

                        <p className="mt-1 font-bold">
                          {formatPrice(
                            Number(
                              detail.balance
                                ?.pending_balance ??
                                0,
                            ),
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Total Earned
                        </p>

                        <p className="mt-1 font-bold">
                          {formatPrice(
                            Number(
                              detail.balance
                                ?.total_earned ??
                                0,
                            ),
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Total Withdrawn
                        </p>

                        <p className="mt-1 font-bold">
                          {formatPrice(
                            Number(
                              detail.balance
                                ?.total_withdrawn ??
                                0,
                            ),
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        Withdrawals
                      </h3>

                      <span className="text-xs text-gray-500">
                        {
                          detail
                            .withdrawals
                            .length
                        }{" "}
                        record
                        {detail
                          .withdrawals
                          .length !== 1
                          ? "s"
                          : ""}
                      </span>
                    </div>

                    {withdrawalError && (
                      <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {withdrawalError}
                      </div>
                    )}

                    {detail.withdrawals
                      .length === 0 ? (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
                        No withdrawals yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {detail.withdrawals.map(
                          (withdrawal) => {
                            const currentStatus =
                              withdrawal.status as WithdrawalStatus;

                            const transitions =
                              WITHDRAWAL_TRANSITIONS[
                                currentStatus
                              ] ?? [];

                            return (
                              <div
                                key={
                                  withdrawal.id
                                }
                                className="rounded-xl border p-4"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="font-semibold">
                                      {formatPrice(
                                        Number(
                                          withdrawal.amount,
                                        ),
                                      )}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                      Net:{" "}
                                      {formatPrice(
                                        Number(
                                          withdrawal.net_amount ??
                                            0,
                                        ),
                                      )}
                                    </p>
                                  </div>

                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getWithdrawalStatusClass(
                                      currentStatus,
                                    )}`}
                                  >
                                    {formatStatus(
                                      currentStatus,
                                    )}
                                  </span>
                                </div>

                                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                                  <div>
                                    <p className="text-xs text-gray-500">
                                      Bank
                                    </p>

                                    <p className="font-medium">
                                      {
                                        withdrawal.bank_name
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs text-gray-500">
                                      Account
                                    </p>

                                    <p className="font-medium">
                                      {
                                        withdrawal.bank_account_no
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs text-gray-500">
                                      Name
                                    </p>

                                    <p className="font-medium">
                                      {
                                        withdrawal.bank_account_name
                                      }
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 text-xs text-gray-500">
                                  Created:{" "}
                                  {new Date(
                                    withdrawal.created_at,
                                  ).toLocaleString(
                                    "id-ID",
                                  )}
                                </div>

                                {transitions.length >
                                  0 && (
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {transitions.map(
                                      (
                                        nextStatus,
                                      ) => (
                                        <button
                                          key={
                                            nextStatus
                                          }
                                          type="button"
                                          disabled={
                                            withdrawalPending
                                          }
                                          onClick={() =>
                                            void handleWithdrawalStatus(
                                              withdrawal.id,
                                              nextStatus,
                                            )
                                          }
                                          className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                                        >
                                          {withdrawalPending
                                            ? "Processing..."
                                            : formatStatus(
                                                nextStatus,
                                              )}
                                        </button>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}