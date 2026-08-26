import { useQuery } from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import {
  fetchPaymentAttempts,
  type PaymentAttempt,
} from "../lib/paymentAttemptsApi";

function friendlyLabel(value: string) {
  return value
    .split("_")
    .join(" ")
    .replace(
      /\b\w/g,
      (letter: string) => letter.toUpperCase(),
    );
}

function formatTimestamp(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function ReconciliationSummary({
  attempt,
}: {
  attempt: PaymentAttempt;
}) {
  const active = ["pending", "retrying"].includes(
    attempt.reconciliation_status,
  );

  return (
    <div className="min-w-[15rem] space-y-2">
      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        {friendlyLabel(
          attempt.reconciliation_status,
        )}
      </span>

      <div className="text-xs leading-5 text-slate-500">
        <div>
          Retries:{" "}
          {attempt.reconciliation_retry_count}
        </div>

        <div>
          Last check:{" "}
          {formatTimestamp(
            attempt.reconciliation_last_attempt_at,
          )}
        </div>

        {active ? (
          <div>
            Next check:{" "}
            {formatTimestamp(
              attempt.reconciliation_next_attempt_at,
            )}
          </div>
        ) : null}

        {attempt.reconciliation_completed_at ? (
          <div>
            Completed:{" "}
            {formatTimestamp(
              attempt.reconciliation_completed_at,
            )}
          </div>
        ) : null}
      </div>

      {attempt.reconciliation_last_error_code ? (
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">
            Reconciliation details
          </summary>

          <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2">
            <div>
              Code:{" "}
              {attempt.reconciliation_last_error_code}
            </div>
            <div>
              {attempt.reconciliation_last_error_message ||
                "No additional detail recorded."}
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}


function AttemptReview({
  attempt,
}: {
  attempt: PaymentAttempt;
}) {
  const cancelledCallback =
    attempt.provider_events.some(
      (event) => event.event_status === "cancelled",
    );

  const needsReview =
    attempt.status === "needs_review";

  const verificationUnavailable = [
    "stk_query_rejected",
    "stk_query_uncertain",
    "stk_query_auth_error",
    "stk_query_configuration_error",
    "stk_verification_deferred",
  ].includes(attempt.error_code || "");

  if (!needsReview) {
    return (
      <div className="space-y-2">
        {attempt.provider_events
          .slice(-3)
          .map((event) => (
            <div
              className="text-slate-600"
              key={event.id}
            >
              <div className="font-medium">
                {friendlyLabel(event.event_type)}
              </div>
              <div className="text-slate-500">
                {friendlyLabel(event.event_status)}
                {" / "}
                {friendlyLabel(
                  event.verification_status,
                )}
              </div>
            </div>
          ))}
      </div>
    );
  }

  return (
    <div className="min-w-[22rem]">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="font-semibold text-amber-950">
          Payment needs review
        </p>

        <p className="mt-2 leading-6 text-amber-900">
          {verificationUnavailable
            ? cancelledCallback
              ? "The customer cancelled the M-Pesa prompt, but M-Pesa could not complete the verification check."
              : "M-Pesa could not complete the verification check, so the final payment status has not been confirmed."
            : cancelledCallback
              ? "The customer cancelled the M-Pesa prompt, but M-Pesa returned conflicting information when the payment was checked."
              : "The payment provider did not return enough consistent information to confirm the final payment status."}
        </p>

        <p className="mt-3 font-medium leading-6 text-amber-950">
          Keep the order unpaid. Check the M-Pesa
          transaction before asking the customer to
          pay again.
        </p>
      </div>

      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer font-semibold text-slate-700">
          Technical details
        </summary>

        <div className="mt-3 space-y-3 text-xs text-slate-600">
          <div>
            <span className="font-semibold">
              Error code:
            </span>{" "}
            {attempt.error_code || "None"}
          </div>

          <div>
            <span className="font-semibold">
              Reason:
            </span>{" "}
            {attempt.error_message ||
              "No technical reason recorded."}
          </div>

          {attempt.provider_events
            .slice(-3)
            .map((event) => (
              <div
                className="border-t border-slate-200 pt-3"
                key={event.id}
              >
                <div className="font-semibold">
                  {event.event_type}
                </div>
                <div>
                  Outcome: {event.event_status}
                </div>
                <div>
                  Verification:{" "}
                  {event.verification_status}
                </div>
                {event.notes ? (
                  <div className="mt-1">
                    {event.notes}
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      </details>
    </div>
  );
}

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
          <table className="min-w-[1320px] w-full text-left text-sm">
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
                  Reconciliation
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
                          ([
                            "created",
                            "submitting",
                            "processing",
                            "needs_review",
                          ].includes(attempt.status)
                            ? "Pending"
                            : "—")}
                      </div>
                    </td>

                    <td className="p-4">
                      {attempt.currency}{" "}
                      {attempt.amount}
                    </td>

                    <td className="p-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {friendlyLabel(attempt.status)}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {friendlyLabel(
                          attempt.verification_status,
                        )}
                      </span>
                    </td>

                    <td className="p-4">
                      <ReconciliationSummary
                        attempt={attempt}
                      />
                    </td>

                    <td className="p-4">
                      <AttemptReview attempt={attempt} />
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
