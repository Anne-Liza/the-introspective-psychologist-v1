import { useQuery } from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { fetchPaymentAttempts } from "../lib/paymentAttemptsApi";

export function PaymentAttemptsPage() {
  const attemptsQuery = useQuery({
    queryKey: ["payment-attempts"],
    queryFn: fetchPaymentAttempts,
  });

  const showState =
    attemptsQuery.isLoading ||
    attemptsQuery.isError ||
    !attemptsQuery.data?.length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-slate-500">
          Provider verification layer
        </p>
        <h2 className="text-3xl font-bold">
          Payment Attempts
        </h2>
        <p className="mt-2 text-slate-600">
          Review provider attempts, verified
          transaction references, callbacks,
          duplicates and settlement evidence.
        </p>
      </div>

      {showState ? (
        <DataState
          isLoading={attemptsQuery.isLoading}
          isError={attemptsQuery.isError}
          empty={!attemptsQuery.data?.length}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">Attempt</th>
                <th className="p-4">
                  Payment request
                </th>
                <th className="p-4">Provider</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">
                  Verification
                </th>
                <th className="p-4">
                  Recent events
                </th>
              </tr>
            </thead>
            <tbody>
              {attemptsQuery.data?.map(
                (attempt) => (
                  <tr
                    className="border-t align-top"
                    key={attempt.id}
                  >
                    <td className="p-4">
                      <div className="font-medium">
                        {attempt.attempt_number}
                      </div>
                      <div className="text-slate-500">
                        {attempt.id}
                      </div>
                      {attempt.idempotency_key ? (
                        <div className="text-slate-500">
                          Idempotency:{" "}
                          {attempt.idempotency_key}
                        </div>
                      ) : null}
                    </td>

                    <td className="p-4">
                      {attempt.payment_request_id}
                    </td>

                    <td className="p-4">
                      <div className="font-medium">
                        {attempt.provider}
                      </div>
                      <div className="text-slate-500">
                        Checkout:{" "}
                        {attempt.provider_reference ||
                          "Pending"}
                      </div>
                      <div className="text-slate-500">
                        Transaction:{" "}
                        {attempt.provider_transaction_reference ||
                          "Pending"}
                      </div>
                    </td>

                    <td className="p-4">
                      {attempt.currency}{" "}
                      {attempt.amount}
                    </td>

                    <td className="p-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {attempt.status}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {
                          attempt.verification_status
                        }
                      </span>
                    </td>

                    <td className="p-4">
                      {attempt.provider_events
                        .slice(-3)
                        .map((event) => (
                          <div
                            className="mb-2 text-slate-600"
                            key={event.id}
                          >
                            <div>
                              {event.event_type}
                            </div>
                            <div className="text-slate-500">
                              {event.event_status} /{" "}
                              {
                                event.verification_status
                              }
                              {event.is_duplicate
                                ? " / duplicate"
                                : ""}
                            </div>
                            {event.provider_transaction_reference ? (
                              <div className="text-slate-500">
                                Transaction:{" "}
                                {
                                  event.provider_transaction_reference
                                }
                              </div>
                            ) : null}
                          </div>
                        ))}
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
