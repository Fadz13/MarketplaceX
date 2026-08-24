"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type UserStatus =
  | "active"
  | "suspended"
  | "banned";

type ActivityType =
  | "user_activated"
  | "user_suspended"
  | "user_banned";

const ALLOWED_STATUSES: UserStatus[] = [
  "active",
  "suspended",
  "banned",
];

function getActivityType(
  status: UserStatus,
): ActivityType {
  switch (status) {
    case "active":
      return "user_activated";

    case "suspended":
      return "user_suspended";

    case "banned":
      return "user_banned";
  }
}

export async function updateUserStatus(
  userId: string,
  status: UserStatus,
) {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error(
      "Invalid user status.",
    );
  }

  const supabase =
    await createClient();

  const {
    data: currentUser,
    error: currentError,
  } = await supabase
    .from("users")
    .select(`
      id,
      email,
      role,
      status
    `)
    .eq("id", userId)
    .maybeSingle();

  if (currentError) {
    throw new Error(
      currentError.message,
    );
  }

  if (!currentUser) {
    throw new Error(
      "User not found.",
    );
  }

  if (currentUser.status === status) {
    return;
  }

  const oldStatus =
    currentUser.status as UserStatus;

  const {
    error: updateError,
  } = await supabase
    .from("users")
    .update({
      status,
    })
    .eq("id", userId);

  if (updateError) {
    throw new Error(
      updateError.message,
    );
  }

  try {
    const {
      error: auditError,
    } = await supabase.rpc(
      "fn_log_activity",
      {
        p_activity:
          getActivityType(status),

        p_target_type: "user",

        p_target_id: userId,

        p_old_data: {
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
          status: oldStatus,
        },

        p_new_data: {
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
          status,
        },

        p_metadata: {
          source: "dashboard",
          action: "user_status_update",
        },
      },
    );

    if (auditError) {
      /*
       * Status sudah berubah, tetapi audit gagal.
       * Kembalikan status supaya perubahan user
       * tidak terjadi tanpa audit trail.
       */
      await supabase
        .from("users")
        .update({
          status: oldStatus,
        })
        .eq("id", userId);

      throw new Error(
        `Failed to create audit log: ${auditError.message}`,
      );
    }
  } catch (error) {
    throw error;
  }

  revalidatePath(
    "/dashboard/users",
  );
}