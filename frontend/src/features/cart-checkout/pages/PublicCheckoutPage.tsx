import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CircleAlert, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router";

import {
  createPublicCommerceOrder,
  fetchPublicCommerceItems,
  type CommerceOrder,
} from "../../commerce-core/lib/commerceCoreApi";
import {
  createPublicPaymentRequest,
  fetchPublicPaymentStatus,
  type PaymentRequest,
} from "../../payment-requests/lib/paymentRequestsApi";
import {
  initiatePublicMpesaStkPush,
  type PublicMpesaStkPushResponse,
} from "../../mpesa-payments/lib/mpesaPaymentsApi";
import { formatMoney } from "../lib/cart";
import { useCart } from "../lib/cartStore";

type CheckoutResult = {
  order: CommerceOrder;
  paymentRequest: PaymentRequest;
  mpesaAttempt: PublicMpesaStkPushResponse;
};

export function PublicCheckoutPage() {
  const { lines, clear } = useCart();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [createdOrder, setCreatedOrder] = useState<CommerceOrder | null>(null);
  const [createdPaymentRequest, setCreatedPaymentRequest] = useState<PaymentRequest | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-commerce-items"],
    queryFn: fetchPublicCommerceItems,
  });

  const itemsById = new Map((data || []).map((item) => [item.id, item]));
  const resolvedLines = lines.map((line) => ({ ...line, item: itemsById.get(line.commerce_item_id) }));
  const hasUnavailableItems = resolvedLines.some((line) => !line.item);
  const hasStockIssue = resolvedLines.some(
    (line) =>
      line.item?.stock_quantity !== null &&
      line.item?.stock_quantity !== undefined &&
      line.quantity > line.item.stock_quantity,
  );
  const currencies = new Set(resolvedLines.map((line) => line.item?.currency).filter(Boolean));
  const currency = resolvedLines[0]?.item?.currency || "KES";
  const total = resolvedLines.reduce(
    (sum, line) => sum + Number(line.item?.price_amount || 0) * line.quantity,
    0,
  );

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const order = createdOrder || await createPublicCommerceOrder({
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || undefined,
        items: lines,
      });
      if (!createdOrder) {
        setCreatedOrder(order);
      }

      const paymentRequest =
        createdPaymentRequest ||
        await createPublicPaymentRequest({
          commerce_order_id: order.id,
          customer_email: order.customer_email,
          provider: "mpesa",
          description: `Payment for order ${order.order_number}`,
        });

      if (!createdPaymentRequest) {
        setCreatedPaymentRequest(paymentRequest);
      }

      const mpesaAttempt = await initiatePublicMpesaStkPush({
        paymentRequestId: paymentRequest.id,
        phone_number: customerPhone,
      });

      return { order, paymentRequest, mpesaAttempt };
    },
    onSuccess: (checkoutResult) => {
      setResult(checkoutResult);
      clear();
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    checkoutMutation.mutate();
  }

  const paymentStatusQuery = useQuery({
    queryKey: [
      "public-payment-status",
      result?.paymentRequest.id,
    ],
    queryFn: () =>
      fetchPublicPaymentStatus(
        result!.paymentRequest.id,
      ),
    enabled: Boolean(result?.paymentRequest.id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;

      if (
        status === "paid" &&
        query.state.data?.receipt_number
      ) {
        return false;
      }

      if (
        status &&
        [
          "failed",
          "cancelled",
          "expired",
          "needs_review",
        ].includes(status)
      ) {
        return false;
      }

      return 5000;
    },
  });

  const paymentStatus = paymentStatusQuery.data;
  const paymentIsPaid = paymentStatus?.status === "paid";
  const paymentNeedsReview =
    paymentStatus?.status === "needs_review";
  const paymentIsFailed =
    paymentStatus?.status === "failed" ||
    paymentStatus?.status === "cancelled" ||
    paymentStatus?.status === "expired";

  if (result) {
    return (
      <main className="bg-[#fbfaf5]">
        <section className="mx-auto flex min-h-[38rem] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center">
          {paymentIsFailed || paymentNeedsReview ? (
            <CircleAlert
              aria-hidden="true"
              className="h-16 w-16 text-[#a45c4b]"
            />
          ) : (
            <CheckCircle2
              aria-hidden="true"
              className="h-16 w-16 text-[#556b2f]"
            />
          )}

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-[#6a7a4e]">
            {paymentIsPaid
              ? "Payment confirmed"
              : paymentNeedsReview
                ? "Payment not confirmed"
                : paymentIsFailed
                  ? "Payment incomplete"
                  : "Waiting for M-Pesa"}
          </p>

          <h1 className="mt-3 font-serif text-5xl text-[#26311f]">
            {paymentIsPaid
              ? "Payment successful."
              : paymentNeedsReview
                ? "Your payment has not been confirmed."
                : paymentIsFailed
                  ? "Your payment was not completed."
                  : "Confirm the payment on your phone."}
          </h1>

          <p className="mt-5 max-w-2xl leading-8 text-[#5f6d54]">
            {paymentIsPaid
              ? "M-Pesa has confirmed your payment and your order is now paid."
              : paymentNeedsReview
                ? "We have not received a verified payment confirmation from M-Pesa. Your order remains unpaid."
                : paymentIsFailed
                  ? "The M-Pesa transaction was cancelled, failed, or expired. Your order has not been marked as paid."
                  : "Your M-Pesa prompt was sent successfully. We are waiting for confirmation from M-Pesa and this page will update automatically."}
          </p>
          <dl className="mt-8 grid w-full gap-3 rounded-[2rem] border border-[#dfe5d6] bg-white p-7 text-left sm:grid-cols-3">
            <div><dt className="text-xs uppercase tracking-wide text-[#6a7a4e]">Order</dt><dd className="mt-1 font-semibold text-[#26311f]">{result.order.order_number}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-[#6a7a4e]">Payment request</dt><dd className="mt-1 font-semibold text-[#26311f]">{result.paymentRequest.request_number}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-[#6a7a4e]">Total</dt><dd className="mt-1 font-semibold text-[#26311f]">{formatMoney(result.order.total_amount, result.order.currency)}</dd></div>
          </dl>

          {paymentIsPaid ? (
            <div className="mt-5 w-full rounded-[2rem] border border-[#dfe5d6] bg-[#f4f7ef] p-6 text-left">
              <p className="text-sm font-semibold text-[#26311f]">
                Payment details
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#6a7a4e]">
                    M-Pesa reference
                  </p>
                  <p className="mt-1 font-semibold text-[#26311f]">
                    {paymentStatus?.provider_transaction_reference || "Confirmed"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-[#6a7a4e]">
                    Receipt
                  </p>
                  <p className="mt-1 font-semibold text-[#26311f]">
                    {paymentStatus?.receipt_number
                      ? paymentStatus.receipt_number
                      : "Preparing receipt…"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {paymentNeedsReview ? (
            <p className="mt-5 max-w-2xl font-medium leading-7 text-[#7a4d3a]">
              If your account was charged, contact the practice before making another payment.
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {paymentNeedsReview ? (
              <>
                <Link
                  to="/contact"
                  className="rounded-full bg-[#556b2f] px-6 py-3 font-semibold text-white"
                >
                  Contact the practice
                </Link>
                <Link
                  to="/store"
                  className="rounded-full border border-[#cbd5ba] px-6 py-3 font-semibold text-[#26311f]"
                >
                  Return to store
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/store"
                  className="rounded-full bg-[#556b2f] px-6 py-3 font-semibold text-white"
                >
                  Return to store
                </Link>
                <Link
                  to="/contact"
                  className="rounded-full border border-[#cbd5ba] px-6 py-3 font-semibold text-[#26311f]"
                >
                  Contact the practice
                </Link>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  if (!lines.length) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="font-serif text-5xl text-[#26311f]">There is nothing to check out.</h1>
        <Link to="/store" className="mt-7 inline-flex rounded-full bg-[#556b2f] px-6 py-3 font-semibold text-white">Browse the store</Link>
      </main>
    );
  }

  const cannotCheckout =
    isLoading ||
    isError ||
    hasUnavailableItems ||
    hasStockIssue ||
    currencies.size !== 1;

  return (
    <main className="bg-[#fbfaf5]">
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
        <Link to="/cart" className="inline-flex items-center gap-2 text-sm font-semibold text-[#4e642c]">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to cart
        </Link>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6a7a4e]">Checkout</p>
            <h1 className="mt-3 font-serif text-5xl tracking-[-0.04em] text-[#26311f]">Where should we send your order details?</h1>
            <p className="mt-5 max-w-3xl leading-8 text-[#5f6d54]">
              Your order will remain pending until M-Pesa confirms the payment.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 rounded-[2rem] border border-[#dfe5d6] bg-white p-6 shadow-sm md:p-9">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#26311f] sm:col-span-2">
                  Full name
                  <input required autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} disabled={Boolean(createdOrder)} className="mt-2 w-full rounded-2xl border border-[#d7decb] px-4 py-3 font-normal outline-none focus:border-[#7a8c5d] focus:ring-4 focus:ring-[#e3ead8] disabled:bg-[#f4f5f1]" />
                </label>
                <label className="text-sm font-semibold text-[#26311f]">
                  Email
                  <input required type="email" autoComplete="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} disabled={Boolean(createdOrder)} className="mt-2 w-full rounded-2xl border border-[#d7decb] px-4 py-3 font-normal outline-none focus:border-[#7a8c5d] focus:ring-4 focus:ring-[#e3ead8] disabled:bg-[#f4f5f1]" />
                </label>
                <label className="text-sm font-semibold text-[#26311f]">
                  M-Pesa phone
                  <input required type="tel" autoComplete="tel" placeholder="07XXXXXXXX" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} disabled={checkoutMutation.isPending} className="mt-2 w-full rounded-2xl border border-[#d7decb] px-4 py-3 font-normal outline-none focus:border-[#7a8c5d] focus:ring-4 focus:ring-[#e3ead8] disabled:bg-[#f4f5f1]" />
                </label>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#f1f4eb] p-4 text-sm leading-6 text-[#52623d]">
                <LockKeyhole aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <p>Do not include clinical details, diagnoses, emergency information, or payment credentials in this form.</p>
              </div>

              {createdPaymentRequest && checkoutMutation.isError ? (
                <p className="mt-5 rounded-2xl bg-[#fff8e8] p-4 text-sm leading-6 text-[#725b19]">
                  Your order and M-Pesa payment request were created, but the phone prompt could not be sent. Retrying will reuse the same payment request.
                </p>
              ) : createdOrder && checkoutMutation.isError ? (
                <p className="mt-5 rounded-2xl bg-[#fff8e8] p-4 text-sm leading-6 text-[#725b19]">
                  Your order was created, but its M-Pesa payment request was not. Retrying will reuse the same order.
                </p>
              ) : checkoutMutation.isError ? (
                <p className="mt-5 rounded-2xl bg-[#fff4f1] p-4 text-sm text-[#8b4a3a]">
                  Checkout could not be completed. Please review your details and try again.
                </p>
              ) : null}

              {cannotCheckout ? (
                <p className="mt-5 text-sm text-[#8b4a3a]">Return to your cart and resolve unavailable or incompatible items before continuing.</p>
              ) : null}

              <button type="submit" disabled={cannotCheckout || checkoutMutation.isPending} className="mt-6 rounded-full bg-[#556b2f] px-7 py-3.5 font-semibold text-white transition hover:bg-[#465a27] disabled:cursor-not-allowed disabled:bg-[#aab49a]">
                {checkoutMutation.isPending ? "Sending M-Pesa prompt…" : createdPaymentRequest ? "Retry M-Pesa prompt" : "Pay with M-Pesa"}
              </button>
            </form>
          </div>

          <aside className="rounded-[2rem] bg-[#26311f] p-7 text-white lg:sticky lg:top-28">
            <h2 className="font-serif text-3xl">Order summary</h2>
            <div className="mt-6 space-y-4">
              {resolvedLines.map((line) => (
                <div key={line.commerce_item_id} className="flex justify-between gap-4 text-sm">
                  <span className="text-[#dfe5d6]">{line.quantity} × {line.item?.name || "Unavailable item"}</span>
                  <span>{line.item ? formatMoney(Number(line.item.price_amount) * line.quantity, line.item.currency) : "—"}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-between border-t border-white/20 pt-5 text-lg">
              <span>Total</span><strong>{formatMoney(total, currency)}</strong>
            </div>
            <p className="mt-4 text-xs leading-6 text-[#cbd5ba]">The server verifies current catalogue prices before creating your order.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
