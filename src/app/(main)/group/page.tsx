"use client";

// GroupPage
//  概要:
//    グループの立て替えを記録・管理をする画面。
//    HomePageのテキストに入力したグループ名・メンバーを画面上部に表示。
// 　　　　　　入力した立て替え記録をもとに精算方法を表示し、割り勘の効率化を図る。

//  主な機能:
//    - 「戻る」ボタンで前のページへ戻る
//    - 精算方法の一覧表示（支払人→対象者・金額）
//    - 立て替え記録の一覧表示（タイトル・立て替える人・立て替えられる人・金額・削除ボタン）
//    - 「記録する」ボタンで `/add_payment` ページへ遷移

import { useRouter } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import { useEffect, useState } from "react";
import { Settlement } from "@/types";
import { calculateSettlement } from "@/lib/calculations";
import { useGroup } from "@/contexts/GroupContext";
import GroupHeader from "@/components/features/group/GroupHeader";
import SettlementList from "@/components/features/group/SettlementList";
import RecordList from "@/components/features/group/RecordList";

export default function GroupPage() {
  const router = useRouter();
  const {
    isHydrated,
    groupName,
    members,
    records,
    deleteRecord,
    resetGroup,
  } = useGroup(); //Contextから取得
  const [settlements, setSettlements] = useState<Settlement[]>([]); //精算情報
  const [animatedSettlement, setAnimatedSettlement] = useState<number | null>(
    null
  ); //クリックされた精算情報のindexを管理
  const [completedSettlements, setCompletedSettlements] = useState<number[]>(
    []
  ); //完了した精算情報を管理

  useEffect(() => {
    const newSettlements =
      members.length > 0 ? calculateSettlement(records, members) : [];
    setSettlements(newSettlements);
    setCompletedSettlements([]);
    setAnimatedSettlement(null);
  }, [records, members]);

  useEffect(() => {
    if (isHydrated && (!groupName || members.length < 2)) {
      router.replace("/");
    }
  }, [groupName, isHydrated, members.length, router]);

  const handleSettlementClick = (index: number) => {
    const newCompleted = completedSettlements.includes(index)
      ? completedSettlements.filter((i) => i !== index)
      : [...completedSettlements, index]; //クリックした時に完了→未完了、未完了→完了とする処理

    setCompletedSettlements(newCompleted);

    if (!completedSettlements.includes(index)) {
      setAnimatedSettlement(index);
      setTimeout(() => {
        setAnimatedSettlement(null);
      }, 1000); //未完了→完了に切り替わった時にアニメーションを表示
    }
  };

  const handleBack = () => {
    if (
      window.confirm("ホームに戻ると記録がリセットされます。よろしいですか？")
    ) {
      resetGroup();
      router.push("/");
    }
  };

  if (!isHydrated || !groupName || members.length < 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 text-blue-800 font-bold">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <BackButton className="self-start" onClick={handleBack} />
      <GroupHeader groupName={groupName} members={members} />
      {/* 精算方法一覧 */}
      <SettlementList
        settlements={settlements}
        completedSettlements={completedSettlements}
        animatedSettlement={animatedSettlement}
        onSettlementClick={handleSettlementClick}
      />
      {/* 立て替え記録一覧 */}
      <RecordList
        records={records}
        onDeleteRecord={deleteRecord}
        onAddRecord={() => router.push("/add_payment")}
      />
    </div>
  );
}
