export function MpesaPaymentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-slate-500">M-Pesa operations</p>
        <h2 className="text-3xl font-bold">M-Pesa Payments</h2>
        <p className="mt-2 text-slate-600">
          Prepare M-Pesa STK Push attempts and receive sanitized callback events through the payment attempts safety layer.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Payment processing status</h3>
        <p className="mt-2 text-sm text-slate-600">
          Prepare and review M-Pesa STK Push activity through the verified payment workflow. Payment requests, provider attempts, receipts, and fulfillment remain linked across the practice workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">STK Push</p>
          <p className="mt-2 text-xl font-semibold">STK Push ready</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Callbacks</p>
          <p className="mt-2 text-xl font-semibold">Verification required</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Payloads</p>
          <p className="mt-2 text-xl font-semibold">Sanitized</p>
        </div>
      </div>
    </div>
  );
}
