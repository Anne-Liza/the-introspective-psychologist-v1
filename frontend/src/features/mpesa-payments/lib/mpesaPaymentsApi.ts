import { apiClient } from "../../../lib/api-client";

export type PublicMpesaStkPushResponse = {
  payment_attempt_id: string;
  attempt_number: string;
  payment_request_id: string;
  provider: string;
  provider_reference: string | null;
  provider_transaction_reference: string | null;
  provider_session_id: string | null;
  amount: string | number;
  currency: string;
  status: string;
  verification_status: string;
  phone_number: string;
  adapter_mode: string;
  message: string;
};

export async function initiatePublicMpesaStkPush(
  payload: {
    paymentRequestId: string;
    phone_number: string;
  },
): Promise<PublicMpesaStkPushResponse> {
  return (
    await apiClient.post(
      `/mpesa-payments/public/payment-requests/${payload.paymentRequestId}/stk-push/initiate`,
      {
        phone_number: payload.phone_number,
      },
    )
  ).data;
}
