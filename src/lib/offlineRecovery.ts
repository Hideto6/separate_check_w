import { sortPendingPayments } from "@/lib/offlineStorage";
import type { OfflinePendingRecovery, PendingPayment } from "@/types";

export const recoveryPaymentsForUser = (
  recovery: OfflinePendingRecovery | null,
  authUserId: string | null
) =>
  recovery && authUserId && recovery.authUserId === authUserId
    ? recovery.pendingPayments
    : [];

export const canContinueWithOfflineData = (
  hasOfflineCache: boolean,
  authUserId: string | null,
  recovery: OfflinePendingRecovery | null
) =>
  authUserId !== null &&
  (hasOfflineCache || recoveryPaymentsForUser(recovery, authUserId).length > 0);

export const mergeRecoveryPaymentsForGroup = (
  recovery: OfflinePendingRecovery | null,
  authUserId: string,
  groupId: string,
  groupPayments: PendingPayment[]
): OfflinePendingRecovery => {
  const otherGroupPayments = recoveryPaymentsForUser(recovery, authUserId).filter(
    (payment) => payment.groupId !== groupId
  );
  return {
    authUserId,
    pendingPayments: sortPendingPayments([
      ...otherGroupPayments,
      ...groupPayments,
    ]),
  };
};

export const pendingPaymentsAsText = (
  pendingPayments: PendingPayment[]
) =>
  pendingPayments
    .map(
      (payment, index) =>
        [
          `未同期の支払い ${index + 1}`,
          `グループID: ${payment.groupId}`,
          `内容: ${payment.input.title}`,
          `金額: ${payment.input.amount}円`,
          `支払者ID: ${payment.input.payerMemberId}`,
          `精算対象ID: ${payment.input.beneficiaryMemberIds.join(", ")}`,
          `操作ID: ${payment.operationId}`,
          `状態: ${payment.status}`,
        ].join("\n")
    )
    .join("\n\n");
