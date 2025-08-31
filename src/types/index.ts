//features/home
export interface MemberListProps {
  members: string[];
  onDeleteMember: (member: string) => void;
}
export interface AddMemberFormProps {
  onAddMember: (memberName: string) => void;
}

//features/group
export type GroupHeaderProps = {
  groupName: string;
  members: string[];
};

//features/add_payment
export interface AddPaymentFormProps {
  members: string[];
  addRecord: (record: Omit<Record, "id">) => void;
  onSuccess: () => void;
}
export interface GroupContextType {
  groupName: string;
  setGroupName: (name: string) => void;
  members: string[];
  setMembers: (members: string[]) => void;
  records: Record[];
  addRecord: (record: Omit<Record, "id">) => void;
  deleteRecord: (id: string) => void;
  resetGroup: () => void;
}
export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface Record {
  id: string;
  title: string;
  payer: string;
  amount: number;
  for: string[];
}
