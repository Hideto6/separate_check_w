"use client";

import { useEffect, useRef, useState } from "react";
import { FaUser, FaUsers } from "react-icons/fa";
import ActionButton from "@/components/ui/ActionButton";
import ContentBox from "@/components/ui/ContentBox";
import InlineNotice from "@/components/ui/InlineNotice";
import TextInput from "@/components/ui/TextInput";
import type {
  Member,
  MutationResult,
  PaymentInput,
  PaymentRecord,
  SyncStatus,
} from "@/types";

type FieldErrors = Partial<
  Record<"title" | "payer" | "amount" | "beneficiaries" | "form", string>
>;

const sameIds = (left: string[], right: string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} role="alert" className="mt-1.5 text-sm font-bold text-red-600">
      {message}
    </p>
  ) : null;

export default function AddPaymentForm({
  members,
  initialPayment,
  defaultPayerMemberId = "",
  onSubmit,
  onDirtyChange,
  syncStatus,
}: {
  members: Member[];
  initialPayment?: PaymentRecord;
  defaultPayerMemberId?: string;
  onSubmit: (input: PaymentInput) => Promise<MutationResult>;
  onDirtyChange?: (dirty: boolean) => void;
  syncStatus: SyncStatus;
}) {
  const defaultBeneficiaryIds =
    initialPayment?.beneficiaryMemberIds ?? members.map((member) => member.id);
  const defaultPayer =
    initialPayment?.payerMemberId ?? defaultPayerMemberId;
  const [title, setTitle] = useState(initialPayment?.title ?? "");
  const [payerMemberId, setPayerMemberId] = useState(defaultPayer);
  const [amount, setAmount] = useState(
    initialPayment ? String(initialPayment.amount) : ""
  );
  const [beneficiaryMemberIds, setBeneficiaryMemberIds] = useState<string[]>(
    defaultBeneficiaryIds
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const payerRef = useRef<HTMLSelectElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const beneficiariesRef = useRef<HTMLDivElement>(null);
  const isOffline = syncStatus === "offline";

  useEffect(() => {
    const availableIds = new Set(members.map((member) => member.id));
    setBeneficiaryMemberIds((current) => {
      const next = current.filter((memberId) => availableIds.has(memberId));
      return sameIds(current, next) ? current : next;
    });
    setPayerMemberId((current) => {
      if (current && availableIds.has(current)) return current;
      return defaultPayerMemberId && availableIds.has(defaultPayerMemberId)
        ? defaultPayerMemberId
        : "";
    });
  }, [defaultPayerMemberId, members]);

  const isDirty =
    title !== (initialPayment?.title ?? "") ||
    payerMemberId !== defaultPayer ||
    amount !== (initialPayment ? String(initialPayment.amount) : "") ||
    !sameIds(beneficiaryMemberIds, defaultBeneficiaryIds);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChange?.(false);
    },
    [onDirtyChange]
  );

  const clearError = (field: keyof FieldErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  };

  const focusFirstError = (nextErrors: FieldErrors) => {
    if (nextErrors.title) titleRef.current?.focus();
    else if (nextErrors.payer) payerRef.current?.focus();
    else if (nextErrors.amount) amountRef.current?.focus();
    else if (nextErrors.beneficiaries) {
      beneficiariesRef.current?.querySelector("button")?.focus();
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || isOffline) return;

    const normalizedTitle = title.trim();
    const numericAmount = Number(amount);
    const nextErrors: FieldErrors = {};
    if (!normalizedTitle) {
      nextErrors.title = "支払い内容を入力してください。";
    }
    if (!payerMemberId) {
      nextErrors.payer = "支払う人を選択してください。";
    }
    if (!amount || !Number.isSafeInteger(numericAmount) || numericAmount < 0) {
      nextErrors.amount = "金額には0以上の整数を入力してください。";
    }
    if (beneficiaryMemberIds.length === 0) {
      nextErrors.beneficiaries =
        "精算するメンバーを1人以上選択してください。";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    try {
      const result = await onSubmit({
        title: normalizedTitle,
        payerMemberId,
        amount: numericAmount,
        beneficiaryMemberIds,
      });
      if (!result.ok) {
        setErrors({ form: result.message });
      }
    } catch {
      setErrors({
        form: "保存できませんでした。通信状態を確認して、もう一度お試しください。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const allMembersSelected =
    members.length > 0 && beneficiaryMemberIds.length === members.length;
  const formDisabled = isSubmitting || isOffline;

  return (
    <form
      noValidate
      aria-busy={isSubmitting || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <ContentBox
        title={initialPayment ? "支払い記録を編集" : "支払い記録"}
        containerClassName="border-2 border-blue-200 bg-blue-50"
        titleClassName="text-lg text-blue-700"
        bodyClassName="space-y-5 p-2 sm:p-3"
        footer={
          <ActionButton
            type="submit"
            disabled={isOffline}
            loading={isSubmitting}
            loadingLabel="保存しています..."
            aria-describedby={isOffline ? "payment-offline-message" : undefined}
          >
            {initialPayment ? "変更を保存" : "追加する"}
          </ActionButton>
        }
      >
        {isOffline && (
          <InlineNotice tone="warning" className="mb-5">
            <span id="payment-offline-message">
              オフライン中です。入力内容は保持されますが、再接続するまで編集・保存できません。
            </span>
          </InlineNotice>
        )}
        {syncStatus === "reconnecting" && (
          <InlineNotice tone="warning" className="mb-5">
            再接続しています。入力と保存は続けられます。
          </InlineNotice>
        )}
        {syncStatus === "connecting" && (
          <InlineNotice tone="warning" className="mb-5">
            同期状態を確認しています。入力と保存は続けられます。
          </InlineNotice>
        )}

        <fieldset disabled={formDisabled} className="space-y-5">
          <div>
            <label
              htmlFor="description"
              className="mb-1.5 block text-sm font-bold text-gray-700"
            >
              内容 <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <TextInput
              ref={titleRef}
              id="description"
              name="description"
              autoComplete="off"
              placeholder="例：ホテル代"
              value={title}
              required
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "description-error" : undefined}
              onChange={(event) => {
                setTitle(event.target.value);
                clearError("title");
              }}
            />
            <FieldError id="description-error" message={errors.title} />
          </div>

          <div>
            <label
              htmlFor="payer"
              className="mb-1.5 flex items-center text-sm font-bold text-gray-700"
            >
              <FaUser aria-hidden="true" size={16} className="mr-2 text-blue-500" />
              支払う人 <span className="ml-1 text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              ref={payerRef}
              id="payer"
              name="payer"
              value={payerMemberId}
              required
              aria-invalid={Boolean(errors.payer)}
              aria-describedby={errors.payer ? "payer-error" : undefined}
              onChange={(event) => {
                setPayerMemberId(event.target.value);
                clearError("payer");
              }}
              className="min-h-12 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2.5 text-base text-gray-800 shadow-sm focus-visible:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-100 aria-invalid:border-red-400"
            >
              <option value="">選択してください</option>
              {members.map((member) => (
                <option value={member.id} key={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            <FieldError id="payer-error" message={errors.payer} />
          </div>

          <div>
            <label
              htmlFor="amount"
              className="mb-1.5 block text-sm font-bold text-gray-700"
            >
              金額 <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="flex items-center gap-2">
              <TextInput
                ref={amountRef}
                id="amount"
                name="amount"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="例：15000"
                value={amount}
                required
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? "amount-error" : undefined}
                onChange={(event) => {
                  setAmount(event.target.value);
                  clearError("amount");
                }}
              />
              <span className="shrink-0 font-bold text-gray-600">円</span>
            </div>
            <FieldError id="amount-error" message={errors.amount} />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p
                id="beneficiaries-label"
                className="flex items-center text-sm font-bold text-gray-700"
              >
                <FaUsers aria-hidden="true" size={18} className="mr-2 text-red-500" />
                精算するメンバー
                <span className="ml-1 text-red-500" aria-hidden="true">*</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setBeneficiaryMemberIds(
                    allMembersSelected ? [] : members.map((member) => member.id)
                  );
                  clearError("beneficiaries");
                }}
                className="min-h-11 rounded-full px-3 text-sm font-bold text-blue-700 underline-offset-2 hover:bg-blue-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {allMembersSelected ? "選択解除" : "全員を選択"}
              </button>
            </div>
            <div
              ref={beneficiariesRef}
              role="group"
              aria-labelledby="beneficiaries-label"
              aria-describedby={
                errors.beneficiaries ? "beneficiaries-error" : undefined
              }
              className="flex flex-wrap gap-2"
            >
              {members.map((member) => {
                const selected = beneficiaryMemberIds.includes(member.id);
                return (
                  <button
                    type="button"
                    key={member.id}
                    aria-pressed={selected}
                    onClick={() => {
                      setBeneficiaryMemberIds((current) =>
                        current.includes(member.id)
                          ? current.filter((id) => id !== member.id)
                          : [...current, member.id]
                      );
                      clearError("beneficiaries");
                    }}
                    className={`min-h-11 max-w-full break-words rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                      selected
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {member.name}
                  </button>
                );
              })}
            </div>
            <FieldError
              id="beneficiaries-error"
              message={errors.beneficiaries}
            />
          </div>
        </fieldset>

        {errors.form && (
          <InlineNotice tone="error" className="mt-5">
            {errors.form}
          </InlineNotice>
        )}
      </ContentBox>
    </form>
  );
}
