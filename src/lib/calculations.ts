import type { Settlement, Record as PaymentRecord } from "@/types";

// 精算方法を計算する関数
export const calculateSettlement = (
  records: PaymentRecord[],
  parsedMembers: string[]
): Settlement[] => {
  const balances = new Map(parsedMembers.map((member) => [member, 0]));

  records.forEach((record) => {
    const isValidRecord =
      Number.isSafeInteger(record.amount) &&
      record.amount >= 0 &&
      record.for.length > 0 &&
      balances.has(record.payer) &&
      record.for.every((member) => balances.has(member));

    if (!isValidRecord) {
      return;
    }

    const amountPerPerson = Math.floor(record.amount / record.for.length);
    const remainder = record.amount % record.for.length;

    balances.set(
      record.payer,
      (balances.get(record.payer) ?? 0) + record.amount
    );
    record.for.forEach((member, index) => {
      // 割り切れない1円は対象メンバーの並び順で配分する
      const share = amountPerPerson + (index < remainder ? 1 : 0);
      balances.set(member, (balances.get(member) ?? 0) - share);
    });
  });

  const debtors = Array.from(balances.entries()) // 収支がマイナスの人（借りている人）
    .filter(([, balance]) => balance < 0)
    .map(([person, balance]) => ({ person, amount: -balance }));
  const creditors = Array.from(balances.entries()) // 収支がプラスの人（貸している人）
    .filter(([, balance]) => balance > 0)
    .map(([person, balance]) => ({ person, amount: balance }));

  const newSettlements: Settlement[] = []; // 新しい精算情報の配列

  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0]; // 借りている人の配列の最初の人
    const creditor = creditors[0]; // 貸している人の配列の最初の人
    const amount = Math.min(debtor.amount, creditor.amount); // 借りている人と貸している人のうち、少ない方の金額を取得

    newSettlements.push({
      from: debtor.person,
      to: creditor.person,
      amount,
    }); // 新しい精算情報を追加

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount === 0) {
      debtors.shift();
    } // 借りている人の金額が0以下になったら配列から削除
    if (creditor.amount === 0) {
      creditors.shift();
    } // 貸している人の金額が0以下になったら配列から削除
  }
  return newSettlements;
};
