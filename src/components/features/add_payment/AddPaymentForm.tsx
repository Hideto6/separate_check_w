"use client";

import { useEffect, useState } from "react";
import { FaUser, FaUsers } from "react-icons/fa";
import ActionButton from "@/components/ui/ActionButton";
import ContentBox from "@/components/ui/ContentBox";
import TextInput from "@/components/ui/TextInput";
import type {
  Member,
  MutationResult,
  PaymentInput,
  PaymentRecord,
} from "@/types";

export default function AddPaymentForm({
  members,
  initialPayment,
  onSubmit,
  disabled,
}: {
  members: Member[];
  initialPayment?: PaymentRecord;
  onSubmit: (input: PaymentInput) => Promise<MutationResult>;
  disabled: boolean;
}) {
  const [title, setTitle] = useState(initialPayment?.title ?? "");
  const [payerMemberId, setPayerMemberId] = useState(
    initialPayment?.payerMemberId ?? ""
  );
  const [amount, setAmount] = useState(
    initialPayment ? String(initialPayment.amount) : ""
  );
  const [beneficiaryMemberIds, setBeneficiaryMemberIds] = useState<string[]>(
    initialPayment?.beneficiaryMemberIds ?? members.map((member) => member.id)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const availableIds = new Set(members.map((member) => member.id));
    setBeneficiaryMemberIds((current) =>
      current.filter((memberId) => availableIds.has(memberId))
    );
    if (payerMemberId && !availableIds.has(payerMemberId)) {
      setPayerMemberId("");
    }
  }, [members, payerMemberId]);

  const toggleBeneficiary = (memberId: string) => {
    setBeneficiaryMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  };

  const handleSubmit = async () => {
    const normalizedTitle = title.trim();
    const numericAmount = Number(amount);
    if (!normalizedTitle) {
      setError("内容を入力してください。");
      return;
    }
    if (!payerMemberId) {
      setError("支払う人を選択してください。");
      return;
    }
    if (!amount || !Number.isSafeInteger(numericAmount) || numericAmount < 0) {
      setError("金額には0以上の整数を入力してください。");
      return;
    }
    if (beneficiaryMemberIds.length === 0) {
      setError("精算するメンバーを1人以上選択してください。");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const result = await onSubmit({
      title: normalizedTitle,
      payerMemberId,
      amount: numericAmount,
      beneficiaryMemberIds,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.message);
    }
  };

  return (
    <ContentBox
      title={initialPayment ? "支払い記録を編集" : "支払い記録"}
      containerClassName="bg-blue-50 border-3 border-blue-200"
      titleClassName="text-lg font-semibold text-blue-600"
      bodyClassName="p-6"
      footer={
        <ActionButton
          onClick={() => void handleSubmit()}
          disabled={disabled || isSubmitting}
        >
          {isSubmitting ? "保存しています..." : initialPayment ? "変更を保存" : "追加"}
        </ActionButton>
      }
    >
      <div className="mb-6">
        <label htmlFor="description" className="block text-sm font-medium text-gray-600 mb-1">
          内容：
        </label>
        <TextInput
          id="description"
          placeholder="例: ホテル代"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="mb-6">
        <label htmlFor="payer" className="flex items-center text-sm font-medium text-gray-600 mb-1">
          <FaUser size={16} className="text-blue-500 mr-2" />
          支払う人：
        </label>
        <select
          id="payer"
          value={payerMemberId}
          onChange={(event) => setPayerMemberId(event.target.value)}
          className="w-full border border-gray-300 bg-white rounded-lg px-3 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">選択してください</option>
          {members.map((member) => (
            <option value={member.id} key={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="amount" className="block text-sm font-medium text-gray-600 mb-1">
          金額：
        </label>
        <div className="flex items-center">
          <TextInput
            id="amount"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="例: 15000"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <span className="ml-2 text-gray-600">円</span>
        </div>
      </div>

      <fieldset className="mb-4">
        <legend className="flex items-center text-sm font-medium text-gray-600 mb-2">
          <FaUsers size={18} className="text-red-500 mr-2" />
          精算するメンバー：
        </legend>
        <div className="flex flex-row flex-wrap gap-2">
          {members.map((member) => {
            const selected = beneficiaryMemberIds.includes(member.id);
            return (
              <button
                type="button"
                key={member.id}
                aria-pressed={selected}
                onClick={() => toggleBeneficiary(member.id)}
                className={`px-4 py-2 rounded-full font-semibold border text-sm transition-colors ${
                  selected
                    ? "bg-blue-500 text-white border-transparent"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {member.name}
              </button>
            );
          })}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm font-bold text-red-600">
          {error}
        </p>
      )}
    </ContentBox>
  );
}
