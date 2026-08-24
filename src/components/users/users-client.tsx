"use client";

import { useMemo, useState } from "react";

import { updateUserStatus } from "@/lib/actions/user";

type User = {
  id: string;
  email: string;
  role: string;
  status: string;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
};

type Props = {
  users: User[];
};

type UserStatus =
  | "active"
  | "suspended"
  | "banned";

const ITEMS_PER_PAGE = 10;

const ROLE_OPTIONS = [
  "all",
  "buyer",
  "seller",
  "moderator",
  "finance",
  "admin",
  "super_admin",
] as const;

const STATUS_OPTIONS = [
  "all",
  "active",
  "suspended",
  "banned",
] as const;

function formatStatus(
  status: string,
) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

function getStatusClass(
  status: string,
) {
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

export function UsersClient({
  users,
}: Props) {
  const [search, setSearch] =
    useState("");

  const [role, setRole] =
    useState<
      (typeof ROLE_OPTIONS)[number]
    >("all");

  const [status, setStatus] =
    useState<
      (typeof STATUS_OPTIONS)[number]
    >("all");

  const [page, setPage] =
    useState(1);

  const [pendingUserId, setPendingUserId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const filteredUsers =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return users.filter(
        (user) => {
          const matchesSearch =
            !keyword ||
            user.email
              .toLowerCase()
              .includes(keyword);

          const matchesRole =
            role === "all" ||
            user.role === role;

          const matchesStatus =
            status === "all" ||
            user.status === status;

          return (
            matchesSearch &&
            matchesRole &&
            matchesStatus
          );
        },
      );
    }, [
      users,
      search,
      role,
      status,
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredUsers.length /
        ITEMS_PER_PAGE,
    ),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const paginatedUsers =
    filteredUsers.slice(
      (currentPage - 1) *
        ITEMS_PER_PAGE,
      currentPage *
        ITEMS_PER_PAGE,
    );

  const start =
    filteredUsers.length === 0
      ? 0
      : (currentPage - 1) *
          ITEMS_PER_PAGE +
        1;

  const end = Math.min(
    currentPage *
      ITEMS_PER_PAGE,
    filteredUsers.length,
  );

  async function handleStatusChange(
    user: User,
    nextStatus: UserStatus,
  ) {
    const label =
      formatStatus(nextStatus);

    if (
      user.status ===
      nextStatus
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Change ${user.email} to ${label}?`,
      );

    if (!confirmed) {
      return;
    }

    setPendingUserId(user.id);
    setError("");

    try {
      await updateUserStatus(
        user.id,
        nextStatus,
      );

      window.location.reload();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update user.",
      );
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => {
            setSearch(
              event.target.value,
            );
            setPage(1);
          }}
          placeholder="Search user email..."
          className="w-full max-w-md rounded-lg border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />

        <select
          value={role}
          onChange={(event) => {
            setRole(
              event.target
                .value as (typeof ROLE_OPTIONS)[number],
            );
            setPage(1);
          }}
          className="rounded-lg border bg-white px-4 py-2 text-sm"
        >
          {ROLE_OPTIONS.map(
            (option) => (
              <option
                key={option}
                value={option}
              >
                {option === "all"
                  ? "All roles"
                  : formatStatus(
                      option,
                    )}
              </option>
            ),
          )}
        </select>

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
                  User
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Role
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Status
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Verified
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Last Login
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedUsers.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-500"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map(
                  (user) => (
                    <tr
                      key={user.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold">
                          {user.email}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {user.id}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        {formatStatus(
                          user.role,
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                            user.status,
                          )}`}
                        >
                          {formatStatus(
                            user.status,
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {user.email_verified
                          ? "Yes"
                          : "No"}
                      </td>

                      <td className="px-4 py-3 text-gray-600">
                        {user.last_login_at
                          ? new Date(
                              user.last_login_at,
                            ).toLocaleString(
                              "id-ID",
                            )
                          : "Never"}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {user.status !==
                            "active" && (
                            <button
                              type="button"
                              disabled={
                                pendingUserId ===
                                user.id
                              }
                              onClick={() =>
                                void handleStatusChange(
                                  user,
                                  "active",
                                )
                              }
                              className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-green-50 disabled:opacity-50"
                            >
                              Activate
                            </button>
                          )}

                          {user.status !==
                            "suspended" && (
                            <button
                              type="button"
                              disabled={
                                pendingUserId ===
                                user.id
                              }
                              onClick={() =>
                                void handleStatusChange(
                                  user,
                                  "suspended",
                                )
                              }
                              className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-yellow-50 disabled:opacity-50"
                            >
                              Suspend
                            </button>
                          )}

                          {user.status !==
                            "banned" && (
                            <button
                              type="button"
                              disabled={
                                pendingUserId ===
                                user.id
                              }
                              onClick={() =>
                                void handleStatusChange(
                                  user,
                                  "banned",
                                )
                              }
                              className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                            >
                              Ban
                            </button>
                          )}
                        </div>
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
          {filteredUsers.length} users
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
    </div>
  );
}