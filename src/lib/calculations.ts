import { Settlement, Record } from "@/types";

// 精算方法を計算する関数
export const calculateSettlement = (
  records: Record[],
  parsedMembers: string[]
): Settlement[] => {
  const balances: { [key: string]: number } = {};
  parsedMembers.forEach((member) => (balances[member] = 0)); //各メンバーの収支を0に初期化

  records.forEach((record) => {
    const amountPerPerson = record.amount / record.for.length;
    balances[record.payer] += record.amount; // 立て替えた人の収支を増やす
    record.for.forEach((member: string | number) => {
      balances[member] -= amountPerPerson; // 立て替えられた人の収支を減らす
    });
  });

  const debtors = Object.entries(balances) // 収支がマイナスの人（借りている人）
    .filter(([, balance]) => balance < 0)
    .map(([person, balance]) => ({ person, amount: -balance }));
  const creditors = Object.entries(balances) // 収支がプラスの人（貸している人）
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
      amount: Math.round(amount),
    }); // 新しい精算情報を追加

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) {
      debtors.shift();
    } // 借りている人の金額が0以下になったら配列から削除
    if (creditor.amount < 0.01) {
      creditors.shift();
    } // 貸している人の金額が0以下になったら配列から削除
  }
  return newSettlements;
};
