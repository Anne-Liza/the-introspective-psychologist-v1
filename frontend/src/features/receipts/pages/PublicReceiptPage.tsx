import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CircleAlert,
  LoaderCircle,
  Printer,
  ReceiptText,
} from "lucide-react";
import { Link, useParams } from "react-router";

import { fetchPublicReceipt } from "../lib/receiptsApi";

function formatMoney(amount: string, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PublicReceiptPage() {
  const { paymentRequestId } = useParams();

  const receiptQuery = useQuery({
    queryKey: ["public-receipt", paymentRequestId],
    queryFn: () => fetchPublicReceipt(paymentRequestId!),
    enabled: Boolean(paymentRequestId),
    retry: false,
  });

  if (receiptQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf5] px-5">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-[#556b2f]" />
          <p className="mt-4 text-[#5f6d54]">Loading your receipt…</p>
        </div>
      </main>
    );
  }

  if (receiptQuery.isError || !receiptQuery.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf5] px-5">
        <div className="max-w-xl text-center">
          <CircleAlert className="mx-auto h-12 w-12 text-[#a45c4b]" />
          <h1 className="mt-5 font-serif text-4xl text-[#26311f]">
            Receipt unavailable
          </h1>
          <p className="mt-4 leading-7 text-[#5f6d54]">
            We could not find a receipt for this payment.
          </p>
          <Link
            to="/store"
            className="mt-7 inline-flex rounded-full bg-[#556b2f] px-6 py-3 font-semibold text-white"
          >
            Return to store
          </Link>
        </div>
      </main>
    );
  }

  const receipt = receiptQuery.data;
  const isVoided = receipt.status === "voided";

  return (
    <main className="min-h-screen bg-[#f3efe6] px-4 py-10 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-4 print:hidden">
          <Link
            to="/store"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#4e642c]"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to store
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-[#556b2f] px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>

        <article className="overflow-hidden rounded-[2rem] bg-white shadow-sm print:rounded-none print:shadow-none">
          <header className="border-b border-[#e2e4da] bg-[#f7f5ee] px-7 py-9 sm:px-10">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6a7a4e]">
                  The Introspective Psychologist
                </p>
                <h1 className="mt-3 font-serif text-4xl text-[#26311f]">
                  Payment receipt
                </h1>
              </div>

              <ReceiptText className="h-10 w-10 text-[#7a8c5d]" />
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <span
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                  isVoided
                    ? "bg-[#f8e9e5] text-[#8a4436]"
                    : "bg-[#e9f0df] text-[#4e642c]"
                }`}
              >
                {isVoided ? "Voided" : "Paid"}
              </span>
            </div>
          </header>

          <div className="px-7 py-8 sm:px-10">
            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[#7a876c]">
                  Receipt number
                </dt>
                <dd className="mt-1 font-semibold text-[#26311f]">
                  {receipt.receipt_number}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-[#7a876c]">
                  Issued
                </dt>
                <dd className="mt-1 font-semibold text-[#26311f]">
                  {formatDate(receipt.issued_at)}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-[#7a876c]">
                  Customer
                </dt>
                <dd className="mt-1 font-semibold text-[#26311f]">
                  {receipt.customer_name}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-[#7a876c]">
                  Order
                </dt>
                <dd className="mt-1 font-semibold text-[#26311f]">
                  {receipt.order_number}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-[#7a876c]">
                  Payment method
                </dt>
                <dd className="mt-1 font-semibold capitalize text-[#26311f]">
                  {receipt.provider}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-wide text-[#7a876c]">
                  M-Pesa reference
                </dt>
                <dd className="mt-1 font-semibold text-[#26311f]">
                  {receipt.provider_transaction_reference || "Confirmed"}
                </dd>
              </div>
            </dl>

            <div className="mt-9 overflow-hidden rounded-2xl border border-[#e2e4da]">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 bg-[#f7f5ee] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#6a7a4e]">
                <span>Item</span>
                <span>Qty</span>
                <span>Total</span>
              </div>

              {receipt.items.map((item, index) => (
                <div
                  key={`${item.item_name}-${index}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 border-t border-[#e8e9e2] px-5 py-4 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[#26311f]">
                      {item.item_name}
                    </p>
                    <p className="mt-1 text-xs text-[#7a876c]">
                      {formatMoney(item.unit_amount, item.currency)} each
                    </p>
                  </div>

                  <span className="text-[#5f6d54]">
                    {item.quantity}
                  </span>

                  <span className="font-semibold text-[#26311f]">
                    {formatMoney(
                      item.line_total_amount,
                      item.currency,
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-center justify-between border-t border-[#dfe3d7] pt-6">
              <span className="font-semibold uppercase tracking-wide text-[#5f6d54]">
                Total paid
              </span>
              <span className="font-serif text-3xl text-[#26311f]">
                {formatMoney(receipt.amount, receipt.currency)}
              </span>
            </div>

            {isVoided ? (
              <div className="mt-7 rounded-2xl bg-[#fff2ee] p-4 text-sm leading-6 text-[#824838]">
                This receipt has been voided. Contact the practice if you
                need clarification.
              </div>
            ) : null}

            <p className="mt-10 text-center text-xs leading-5 text-[#89917f]">
              Thank you for your payment. Keep this receipt for your
              records.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
