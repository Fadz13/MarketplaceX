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

export async function getSellerDetail(
  sellerId: string,
) {
  const supabase = await createClient();

  const [
    { data: user, error: userError },
    { data: store, error: storeError },
    { data: balance, error: balanceError },
    {
      data: withdrawals,
      error: withdrawalError,
    },
  ] = await Promise.all([
    supabase
      .from("users")
      .select(`
        id,
        email,
        role,
        status,
        email_verified,
        last_login_at,
        created_at
      `)
      .eq("id", sellerId)
      .maybeSingle(),

    supabase
      .from("stores")
      .select(`
        id,
        seller_id,
        store_name,
        slug,
        description,
        logo_url,
        banner_url,
        status,
        rating,
        review_count,
        follower_count,
        total_sales,
        total_revenue,
        province,
        city,
        created_at
      `)
      .eq("seller_id", sellerId)
      .maybeSingle(),

    supabase
      .from("seller_balances")
      .select(`
        id,
        seller_id,
        available_balance,
        pending_balance,
        total_earned,
        total_withdrawn,
        updated_at
      `)
      .eq("seller_id", sellerId)
      .maybeSingle(),

    supabase
      .from("seller_withdrawals")
      .select(`
        id,
        seller_id,
        amount,
        fee_amount,
        net_amount,
        bank_name,
        bank_account_no,
        bank_account_name,
        status,
        reference_no,
        admin_note,
        processed_by,
        processed_at,
        completed_at,
        created_at,
        updated_at
      `)
      .eq("seller_id", sellerId)
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (userError) {
    throw new Error(userError.message);
  }

  if (storeError) {
    throw new Error(
      storeError.message,
    );
  }

  if (balanceError) {
    throw new Error(
      balanceError.message,
    );
  }

  if (withdrawalError) {
    throw new Error(
      withdrawalError.message,
    );
  }

  if (!user) {
    throw new Error("Seller not found.");
  }

  return {
    user,
    store: store ?? null,
    balance: balance ?? null,
    withdrawals: withdrawals ?? [],
  };
}

export async function updateWithdrawalStatus(
  withdrawalId: string,
  nextStatus: WithdrawalStatus,
  adminNote?: string,
) {
  const supabase = await createClient();

  const {
    data: withdrawal,
    error: withdrawalError,
  } = await supabase
    .from("seller_withdrawals")
    .select(`
      id,
      seller_id,
      status,
      amount,
      fee_amount,
      net_amount
    `)
    .eq("id", withdrawalId)
    .maybeSingle();

  if (withdrawalError) {
    throw new Error(
      withdrawalError.message,
    );
  }

  if (!withdrawal) {
    throw new Error(
      "Withdrawal not found.",
    );
  }

  const currentStatus =
    withdrawal.status as WithdrawalStatus;

  if (currentStatus === nextStatus) {
    return;
  }

  const allowed =
    WITHDRAWAL_TRANSITIONS[
      currentStatus
    ] ?? [];

  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Cannot change withdrawal status from "${currentStatus}" to "${nextStatus}".`,
    );
  }

  const updateData: {
    status: WithdrawalStatus;
    admin_note?: string | null;
    processed_at?: string | null;
    completed_at?: string | null;
  } = {
    status: nextStatus,
  };

  if (adminNote !== undefined) {
    updateData.admin_note =
      adminNote.trim() || null;
  }

  if (
    nextStatus === "processing"
  ) {
    updateData.processed_at =
      new Date().toISOString();
  }

  if (
    nextStatus === "completed"
  ) {
    updateData.completed_at =
      new Date().toISOString();
  }

  const {
    error: updateError,
  } = await supabase
    .from("seller_withdrawals")
    .update(updateData)
    .eq("id", withdrawalId);

  if (updateError) {
    throw new Error(
      updateError.message,
    );
  }

  revalidatePath(
    "/dashboard/sellers",
  );
}