export type ReceiptFormData = {
  merchantName: string;
  date: string;
  totalAmount: string;
  currency: string;
};

export const emptyReceiptForm = (): ReceiptFormData => ({
  merchantName: "",
  date: "",
  totalAmount: "",
  currency: "",
});
