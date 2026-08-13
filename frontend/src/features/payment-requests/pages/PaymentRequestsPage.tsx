import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { Button } from "../../../components/ui/Button";
import {
  fetchPaymentRequests,
  updatePaymentRequest,
  type PaymentRequest,
} from "../lib/paymentRequestsApi";

const NEXT_ACTIONS: Array<{
  label: string;
  status: PaymentRequest["status"];
}> = [
  {
    label: "Processing",
    status: "processing",
  },
  { label: "Paid", status: "paid" },
  { label: "Failed", status: "failed" },
  {
    label: "Needs review",
    status: "needs_review",
  },
  {
    label: "Cancelled",
    status: "cancelled",
  },
];

export function PaymentRequestsPage() {
  const queryClient = useQueryClient();

  const paymentRequestsQuery = useQuery({
    queryKey: ["payment-requests"],
    queryFn: fetchPaymentRequests,
  });

  const updateMutation = useMutation({
    mutationFn: updatePaymentRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["payment-requests"],
      });
    },
  });

  const showState =
    paymentRequestsQuery.isLoading ||
    paymentRequestsQuery.isError ||
    !paymentRequestsQuery.data?.length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-slate-500">
          Money instruction layer
        </p>
        <h2 className="text-3xl font-bold">
          Payment Requests
        </h2>
        <p className="mt-2 text-slate-600">
          Review canonical payment references,
          provider checkout identifiers, verified
          transaction numbers and purchased targets.
        </p>
      </div>

      {showState ? (
        <DataState
          isLoading={
            paymentRequestsQuery.isLoading
          }
          isError={paymentRequestsQuery.isError}
          empty={
            !paymentRequestsQuery.data?.length
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">Request</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Provider</th>
                <th className="p-4">Status</th>
                <th className="p-4">Events</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paymentRequestsQuery.data?.map(
                (request) => (
                  <tr
                    className="border-t align-top"
                    key={request.id}
                  >
                    <td className="p-4">
                      <div className="font-medium">
                        {request.request_number}
                      </div>
                      <div className="text-slate-500">
                        {request.target_type ===
                        "commerce_order"
                          ? "Store order"
                          : "Booking hold"}
                        : {request.target_id}
                      </div>
                      {request.expires_at ? (
                        <div className="text-slate-500">
                          Expires:{" "}
                          {request.expires_at}
                        </div>
                      ) : null}
                    </td>

                    <td className="p-4">
                      <div>
                        {request.customer_name}
                      </div>
                      <div className="text-slate-500">
                        {request.customer_email}
                      </div>
                      {request.customer_phone ? (
                        <div className="text-slate-500">
                          {request.customer_phone}
                        </div>
                      ) : null}
                    </td>

                    <td className="p-4">
                      {request.currency}{" "}
                      {request.amount}
                    </td>

                    <td className="p-4">
                      <div className="font-medium">
                        {request.provider}
                      </div>
                      <div className="text-slate-500">
                        Checkout:{" "}
                        {request.provider_reference ||
                          "Pending"}
                      </div>
                      <div className="text-slate-500">
                        Transaction:{" "}
                        {request.provider_transaction_reference ||
                          "Pending"}
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {request.status}
                      </span>
                    </td>

                    <td className="p-4">
                      {request.events
                        .slice(-3)
                        .map((event) => (
                          <div
                            className="text-slate-600"
                            key={event.id}
                          >
                            {event.event_type}
                            {event.provider_transaction_reference ? (
                              <div className="text-slate-500">
                                {
                                  event.provider_transaction_reference
                                }
                              </div>
                            ) : null}
                          </div>
                        ))}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {NEXT_ACTIONS.map(
                          (action) => (
                            <Button
                              type="button"
                              key={action.status}
                              onClick={() =>
                                updateMutation.mutate(
                                  {
                                    id: request.id,
                                    data: {
                                      status:
                                        action.status,
                                      event_notes:
                                        `Marked ${action.status} from admin dashboard.`,
                                    },
                                  },
                                )
                              }
                              disabled={
                                updateMutation.isPending ||
                                request.status ===
                                  action.status
                              }
                            >
                              {action.label}
                            </Button>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
