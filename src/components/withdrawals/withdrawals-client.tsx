"use client";

import { useMemo, useState } from "react";
import { updateWithdrawalStatus } from "@/lib/actions/withdrawal";

type Withdrawal = {
  id: string;
  seller_id: string;
  seller_email: string | null;
  store_name: string | null;
  amount: number;
  fee_amount: number;
  net_amount: number | null;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
  status: string;
  reference_no: string | null;
  created_at: string;
  processed_at: string | null;
  completed_at: string | null;
};

type Props = {
  withdrawals: Withdrawal[];
};

type WithdrawalStatus =
  | "pending"
  | "approved"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

const ITEMS_PER_PAGE = 10;

const STATUS_OPTIONS = [
  "all",
  "pending",
  "approved",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;

const TRANSITIONS: Record<
  WithdrawalStatus,
  WithdrawalStatus[]
> = {
  pending: ["approved", "cancelled"],
  approved: ["processing", "cancelled"],
  processing: ["completed", "failed"],
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

export function WithdrawalsClient({
  withdrawals,
}: Props) {
  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState<
      (typeof STATUS_OPTIONS)[number]
    >("all");

  const [page, setPage] =
    useState(1);

  const [pendingId, setPendingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const filtered = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return withdrawals.filter(
      (withdrawal) => {
        const matchesSearch =
          !keyword ||
          withdrawal.seller_email
            ?.toLowerCase()
            .includes(keyword) ||
          withdrawal.store_name
            ?.toLowerCase()
            .includes(keyword) ||
          withdrawal.bank_account_name
            .toLowerCase()
            .includes(keyword) ||
          withdrawal.reference_no
            ?.toLowerCase()
            .includes(keyword);

        const matchesStatus =
          status === "all" ||
          withdrawal.status === status;

        return (
          Boolean(matchesSearch) &&
          matchesStatus
        );
      },
    );
  }, [
    withdrawals,
    search,
    status,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length /
        ITEMS_PER_PAGE,
    ),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const paginated =
    filtered.slice(
      (currentPage - 1) *
        ITEMS_PER_PAGE,
      currentPage *
        ITEMS_PER_PAGE,
    );

  async function handleStatus(
    withdrawal: Withdrawal,
    nextStatus: WithdrawalStatus,
  ) {
    const currentStatus =
      withdrawal.status as WithdrawalStatus;

    if (
      currentStatus === nextStatus
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Change withdrawal to "${formatStatus(
          nextStatus,
        )}"?`,
      );

    if (!confirmed) {
      return;
    }

    setPendingId(withdrawal.id);
    setError("");

    try {
      await updateWithdrawalStatus(
        withdrawal.id,
        nextStatus,
      );

      window.location.reload();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update withdrawal.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(event) => {
            setSearch(
              event.target.value,
            );
            setPage(1);
          }}
          placeholder="Search seller, store, or reference..."
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
                  : formatStatus(
                      option,
                    )}
              </option>
            ),
          )}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">
                  Seller
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Amount
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Bank
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Status
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Created
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-500"
                  >
                    No withdrawals found.
                  </td>
                </tr>
              ) : (
                paginated.map(
                  (withdrawal) => {
                    const currentStatus =
                      withdrawal.status as WithdrawalStatus;

                    const transitions =
                      TRANSITIONS[
                        currentStatus
                      ] ?? [];

                    return (
                      <tr
                        key={
                          withdrawal.id
                        }
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold">
                            {withdrawal
                              .seller_email ??
                              "Unknown"}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {withdrawal
                              .store_name ??
                              "No store"}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-semibold">
                            {formatPrice(
                              withdrawal.amount,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Net{" "}
                            {formatPrice(
                              withdrawal.net_amount ??
                                0,
                            )}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {
                              withdrawal.bank_name
                            }
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {
                              withdrawal.bank_account_no
                            }
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                              currentStatus,
                            )}`}
                          >
                            {formatStatus(
                              currentStatus,
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {new Date(
                            withdrawal.created_at,
                          ).toLocaleString(
                            "id-ID",
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
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
                                    pendingId ===
                                    withdrawal.id
                                  }
                                  onClick={() =>
                                    void handleStatus(
                                      withdrawal,
                                      nextStatus,
                                    )
                                  }
                                  className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {pendingId ===
                                  withdrawal.id
                                    ? "Processing..."
                                    : formatStatus(
                                        nextStatus,
                                      )}
                                </button>
                              ),
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing{" "}
          {filtered.length === 0
            ? 0
            : (currentPage - 1) *
                ITEMS_PER_PAGE +
              1}
          -
          {Math.min(
            currentPage *
              ITEMS_PER_PAGE,
            filtered.length,
          )}{" "}
          of {filtered.length} withdrawals
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

          <span className="rounded-lg border px-3 py-2 text-sm">
            {currentPage}
          </span>

          <button
            type="button"
            disabled={
              currentPage === totalPages
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
    </div>
  );
}