"use client";

import { useState, type FormEvent } from "react";

import { createSellerWithdrawal } from "@/lib/actions/withdrawal";

type Props = {
  availableBalance: number;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export function WithdrawalForm({
  availableBalance,
}: Props) {
  const [amount, setAmount] =
    useState("");

  const [bankName, setBankName] =
    useState("");

  const [
    bankAccountNo,
    setBankAccountNo,
  ] = useState("");

  const [
    bankAccountName,
    setBankAccountName,
  ] = useState("");

  const [pending, setPending] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount,
      ) ||
      numericAmount <= 0
    ) {
      setError(
        "Enter a valid withdrawal amount.",
      );
      return;
    }

    if (
      numericAmount >
      availableBalance
    ) {
      setError(
        `Maximum available balance is ${formatPrice(
          availableBalance,
        )}.`,
      );
      return;
    }

    if (!bankName.trim()) {
      setError(
        "Bank name is required.",
      );
      return;
    }

    if (!bankAccountNo.trim()) {
      setError(
        "Bank account number is required.",
      );
      return;
    }

    if (!bankAccountName.trim()) {
      setError(
        "Bank account name is required.",
      );
      return;
    }

    setPending(true);

    try {
      await createSellerWithdrawal(
        numericAmount,
        bankName,
        bankAccountNo,
        bankAccountName,
        0,
      );

      setSuccess(
        "Withdrawal request created successfully.",
      );

      setAmount("");
      setBankName("");
      setBankAccountNo("");
      setBankAccountName("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create withdrawal.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-sm font-medium">
          Amount
        </label>

        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(event) =>
            setAmount(
              event.target.value,
            )
          }
          placeholder="0"
          className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-black"
        />

        <p className="mt-1 text-xs text-gray-500">
          Available:{" "}
          {formatPrice(
            availableBalance,
          )}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Bank Name
        </label>

        <input
          value={bankName}
          onChange={(event) =>
            setBankName(
              event.target.value,
            )
          }
          placeholder="BCA"
          className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Bank Account Number
        </label>

        <input
          value={bankAccountNo}
          onChange={(event) =>
            setBankAccountNo(
              event.target.value,
            )
          }
          placeholder="1234567890"
          className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Account Name
        </label>

        <input
          value={bankAccountName}
          onChange={(event) =>
            setBankAccountName(
              event.target.value,
            )
          }
          placeholder="Fad"
          className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={
          pending ||
          availableBalance <= 0
        }
        className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending
          ? "Submitting..."
          : "Request Withdrawal"}
      </button>
    </form>
  );
}