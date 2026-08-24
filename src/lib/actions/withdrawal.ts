"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type WithdrawalStatus =
  | "pending"
  | "approved"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

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

export async function updateWithdrawalStatus(
  withdrawalId: string,
  nextStatus: WithdrawalStatus,
) {
  const supabase = await createClient();

  const { data: withdrawal, error } =
    await supabase
      .from("seller_withdrawals")
      .select(`
        id,
        seller_id,
        amount,
        status,
        reference_no
      `)
      .eq("id", withdrawalId)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!withdrawal) {
    throw new Error("Withdrawal not found.");
  }

  const currentStatus =
    withdrawal.status as WithdrawalStatus;

  if (currentStatus === nextStatus) {
    return;
  }

  const allowed =
    TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Cannot change withdrawal status from "${currentStatus}" to "${nextStatus}".`,
    );
  }

  const { error: updateError } =
    await supabase
      .from("seller_withdrawals")
      .update({
        status: nextStatus,
      })
      .eq("id", withdrawalId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/dashboard/withdrawals");
  revalidatePath("/dashboard/sellers");
}
export async function createSellerWithdrawal(
  amount: number,
  bankName: string,
  bankAccountNo: string,
  bankAccountName: string,
  feeAmount = 0,
) {
  const supabase = await createClient();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "Withdrawal amount must be greater than 0.",
    );
  }

  if (
    !Number.isFinite(feeAmount) ||
    feeAmount < 0
  ) {
    throw new Error(
      "Fee amount cannot be negative.",
    );
  }

  const { data, error } =
    await supabase.rpc(
      "create_seller_withdrawal",
      {
        p_amount: amount,
        p_bank_name: bankName,
        p_bank_account_no: bankAccountNo,
        p_bank_account_name:
          bankAccountName,
        p_fee_amount: feeAmount,
      },
    );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/withdrawals");

  return data;
}