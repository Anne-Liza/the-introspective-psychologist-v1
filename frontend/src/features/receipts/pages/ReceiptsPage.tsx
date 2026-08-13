import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  createReceiptFromPaymentRequest,
  fetchReceipts,
  updateReceipt,
  type ReceiptRecord,
} from "../lib/receiptsApi";

function ReceiptStatusBadge({
  status,
}: {
  status: ReceiptRecord["status"];
}) {
  const label =
    status === "voided" ? "Voided" : "Issued";

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {label}
    </span>
  );
}

function targetLabel(
  receipt: ReceiptRecord,
): string {
  return receipt.target_type === "commerce_order"
    ? "Store order"
    : "Booking hold";
}

export function ReceiptsPage() {
  const queryClient = useQueryClient();
  const [
    paymentRequestId,
    setPaymentRequestId,
  ] = useState("");
  const [notes, setNotes] = useState("");

  const receiptsQuery = useQuery({
    queryKey: ["receipts"],
    queryFn: fetchReceipts,
  });

  const createMutation = useMutation({
    mutationFn: createReceiptFromPaymentRequest,
    onSuccess: () => {
      setPaymentRequestId("");
      setNotes("");
      queryClient.invalidateQueries({
        queryKey: ["receipts"],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["receipts"],
      });
    },
  });

  const showState =
    receiptsQuery.isLoading ||
    receiptsQuery.isError ||
    !receiptsQuery.data?.length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-slate-500">
          Verified payment records
        </p>
        <h2 className="text-3xl font-bold">
          Receipts
        </h2>
        <p className="mt-2 text-slate-600">
          Successful verified payments issue one
          receipt automatically. Each receipt keeps
          the payment reference, provider transaction
          and purchased target together.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold">
          Manual recovery
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Generate or retrieve the receipt for a paid
          payment request when an automatic workflow
          requires administrative recovery.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={paymentRequestId}
            onChange={(event) =>
              setPaymentRequestId(
                event.target.value,
              )
            }
            placeholder="Payment request ID"
          />
          <Input
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Optional receipt notes"
          />
          <Button
            type="button"
            onClick={() =>
              createMutation.mutate({
                payment_request_id:
                  paymentRequestId,
                notes: notes || null,
              })
            }
            disabled={
              createMutation.isPending ||
              !paymentRequestId.trim()
            }
          >
            Generate
          </Button>
        </div>

        {createMutation.isError ? (
          <p className="mt-3 text-sm font-medium text-red-600">
            Receipt generation failed. Confirm the
            payment request exists and has paid
            status.
          </p>
        ) : null}
      </div>

      {showState ? (
        <DataState
          isLoading={receiptsQuery.isLoading}
          isError={receiptsQuery.isError}
          empty={!receiptsQuery.data?.length}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">Receipt</th>
                <th className="p-4">Target</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Provider</th>
                <th className="p-4">Status</th>
                <th className="p-4">Events</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {receiptsQuery.data?.map(
                (receipt) => (
                  <tr
                    className="border-t align-top"
                    key={receipt.id}
                  >
                    <td className="p-4">
                      <div className="font-medium">
                        {receipt.receipt_number}
                      </div>
                      <div className="font-medium text-slate-700">
                        {receipt.payment_reference}
                      </div>
                      <div className="text-slate-500">
                        Issued: {receipt.issued_at}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-medium">
                        {targetLabel(receipt)}
                      </div>
                      <div className="text-slate-500">
                        {receipt.target_id}
                      </div>
                      {receipt.appointment_id ? (
                        <div className="text-slate-500">
                          Appointment:{" "}
                          {receipt.appointment_id}
                        </div>
                      ) : receipt.target_type ===
                        "booking_hold" ? (
                        <div className="text-amber-700">
                          Awaiting appointment
                          resolution
                        </div>
                      ) : null}
                    </td>

                    <td className="p-4">
                      <div>
                        {receipt.customer_name}
                      </div>
                      <div className="text-slate-500">
                        {receipt.customer_email}
                      </div>
                      {receipt.customer_phone ? (
                        <div className="text-slate-500">
                          {receipt.customer_phone}
                        </div>
                      ) : null}
                    </td>

                    <td className="p-4">
                      {receipt.currency}{" "}
                      {receipt.amount}
                    </td>

                    <td className="p-4">
                      <div className="font-medium">
                        {receipt.provider}
                      </div>
                      <div className="text-slate-500">
                        Checkout:{" "}
                        {receipt.provider_reference ||
                          "Unavailable"}
                      </div>
                      <div className="text-slate-500">
                        Transaction:{" "}
                        {receipt.provider_transaction_reference ||
                          "Unavailable"}
                      </div>
                    </td>

                    <td className="p-4">
                      <ReceiptStatusBadge
                        status={receipt.status}
                      />
                      {receipt.voided_at ? (
                        <div className="mt-2 text-slate-500">
                          Voided:{" "}
                          {receipt.voided_at}
                        </div>
                      ) : null}
                    </td>

                    <td className="p-4">
                      {receipt.events
                        .slice(-3)
                        .map((event) => (
                          <div
                            className="text-slate-600"
                            key={event.id}
                          >
                            {event.event_type}
                          </div>
                        ))}
                    </td>

                    <td className="p-4">
                      <Button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: receipt.id,
                            data: {
                              status: "voided",
                              event_notes:
                                "Voided from admin dashboard.",
                            },
                          })
                        }
                        disabled={
                          updateMutation.isPending ||
                          receipt.status ===
                            "voided"
                        }
                      >
                        Void
                      </Button>
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
