"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AddMemberForm from "@/components/features/home/AddMemberForm";
import MemberList from "@/components/features/home/MemberList";
import ActionButton from "@/components/ui/ActionButton";
import InlineNotice from "@/components/ui/InlineNotice";
import PageShell from "@/components/ui/PageShell";
import TextInput from "@/components/ui/TextInput";
import { useGroup } from "@/contexts/GroupContext";
import {
  clearObsoleteLocalGroupData,
  readRecentGroup,
} from "@/lib/validation";
import type { RecentGroupSummary } from "@/types";

interface CreateFormErrors {
  groupName?: string;
  member?: string;
  selfMember?: string;
  submit?: string;
}

const focusField = (id: string) => {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.focus();
  });
};

const SelfMemberSelect = ({
  disabled,
  error,
  id,
  members,
  value,
  onChange,
}: {
  disabled: boolean;
  error?: string;
  id: string;
  members: string[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="w-full">
    <label
      htmlFor={id}
      className="mb-1 block text-sm font-extrabold text-gray-700"
    >
      あなたは誰ですか？
    </label>
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      required
      aria-describedby={error ? `${id}Error` : undefined}
      aria-invalid={Boolean(error)}
      className="min-h-12 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2.5 text-base text-gray-800 shadow-sm transition-colors focus-visible:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 aria-invalid:border-red-400 aria-invalid:ring-red-200"
    >
      <option value="">選択してください</option>
      {members.map((member) => (
        <option key={member} value={member}>
          {member}
        </option>
      ))}
    </select>
    {error && (
      <p
        id={`${id}Error`}
        role="alert"
        className="mt-2 text-sm font-bold text-red-600"
      >
        {error}
      </p>
    )}
  </div>
);

export default function HomePage() {
  const router = useRouter();
  const { createSharedGroup } = useGroup();
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [selfMember, setSelfMember] = useState("");
  const [recentGroup, setRecentGroup] =
    useState<RecentGroupSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<CreateFormErrors>({});

  useEffect(() => {
    clearObsoleteLocalGroupData(window.localStorage);
    setRecentGroup(readRecentGroup(window.localStorage));
  }, []);

  const clearErrors = (...keys: (keyof CreateFormErrors)[]) => {
    setErrors((current) => {
      const next = { ...current };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    });
  };

  const addMember = (memberName: string) => {
    if (members.includes(memberName)) {
      setErrors((current) => ({
        ...current,
        member: "同じ名前のメンバーがすでに追加されています。",
      }));
      focusField("memberName");
      return false;
    }

    setMembers((current) => [...current, memberName]);
    clearErrors("member", "submit");
    return true;
  };

  const deleteMember = (memberName: string) => {
    setMembers((current) => current.filter((member) => member !== memberName));
    if (selfMember === memberName) {
      setSelfMember("");
    }
    clearErrors("member", "selfMember", "submit");
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = groupName.trim();
    const validationErrors: CreateFormErrors = {};
    if (!normalizedName) {
      validationErrors.groupName = "グループ名を入力してください。";
    }
    if (members.length < 2) {
      validationErrors.member = "メンバーを2人以上追加してください。";
    } else if (!selfMember) {
      validationErrors.selfMember = "自分のメンバーを選択してください。";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      if (validationErrors.groupName) {
        focusField("groupName");
      } else if (validationErrors.member) {
        focusField("memberName");
      } else {
        focusField("selfMember");
      }
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    try {
      const result = await createSharedGroup(
        normalizedName,
        members,
        selfMember
      );
      if (!result.ok) {
        setErrors({ submit: result.message });
        return;
      }
      router.push(`/groups/${result.data.groupId}`);
    } catch {
      setErrors({
        submit:
          "グループを作成できませんでした。通信状況を確認して、もう一度お試しください。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell width="md" contentClassName="items-center">
      <header className="w-full text-center">
        <h1 className="mb-2 text-4xl font-extrabold text-blue-800">
          ワリタビ
        </h1>
        <p className="mb-4 italic text-blue-600">
          旅行の割り勘を、みんなでスマートに。
        </p>
      </header>

      <div className="mb-5 flex h-40 w-72 max-w-full items-center justify-center">
        <Image
          src="/image/travel_icon.png"
          alt="旅行を楽しむ人たち"
          width={850}
          height={521}
          priority
          className="h-full w-full object-contain"
        />
      </div>

      <section
        aria-labelledby="createGroupHeading"
        className="mb-6 w-full rounded-2xl bg-white/45 p-5 shadow-md backdrop-blur-sm"
      >
        <h2
          id="createGroupHeading"
          className="text-center text-xl font-extrabold text-blue-800"
        >
          グループ作成
        </h2>
        <p className="mt-1 text-center text-sm font-medium text-gray-600">
          グループ名とメンバーは作成後に変更できません。
        </p>

        <form
          className="mt-5 space-y-5"
          onSubmit={(event) => void handleCreate(event)}
          aria-busy={isSubmitting || undefined}
          noValidate
        >
          <fieldset disabled={isSubmitting} className="min-w-0 space-y-5">
            <legend className="sr-only">新しいグループの情報</legend>

            <div className="w-full">
              <label
                htmlFor="groupName"
                className="mb-1 block text-sm font-extrabold text-gray-700"
              >
                グループ名
              </label>
              <TextInput
                id="groupName"
                placeholder="例：東京旅行"
                value={groupName}
                required
                onChange={(event) => {
                  setGroupName(event.target.value);
                  clearErrors("groupName", "submit");
                }}
                aria-describedby={
                  errors.groupName ? "groupNameError" : undefined
                }
                aria-invalid={Boolean(errors.groupName)}
                autoComplete="off"
                disabled={isSubmitting}
              />
              {errors.groupName && (
                <p
                  id="groupNameError"
                  role="alert"
                  className="mt-2 text-sm font-bold text-red-600"
                >
                  {errors.groupName}
                </p>
              )}
            </div>

            <div>
              <AddMemberForm
                onAddMember={addMember}
                onInputChange={() => clearErrors("member", "submit")}
                onValidationError={(message) => {
                  setErrors((current) => ({ ...current, member: message }));
                  focusField("memberName");
                }}
                error={errors.member}
                disabled={isSubmitting}
              />
              <MemberList
                members={members}
                onDeleteMember={deleteMember}
                disabled={isSubmitting}
              />
            </div>

            {members.length >= 2 && (
              <SelfMemberSelect
                id="selfMember"
                members={members}
                value={selfMember}
                onChange={(value) => {
                  setSelfMember(value);
                  clearErrors("selfMember", "submit");
                }}
                error={errors.selfMember}
                disabled={isSubmitting}
              />
            )}

            {errors.submit && (
              <InlineNotice tone="error">{errors.submit}</InlineNotice>
            )}

            <ActionButton
              type="submit"
              loading={isSubmitting}
              loadingLabel="グループを作成しています..."
            >
              グループを作成
            </ActionButton>
          </fieldset>
        </form>
      </section>

      {recentGroup && (
        <section
          aria-labelledby="recentGroupHeading"
          className="mb-6 w-full rounded-2xl bg-white/55 p-5 shadow-md backdrop-blur-sm"
        >
          <h2
            id="recentGroupHeading"
            className="mb-4 text-center text-xl font-extrabold text-blue-800"
          >
            直近のグループ
          </h2>
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
            <p className="break-words text-lg font-extrabold text-blue-800">
              {recentGroup.groupName}
            </p>
            <ActionButton
              onClick={() => router.push(`/groups/${recentGroup.groupId}`)}
              disabled={isSubmitting}
              className="mt-3"
            >
              グループを開く
            </ActionButton>
          </div>
        </section>
      )}
    </PageShell>
  );
}
