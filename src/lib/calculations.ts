import type {
  Member,
  PaymentRecord,
  Settlement,
  SettlementTransfer,
} from "@/types";

export const calculateSettlement = (
  payments: PaymentRecord[],
  members: Member[],
  transfers: SettlementTransfer[] = []
): Settlement[] => {
  const balances = new Map(members.map((member) => [member.id, 0]));

  payments.forEach((payment) => {
    const beneficiaries = payment.beneficiaryMemberIds;
    const isValidPayment =
      Number.isSafeInteger(payment.amount) &&
      payment.amount >= 0 &&
      beneficiaries.length > 0 &&
      new Set(beneficiaries).size === beneficiaries.length &&
      balances.has(payment.payerMemberId) &&
      beneficiaries.every((memberId) => balances.has(memberId));

    if (!isValidPayment) {
      return;
    }

    const amountPerPerson = Math.floor(payment.amount / beneficiaries.length);
    const remainder = payment.amount % beneficiaries.length;
    balances.set(
      payment.payerMemberId,
      (balances.get(payment.payerMemberId) ?? 0) + payment.amount
    );
    beneficiaries.forEach((memberId, index) => {
      const share = amountPerPerson + (index < remainder ? 1 : 0);
      balances.set(memberId, (balances.get(memberId) ?? 0) - share);
    });
  });

  transfers.forEach((transfer) => {
    const isValidTransfer =
      Number.isSafeInteger(transfer.amount) &&
      transfer.amount > 0 &&
      transfer.fromMemberId !== transfer.toMemberId &&
      balances.has(transfer.fromMemberId) &&
      balances.has(transfer.toMemberId);
    if (!isValidTransfer) {
      return;
    }

    balances.set(
      transfer.fromMemberId,
      (balances.get(transfer.fromMemberId) ?? 0) + transfer.amount
    );
    balances.set(
      transfer.toMemberId,
      (balances.get(transfer.toMemberId) ?? 0) - transfer.amount
    );
  });

  const debtors = Array.from(balances.entries())
    .filter(([, balance]) => balance < 0)
    .map(([memberId, balance]) => ({ memberId, amount: -balance }));
  const creditors = Array.from(balances.entries())
    .filter(([, balance]) => balance > 0)
    .map(([memberId, balance]) => ({ memberId, amount: balance }));
  const settlements: Settlement[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0];
    const creditor = creditors[0];
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) {
      settlements.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) debtors.shift();
    if (creditor.amount === 0) creditors.shift();
  }

  return settlements;
};
