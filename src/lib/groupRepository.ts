import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  GroupSnapshot,
  InvitePreview,
  MutationErrorCode,
  MutationResult,
  PaymentInput,
  Settlement,
} from "@/types";
import {
  parseCreatedGroup,
  parseGroupSnapshot,
  parseInvitePreview,
} from "@/lib/validation";

const errorMessages: Record<string, string> = {
  authentication_required: "認証が必要です。ページを再読み込みしてください。",
  group_membership_required: "このグループを操作する権限がありません。",
  group_owner_required: "この操作はグループ作成者だけが行えます。",
  group_name_empty: "グループ名を入力してください。",
  group_conflict: "他の人がグループを更新しました。最新状態を読み込みました。",
  members_too_short: "メンバーは2人以上必要です。",
  member_name_empty: "メンバー名を入力してください。",
  member_name_duplicate: "同じ名前のメンバーが既に存在します。",
  member_invalid: "指定したメンバーが見つかりません。",
  self_member_invalid: "自分のメンバーを選択してください。",
  invite_invalid: "招待リンクが無効または停止されています。",
  payment_title_empty: "支払い内容を入力してください。",
  payment_amount_invalid: "金額には0以上の整数を入力してください。",
  beneficiaries_empty: "精算するメンバーを1人以上選択してください。",
  beneficiaries_duplicate: "精算するメンバーが重複しています。",
  payer_invalid: "支払う人を選択してください。",
  beneficiary_invalid: "無効な精算メンバーが含まれています。",
  payment_conflict: "この支払いは他の人が更新しました。最新状態を読み込みました。",
  payment_operation_conflict:
    "端末に保存した支払いの内容が一致しません。内容を確認してください。",
  settlement_conflict: "精算内容が更新されました。最新の金額を確認してください。",
  transfer_conflict: "この精算記録は既に変更されています。",
  transfer_amount_invalid: "精算金額が正しくありません。",
  transfer_members_invalid: "精算する2人を確認してください。",
};

const isUnavailableStatus = (status: number) =>
  status === 0 ||
  status === 408 ||
  status === 429 ||
  (status >= 500 && status <= 599);

const codeForError = (
  error: PostgrestError,
  status: number
): MutationErrorCode => {
  if (error.message === "authentication_required") {
    return "unavailable";
  }
  if (
    error.code === "42501" ||
    [
      "group_membership_required",
      "group_owner_required",
    ].includes(error.message)
  ) {
    return "forbidden";
  }
  if (error.code === "40001") {
    return "conflict";
  }
  if (["22023", "23503", "23505", "23514"].includes(error.code)) {
    return "validation";
  }
  if (
    isUnavailableStatus(status) ||
    error.message.includes("AbortError") ||
    error.message.includes("Failed to fetch")
  ) {
    return "unavailable";
  }
  return "unknown";
};

const failureFromError = <T>(
  error: PostgrestError,
  status: number
): MutationResult<T> => ({
  ok: false,
  code: codeForError(error, status),
  message:
    errorMessages[error.message] ??
    (isUnavailableStatus(status)
      ? "共有サービスに接続できません。端末データを利用するか、時間をおいて再試行してください。"
      : "処理に失敗しました。通信状態を確認して、もう一度お試しください。"),
});

const invalidResponse = <T>(): MutationResult<T> => ({
  ok: false,
  code: "unknown",
  message: "サーバーから受け取ったデータの形式が正しくありません。",
});

const offlineFailure = <T>(): MutationResult<T> => ({
  ok: false,
  code: "offline",
  message: "オフライン中は編集できません。再接続してからお試しください。",
});

const unavailableFailure = <T>(): MutationResult<T> => ({
  ok: false,
  code: "unavailable",
  message:
    "共有サービスに接続できません。端末データを利用するか、時間をおいて再試行してください。",
});

const hasNetworkConnection = () =>
  typeof navigator === "undefined" || navigator.onLine;

export const fetchGroupSnapshot = async (
  client: SupabaseClient,
  groupId: string,
  signal?: AbortSignal
): Promise<MutationResult<GroupSnapshot>> => {
  if (!hasNetworkConnection()) {
    return offlineFailure();
  }
  const request = client.rpc("get_group_snapshot", {
    target_group_id: groupId,
  });
  if (signal) {
    request.abortSignal(signal);
  }
  let response: Awaited<typeof request>;
  try {
    response = await request;
  } catch {
    return hasNetworkConnection()
      ? unavailableFailure()
      : offlineFailure();
  }
  const { data, error, status } = response;
  if (error) {
    return failureFromError(error, status);
  }
  const snapshot = parseGroupSnapshot(data);
  return snapshot ? { ok: true, data: snapshot } : invalidResponse();
};

export const createSharedGroup = async (
  client: SupabaseClient,
  name: string,
  memberNames: string[],
  selfMemberName: string
): Promise<MutationResult<{ groupId: string; inviteToken: string }>> => {
  if (!hasNetworkConnection()) {
    return offlineFailure();
  }
  let response;
  try {
    response = await client.rpc("create_group", {
      group_name: name,
      member_names: memberNames,
      self_member_name: selfMemberName,
    });
  } catch {
    return hasNetworkConnection()
      ? unavailableFailure()
      : offlineFailure();
  }
  const { data, error, status } = response;
  if (error) {
    return failureFromError(error, status);
  }
  const created = parseCreatedGroup(data);
  return created ? { ok: true, data: created } : invalidResponse();
};

