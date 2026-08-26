import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { DataState } from "../../../components/data/DataState";
import {
  type PaymentAttempt,
  type PaymentProviderEvent,
} from "../../payment-attempts/lib/paymentAttemptsApi";
import {
  fetchMpesaAttempts,
} from "../lib/mpesaPaymentsApi";

function friendlyLabel(value: string) {
  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function latestEvents(attempts: PaymentAttempt[]) {
  return attempts
    .flatMap((attempt) =>
      attempt.provider_events.map((event) => ({
        event,
        attempt,
      })),
    )
    .sort(
      (a, b) =>
        new Date(b.event.created_at).getTime() -
        new Date(a.event.created_at).getTime(),
    )
    .slice(0, 8);
}

function StatusCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function EventRow({
  event,
  attempt,
}: {
  event: PaymentProviderEvent;
  attempt: PaymentAttempt;
}) {
  return (
    <div className="flex flex-col gap-3 border-t py-4 first:border-t-0 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-semibold text-slate-800">
          {friendlyLabel(event.event_type)}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {attempt.attempt_number}
          {" · "}
          {event.provider_reference ||
            attempt.provider_reference ||
            "No checkout reference"}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {formatDate(event.created_at)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {friendlyLabel(event.event_status)}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {friendlyLabel(event.verification_status)}
        </span>
      </div>
    </div>
  );
}

export function MpesaPaymentsPage() {
  const attemptsQuery = useQuery({
    queryKey: ["payment-attempts", "mpesa-operations"],
    queryFn: fetchMpesaAttempts,
    refetchInterval: 5000,
  });

  const mpesaAttempts =
    attemptsQuery.data?.filter(
      (attempt) => attempt.provider === "mpesa",
    ) ?? [];

  const reconciling = mpesaAttempts.filter((attempt) =>
    ["pending", "retrying"].includes(
      attempt.reconciliation_status,
    ),
  );

  const needsReview = mpesaAttempts.filter(
    (attempt) =>
      attempt.status === "needs_review" ||
      attempt.reconciliation_status === "exhausted",
  );

  const verifiedComplete = mpesaAttempts.filter(
    (attempt) =>
      attempt.verification_status === "verified" &&
      attempt.reconciliation_status === "completed",
  );

  const attentionAttempts = mpesaAttempts
    .filter(
      (attempt) =>
        attempt.status === "needs_review" ||
        ["pending", "retrying", "exhausted"].includes(
          attempt.reconciliation_status,
        ),
    )
    .slice(0, 6);

  const events = latestEvents(mpesaAttempts);

  const showState =
    attemptsQuery.isLoading ||
    attemptsQuery.isError ||
    !mpesaAttempts.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Provider operations
          </p>
          <h2 className="text-3xl font-bold">
            M-Pesa Operations
          </h2>
          <p className="mt-2 max-w-3xl text-slate-600">
            Monitor M-Pesa attempts, callback verification and
            background reconciliation without changing payment
            state manually.
          </p>
        </div>

        <Link
          to="/dashboard/payment-attempts"
          className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          View all payment attempts
        </Link>
      </div>

      {showState ? (
        <DataState
          isLoading={attemptsQuery.isLoading}
          isError={attemptsQuery.isError}
          empty={!mpesaAttempts.length}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatusCard
              label="M-Pesa attempts"
              value={mpesaAttempts.length}
              detail="All recorded STK Push attempts"
            />
            <StatusCard
              label="Reconciling"
              value={reconciling.length}
              detail="Pending or retrying provider checks"
            />
            <StatusCard
              label="Needs review"
              value={needsReview.length}
              detail="Attempts requiring administrator attention"
            />
            <StatusCard
              label="Verified & complete"
              value={verifiedComplete.length}
              detail="Provider-verified completed reconciliations"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    Needs attention
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Reconciliation activity that is still running
                    or requires review.
                  </p>
                </div>
              </div>

              {attentionAttempts.length ? (
                <div className="mt-4 divide-y">
                  {attentionAttempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">
                          {attempt.attempt_number}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {attempt.provider_reference ||
                            "Checkout reference pending"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Last check:{" "}
                          {formatDate(
                            attempt.reconciliation_last_attempt_at,
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {friendlyLabel(attempt.status)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {friendlyLabel(
                            attempt.reconciliation_status,
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-xl bg-slate-50 p-5">
                  <p className="font-semibold text-slate-700">
                    Nothing needs attention
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    No M-Pesa attempts are currently reconciling or
                    waiting for manual review.
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">
                Payment workflow
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Follow each payment through its business and
                provider records.
              </p>

              <div className="mt-5 space-y-3">
                <Link
                  to="/dashboard/payment-requests"
                  className="block rounded-xl border p-4 transition hover:bg-slate-50"
                >
                  <p className="font-semibold">
                    Payment Requests
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Customer payment state and order linkage
                  </p>
                </Link>

                <Link
                  to="/dashboard/payment-attempts"
                  className="block rounded-xl border p-4 transition hover:bg-slate-50"
                >
                  <p className="font-semibold">
                    Payment Attempts
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Provider verification and reconciliation
                  </p>
                </Link>

                <Link
                  to="/dashboard/receipts"
                  className="block rounded-xl border p-4 transition hover:bg-slate-50"
                >
                  <p className="font-semibold">
                    Receipts
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Issued evidence for verified payments
                  </p>
                </Link>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold">
                Recent provider events
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Latest M-Pesa callbacks and reconciliation events.
              </p>
            </div>

            <div className="mt-4">
              {events.length ? (
                events.map(({ event, attempt }) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    attempt={attempt}
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No provider events recorded yet.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
