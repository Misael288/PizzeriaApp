export type TransferAccountDetails = {
  bank: string;
  beneficiary: string;
  clabe: string;
  accountNumber: string;
  instructions: string;
};

export type PublicPaymentOptions = {
  methods: { id: number; name: string; enabled: boolean }[];
};