export const inspectInvite = async (
  client: SupabaseClient,
  token: string
): Promise<MutationResult<InvitePreview>> => {
  if (!hasNetworkConnection()) {
    return offlineFailure();
  }
  let response;
  try {
    response = await client.rpc("inspect_invite", {
      invite_token: token,
    });
  } catch {
    return hasNetworkConnection()
      ? unavailableFailure()
      : offlineFailure();
  }
  const { data, error, status } = response;
  if (error) {
    return failureFromError(error, status);
  }
  const preview = parseInvitePreview(data);
  return preview ? { ok: true, data: preview } : invalidResponse();
};

export const joinSharedGroup = async (
  client: SupabaseClient,
  token: string,
  memberId: string
): Promise<MutationResult<{ groupId: string }>> => {
  if (!hasNetworkConnection()) {
    return offlineFailure();
  }
  let response;
  try {
    response = await client.rpc("join_group", {
      invite_token: token,
      selected_member_id: memberId,
    });
  } catch {
    return hasNetworkConnection()
      ? unavailableFailure()
      : offlineFailure();
  }
  const { data, error, status } = response;
  if (error) {
    return failureFromError(error, status);
  }
  return typeof data === "string"
    ? { ok: true, data: { groupId: data } }
    : invalidResponse();
};

const runVoidMutation = async (
  client: SupabaseClient,
  functionName: string,
  parameters: Record<string, unknown>
): Promise<MutationResult> => {
  if (!hasNetworkConnection()) {
    return offlineFailure();
  }
  let response;
  try {
    response = await client.rpc(functionName, parameters);
  } catch {
    return hasNetworkConnection()
      ? unavailableFailure()
      : offlineFailure();
  }
  const { error, status } = response;
  return error
    ? failureFromError(error, status)
    : { ok: true, data: undefined };
};

export const addPayment = (
  client: SupabaseClient,
  groupId: string,
  input: PaymentInput
) =>
  runVoidMutation(client, "create_payment", {
    target_group_id: groupId,
    payment_title: input.title,
    payer_id: input.payerMemberId,
    payment_amount: input.amount,
    beneficiary_ids: input.beneficiaryMemberIds,
  });

export const addPaymentIdempotent = async (
  client: SupabaseClient,
  operationId: string,
  groupId: string,
  input: PaymentInput,
  signal?: AbortSignal
): Promise<MutationResult<string>> => {
  if (!hasNetworkConnection()) {
    return offlineFailure();
  }
  const request = client.rpc("create_payment_idempotent", {
    operation_id: operationId,
    target_group_id: groupId,
    payment_title: input.title,
    payer_id: input.payerMemberId,
    payment_amount: input.amount,
    beneficiary_ids: input.beneficiaryMemberIds,
  });
  if (signal) {
    request.abortSignal(signal);
  }
  let response: Awaited<typeof request>;
  try {
    response = await request;
  } catch {
    return hasNetworkConnection()
      ? unavailableFailure()
      : offlineFailure();
  }
  const { data, error, status } = response;
  if (error) {
    return failureFromError(error, status);
  }
  return typeof data === "string"
    ? { ok: true, data }
    : invalidResponse();
};

export const updatePayment = (
  client: SupabaseClient,
  paymentId: string,
  version: number,
  input: PaymentInput
) =>
  runVoidMutation(client, "update_payment", {
    target_payment_id: paymentId,
    expected_version: version,
    payment_title: input.title,
    payer_id: input.payerMemberId,
    payment_amount: input.amount,
    beneficiary_ids: input.beneficiaryMemberIds,
  });

export const deletePayment = (
  client: SupabaseClient,
  paymentId: string,
  version: number
) =>
  runVoidMutation(client, "delete_payment", {
    target_payment_id: paymentId,
    expected_version: version,
  });

export const recordTransfer = (
  client: SupabaseClient,
  groupId: string,
  revision: number,
  settlement: Settlement
) =>
  runVoidMutation(client, "record_settlement_transfer", {
    target_group_id: groupId,
    from_member_id: settlement.fromMemberId,
    to_member_id: settlement.toMemberId,
    transfer_amount: settlement.amount,
    expected_revision: revision,
  });

export const deleteTransfer = (
  client: SupabaseClient,
  transferId: string,
  version: number
) =>
  runVoidMutation(client, "delete_settlement_transfer", {
    target_transfer_id: transferId,
    expected_version: version,
  });

export const changeMyMember = (
  client: SupabaseClient,
  groupId: string,
  memberId: string
) =>
  runVoidMutation(client, "change_my_member", {
    target_group_id: groupId,
    selected_member_id: memberId,
  });

export const rotateInvite = async (
  client: SupabaseClient,
  groupId: string
): Promise<MutationResult<string>> => {
  if (!hasNetworkConnection()) {
    return offlineFailure();
  }
  let response;
  try {
    response = await client.rpc("rotate_invite", {
      target_group_id: groupId,
    });
  } catch {
    return hasNetworkConnection()
      ? unavailableFailure()
      : offlineFailure();
  }
  const { data, error, status } = response;
  if (error) {
    return failureFromError(error, status);
  }
  return typeof data === "string"
    ? { ok: true, data }
    : invalidResponse();
};

export const setInviteEnabled = (
  client: SupabaseClient,
  groupId: string,
  enabled: boolean
) =>
  runVoidMutation(client, "set_invite_enabled", {
    target_group_id: groupId,
    enabled,
  });

export const deleteSharedGroup = (client: SupabaseClient, groupId: string) =>
  runVoidMutation(client, "delete_group", {
    target_group_id: groupId,
  });
