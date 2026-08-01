import type {
  GroupSnapshot,
  MutationResult,
  PendingPayment,
} from "@/types";

export type PendingPaymentSyncOutcome =
  | "idle"
  | "synced"
  | "retry"
  | "blocked"
  | "storage_error";

export interface PendingPaymentSyncAdapter {
  createPayment: (
    payment: PendingPayment
  ) => Promise<MutationResult<string>>;
  refreshSnapshot: () => Promise<MutationResult<GroupSnapshot>>;
  updatePending: (
    payment: PendingPayment,
    updates: Partial<PendingPayment>
  ) => Promise<PendingPayment | null>;
  deletePending: (payment: PendingPayment) => Promise<boolean>;
}

const isRetryable = (result: Extract<MutationResult, { ok: false }>) =>
  result.code === "offline" || result.code === "unavailable";

const snapshotContainsPayment = (
  snapshot: GroupSnapshot,
  serverPaymentId: string
) => snapshot.payments.some((payment) => payment.id === serverPaymentId);

const updatePendingSafely = async (
  adapter: PendingPaymentSyncAdapter,
  payment: PendingPayment,
  updates: Partial<PendingPayment>
) => {
  try {
    return await adapter.updatePending(payment, updates);
  } catch {
    return null;
  }
};

const deletePendingSafely = async (
  adapter: PendingPaymentSyncAdapter,
  payment: PendingPayment
) => {
  try {
    return await adapter.deletePending(payment);
  } catch {
    return false;
  }
};

const confirmCommittedPayment = async (
  payment: PendingPayment,
  adapter: PendingPaymentSyncAdapter
): Promise<PendingPaymentSyncOutcome> => {
  if (!payment.serverPaymentId) {
    const updated = await updatePendingSafely(adapter, payment, {
      status: "blocked",
      lastError: "登録結果を確認できません。端末データを確認してください。",
    });
    return updated ? "blocked" : "storage_error";
  }

  let refreshed: Awaited<
    ReturnType<PendingPaymentSyncAdapter["refreshSnapshot"]>
  >;
  try {
    refreshed = await adapter.refreshSnapshot();
  } catch {
    return "retry";
  }
  if (!refreshed.ok) {
    if (isRetryable(refreshed)) {
      return "retry";
    }
    const updated = await updatePendingSafely(adapter, payment, {
      status: "blocked",
      lastError: refreshed.message,
    });
    return updated ? "blocked" : "storage_error";
  }

  if (!snapshotContainsPayment(refreshed.data, payment.serverPaymentId)) {
    const updated = await updatePendingSafely(adapter, payment, {
      status: "blocked",
      lastError:
        "登録した支払いを最新データで確認できませんでした。内容を確認してください。",
    });
    return updated ? "blocked" : "storage_error";
  }

  return (await deletePendingSafely(adapter, payment))
    ? "synced"
    : "storage_error";
};

export const syncPendingPaymentQueue = async (
  pendingPayments: PendingPayment[],
  adapter: PendingPaymentSyncAdapter
): Promise<PendingPaymentSyncOutcome> => {
  if (pendingPayments.length === 0) {
    return "idle";
  }

  let syncedAny = false;
  const ordered = [...pendingPayments].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );

  for (const payment of ordered) {
    if (payment.status === "blocked") {
      return "blocked";
    }

    if (payment.status === "committed") {
      const outcome = await confirmCommittedPayment(payment, adapter);
      if (outcome !== "synced") {
        return outcome;
      }
      syncedAny = true;
      continue;
    }

    const attemptedAt = new Date().toISOString();
    const markedSending = await updatePendingSafely(adapter, payment, {
      status: "sending",
      attemptCount: payment.attemptCount + 1,
      attemptedAt,
      lastError: undefined,
    });
    if (!markedSending) {
      return "storage_error";
    }

    let result: Awaited<
      ReturnType<PendingPaymentSyncAdapter["createPayment"]>
    >;
    try {
      result = await adapter.createPayment(markedSending);
    } catch {
      result = {
        ok: false,
        code: "unavailable",
        message:
          "共有サービスから応答がありません。接続後に自動で再試行します。",
      };
    }
    if (!result.ok) {
      const retryable = isRetryable(result);
      const updated = await updatePendingSafely(adapter, payment, {
        status: retryable ? "retry" : "blocked",
        lastError: result.message,
      });
      if (!updated) {
        return "storage_error";
      }
      return retryable ? "retry" : "blocked";
    }

    const committedPayment: PendingPayment = {
      ...markedSending,
      status: "committed",
      attemptCount: markedSending.attemptCount,
      attemptedAt,
      serverPaymentId: result.data,
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    };
    const markedCommitted = await updatePendingSafely(adapter, markedSending, {
      status: committedPayment.status,
      attemptCount: committedPayment.attemptCount,
      attemptedAt: committedPayment.attemptedAt,
      serverPaymentId: committedPayment.serverPaymentId,
      lastError: undefined,
    });
    if (!markedCommitted) {
      return "storage_error";
    }

    const outcome = await confirmCommittedPayment(committedPayment, adapter);
    if (outcome !== "synced") {
      return outcome;
    }
    syncedAny = true;
  }

  return syncedAny ? "synced" : "idle";
};
