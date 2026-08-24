"use client";

import { useState, useTransition } from "react";
import {
  createVariantOption,
  createVariantValue,
  deleteVariantOption,
  deleteVariantValue,
} from "@/lib/actions/variant";

type VariantValue = {
  id: string;
  value: string;
  display_value: string | null;
  color_hex: string | null;
  image_url: string | null;
  sort_order: number;
};

type VariantOption = {
  id: string;
  name: string;
  sort_order: number;
  values: VariantValue[];
};

type Props = {
  productId: string;
  options: VariantOption[];
  onChange?: () => void;
};

export function VariantManager({
  productId,
  options,
  onChange,
}: Props) {
  const [optionName, setOptionName] =
    useState("");
  const [valueInputs, setValueInputs] =
    useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, startTransition] =
    useTransition();

  function handleAddOption() {
    const name = optionName.trim();

    if (!name) {
      setError("Variant option name is required.");
      return;
    }

    setError("");

    startTransition(async () => {
      try {
        await createVariantOption(
          productId,
          name,
        );

        setOptionName("");
        onChange?.();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to create variant option.",
        );
      }
    });
  }

  function handleAddValue(
    optionId: string,
  ) {
    const value =
      valueInputs[optionId]?.trim() ?? "";

    if (!value) {
      setError("Variant value is required.");
      return;
    }

    setError("");

    startTransition(async () => {
      try {
        await createVariantValue(
          optionId,
          value,
        );

        setValueInputs((current) => ({
          ...current,
          [optionId]: "",
        }));

        onChange?.();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to create variant value.",
        );
      }
    });
  }

  function handleDeleteOption(
    optionId: string,
  ) {
    const confirmed = window.confirm(
      "Delete this variant option and all of its values?",
    );

    if (!confirmed) {
      return;
    }

    setError("");

    startTransition(async () => {
      try {
        await deleteVariantOption(optionId);
        onChange?.();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to delete variant option.",
        );
      }
    });
  }

  function handleDeleteValue(
    valueId: string,
  ) {
    const confirmed = window.confirm(
      "Delete this variant value?",
    );

    if (!confirmed) {
      return;
    }

    setError("");

    startTransition(async () => {
      try {
        await deleteVariantValue(valueId);
        onChange?.();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to delete variant value.",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-gray-50 p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold">
            Add Variant Option
          </h4>

          <p className="mt-1 text-xs text-gray-500">
            Example: Color, Size, Storage.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={optionName}
            onChange={(event) =>
              setOptionName(event.target.value)
            }
            placeholder="Example: Color"
            disabled={pending}
            className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
          />

          <button
            type="button"
            onClick={handleAddOption}
            disabled={pending}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
      </div>

      {options.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
          No variant options yet.
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((option) => (
            <div
              key={option.id}
              className="rounded-xl border bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">
                    {option.name}
                  </h4>

                  <p className="text-xs text-gray-500">
                    {option.values.length} value
                    {option.values.length !== 1
                      ? "s"
                      : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleDeleteOption(option.id)
                  }
                  disabled={pending}
                  className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => (
                  <div
                    key={value.id}
                    className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-1.5"
                  >
                    <span className="text-sm">
                      {value.display_value ??
                        value.value}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteValue(
                          value.id,
                        )
                      }
                      disabled={pending}
                      className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={
                    valueInputs[option.id] ?? ""
                  }
                  onChange={(event) =>
                    setValueInputs((current) => ({
                      ...current,
                      [option.id]:
                        event.target.value,
                    }))
                  }
                  placeholder={`Add value to ${option.name}`}
                  disabled={pending}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                />

                <button
                  type="button"
                  onClick={() =>
                    handleAddValue(option.id)
                  }
                  disabled={pending}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  + Value
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}