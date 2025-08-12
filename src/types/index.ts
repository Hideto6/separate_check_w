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
