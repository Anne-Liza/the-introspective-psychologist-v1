import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  createFulfillmentFromReceipt,
  fetchFulfillmentRecords,
  updateFulfillment,
  type FulfillmentRecord,
} from "../lib/fulfillmentApi";

const STATUS_ACTIONS: Array<{ label: string; status: FulfillmentRecord["status"] }> = [
  { label: "Start", status: "in_progress" },
  { label: "Fulfilled", status: "fulfilled" },
  { label: "Cancel", status: "cancelled" },
];

function StatusBadge({ status }: { status: FulfillmentRecord["status"] }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function FulfillmentPage() {
  const queryClient = useQueryClient();
  const [receiptId, setReceiptId] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentRecord["fulfillment_type"]>("manual");
  const [notes, setNotes] = useState("");

  const fulfillmentQuery = useQuery({
    queryKey: ["fulfillment"],
    queryFn: fetchFulfillmentRecords,
  });

  const createMutation = useMutation({
    mutationFn: createFulfillmentFromReceipt,
    onSuccess: () => {
      setReceiptId("");
      setNotes("");
      setFulfillmentType("manual");
      queryClient.invalidateQueries({ queryKey: ["fulfillment"] });
      queryClient.invalidateQueries({ queryKey: ["commerce-orders"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateFulfillment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fulfillment"] });
      queryClient.invalidateQueries({ queryKey: ["commerce-orders"] });
    },
  });

  const showState =
    fulfillmentQuery.isLoading || fulfillmentQuery.isError || !fulfillmentQuery.data?.length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-slate-500">Post-receipt operations</p>
        <h2 className="text-3xl font-bold">Fulfillment</h2>
        <p className="mt-2 text-slate-600">
          Track service delivery, digital delivery, physical handover, or manual completion after receipts are issued.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold">Create fulfillment record</h3>
        <p className="mt-1 text-sm text-slate-600">
          Use this after a receipt has been issued for a paid order.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_12rem_1fr_auto]">
          <Input
            value={receiptId}
            onChange={(event) => setReceiptId(event.target.value)}
            placeholder="Receipt ID"
          />

          <select
            value={fulfillmentType}
            onChange={(event) =>
              setFulfillmentType(event.target.value as FulfillmentRecord["fulfillment_type"])
            }
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm"
          >
            <option value="manual">Manual</option>
            <option value="digital">Digital</option>
            <option value="physical">Physical</option>
            <option value="service">Service</option>
            <option value="session_package">Session package</option>
            <option value="mixed">Mixed</option>
          </select>

          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional fulfillment notes"
          />

          <Button
            type="button"
            onClick={() =>
              createMutation.mutate({
                receipt_id: receiptId,
                fulfillment_type: fulfillmentType,
                notes: notes || null,
              })
            }
            disabled={createMutation.isPending || !receiptId.trim()}
          >
            Create
          </Button>
        </div>

        {createMutation.isError ? (
          <p className="mt-3 text-sm font-medium text-red-600">
            Fulfillment could not be created. Confirm the receipt exists and is issued.
          </p>
        ) : null}
      </div>

      {showState ? (
        <DataState
          isLoading={fulfillmentQuery.isLoading}
          isError={fulfillmentQuery.isError}
          empty={!fulfillmentQuery.data?.length}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">Fulfillment</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Type</th>
                <th className="p-4">Status</th>
                <th className="p-4">Timeline</th>
                <th className="p-4">Events</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fulfillmentQuery.data?.map((record) => (
                <tr className="border-t align-top" key={record.id}>
                  <td className="p-4">
                    <div className="font-medium">{record.fulfillment_number}</div>
                    <div className="text-slate-500">Receipt: {record.receipt_id}</div>
                    <div className="text-slate-500">Order: {record.order_number}</div>
                  </td>
                  <td className="p-4">
                    <div>{record.customer_name}</div>
                    <div className="text-slate-500">{record.customer_email}</div>
                    {record.customer_phone ? (
                      <div className="text-slate-500">{record.customer_phone}</div>
                    ) : null}
                  </td>
                  <td className="p-4">{record.fulfillment_type.replace(/_/g, " ")}</td>
                  <td className="p-4">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="p-4 text-slate-600">
                    {record.started_at ? <div>Started: {record.started_at}</div> : null}
                    {record.fulfilled_at ? <div>Fulfilled: {record.fulfilled_at}</div> : null}
                    {record.cancelled_at ? <div>Cancelled: {record.cancelled_at}</div> : null}
                    {!record.started_at && !record.fulfilled_at && !record.cancelled_at ? (
                      <div>Not started</div>
                    ) : null}
                  </td>
                  <td className="p-4">
                    {record.events.slice(-3).map((event) => (
                      <div className="text-slate-600" key={event.id}>
                        {event.event_type}
                      </div>
                    ))}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {STATUS_ACTIONS.map((action) => (
                        <Button
                          type="button"
                          key={action.status}
                          onClick={() =>
                            updateMutation.mutate({
                              id: record.id,
                              data: {
                                status: action.status,
                                event_notes: `Marked ${action.status} from admin dashboard.`,
                              },
                            })
                          }
                          disabled={updateMutation.isPending || record.status === action.status}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
