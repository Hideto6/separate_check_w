"use client";

// AddPaymentPage
//  概要:
//    GroupPageの立て替え記録の欄に、新しい記録を追加する画面。
//    ユーザーがタイトル・立て替える人・立て替えられる人・金額を入力し、記録として保存する。
//    入力完了後は前のページ（GroupPage）に戻る。
//    GroupPageの立て替え記録の欄に記録した内容が表示される。
//
//  主な機能:
//    - タイトルの入力（例: タクシー代）
//    - 立て替える人の選択（セレクトボックス）
//    - 金額の入力
//    - 立て替えられる人の複数選択（ボタンのON/OFF切り替え）
//    - 「追加」ボタンで記録を確定し前のページへ戻る
//    - 「戻る」ボタンで前のページへ戻る

import { useRouter } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import { useGroup } from "@/contexts/GroupContext";
import AddPaymentForm from "@/components/features/add_payment/AddPaymentForm";

export default function AddPaymentPage() {
  const router = useRouter();
  const { members, addRecord } = useGroup();

  const handleSuccess = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <BackButton className="self-start" />

      <div className="w-full max-w-xl mx-auto">
        <AddPaymentForm
          members={members}
          addRecord={addRecord}
          onSuccess={handleSuccess}
        />
      </div>
      <div className="h-35 m-10 flex items-center justify-end">
        <img
          src="/image/wallet_icon.png"
          alt="wallet icon"
          className="w-auto h-full object-contain"
        />
      </div>
    </div>
  );
}
