import {
  useState,
  type FormEvent,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { PageHeader } from "../../../components/data/PageHeader";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchBookingSettings,
  updateBookingSettings,
  type BookingSettings,
  type ConfirmationMode,
  type PaymentPolicy,
} from "../lib/bookingEngineApi";

const selectClassName =
  "min-w-0 w-full rounded-2xl border px-4 py-3 " +
  "text-sm outline-none focus:border-slate-900 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 " +
  "disabled:text-slate-500";

type BookingSettingsFormProps = {
  settings: BookingSettings;
  canUpdate: boolean;
};

function BookingSettingsForm({
  settings,
  canUpdate,
}: BookingSettingsFormProps) {
  const queryClient = useQueryClient();

  const [paymentPolicy, setPaymentPolicy] =
    useState<PaymentPolicy>(
      settings.payment_policy,
    );
  const [
    depositPercentage,
    setDepositPercentage,
  ] = useState(
    settings.deposit_percentage === null
      ? ""
      : String(settings.deposit_percentage),
  );
  const [
    confirmationMode,
    setConfirmationMode,
  ] = useState<ConfirmationMode>(
    settings.confirmation_mode,
  );
  const [
    paymentProvider,
    setPaymentProvider,
  ] = useState(
    settings.recommended_payment_provider ?? "",
  );
  const [formError, setFormError] =
    useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: updateBookingSettings,
    onSuccess: (savedSettings) => {
      queryClient.setQueryData(
        ["booking-settings"],
        savedSettings,
      );

      setPaymentPolicy(
        savedSettings.payment_policy,
      );
      setDepositPercentage(
        savedSettings.deposit_percentage === null
          ? ""
          : String(
              savedSettings.deposit_percentage,
            ),
      );
      setConfirmationMode(
        savedSettings.confirmation_mode,
      );
      setPaymentProvider(
        savedSettings
          .recommended_payment_provider ?? "",
      );
      setFormError(null);
    },
  });

  function clearFeedback() {
    setFormError(null);
    updateMutation.reset();
  }

  function handlePaymentPolicyChange(
    nextPolicy: PaymentPolicy,
  ) {
    setPaymentPolicy(nextPolicy);
    clearFeedback();

    if (nextPolicy !== "deposit") {
      setDepositPercentage("");
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setFormError(null);

    if (!canUpdate) {
      setFormError(
        "You do not have permission to update booking settings.",
      );
      return;
    }

    let parsedDeposit: number | null = null;

    if (paymentPolicy === "deposit") {
      parsedDeposit = Number(
        depositPercentage,
      );

      if (
        !Number.isInteger(parsedDeposit) ||
        parsedDeposit < 1 ||
        parsedDeposit > 99
      ) {
        setFormError(
          "Deposit percentage must be a whole number between 1 and 99.",
        );
        return;
      }
    }

    updateMutation.mutate({
      payment_policy: paymentPolicy,
      deposit_percentage: parsedDeposit,
      confirmation_mode: confirmationMode,
      recommended_payment_provider:
        paymentProvider.trim() || null,
    });
  }

  const sourceLabel =
    settings.source === "database"
      ? "Saved practice settings"
      : "Generated profile default";

  return (
    <>
      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Current source
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">
              {sourceLabel}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Saving this form creates or updates
              the practice-wide database settings.
              Service overrides still take priority.
            </p>
          </div>

          <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {settings.source === "database"
              ? "Customized"
              : "Factory default"}
          </span>
        </div>
      </section>

      <form
        className="space-y-6"
        onSubmit={handleSubmit}
      >
        <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Payment requirements
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Choose what a client must do before
              the booking can be confirmed.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="block min-w-0 space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Default payment policy
              </span>

              <select
                className={selectClassName}
                value={paymentPolicy}
                disabled={!canUpdate}
                onChange={(event) =>
                  handlePaymentPolicyChange(
                    event.target
                      .value as PaymentPolicy,
                  )
                }
              >
                <option value="none">
                  No payment required
                </option>
                <option value="pay_later">
                  Pay later
                </option>
                <option value="deposit">
                  Deposit required
                </option>
                <option value="full_upfront">
                  Full payment upfront
                </option>
              </select>
            </label>

            {paymentPolicy === "deposit" ? (
              <Input
                label="Deposit percentage"
                type="number"
                min={1}
                max={99}
                step={1}
                inputMode="numeric"
                value={depositPercentage}
                disabled={!canUpdate}
                required
                onChange={(event) => {
                  setDepositPercentage(
                    event.target.value,
                  );
                  clearFeedback();
                }}
              />
            ) : null}

            <label className="block min-w-0 space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Confirmation mode
              </span>

              <select
                className={selectClassName}
                value={confirmationMode}
                disabled={!canUpdate}
                onChange={(event) => {
                  setConfirmationMode(
                    event.target
                      .value as ConfirmationMode,
                  );
                  clearFeedback();
                }}
              >
                <option value="instant">
                  Confirm instantly
                </option>
                <option value="staff_approval">
                  Require staff approval
                </option>
              </select>
            </label>

            <Input
              label="Recommended payment provider"
              value={paymentProvider}
              disabled={!canUpdate}
              placeholder="For example, mpesa"
              onChange={(event) => {
                setPaymentProvider(
                  event.target.value,
                );
                clearFeedback();
              }}
            />
          </div>
        </section>

        <section className="rounded-3xl border bg-slate-50 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-slate-950">
            How booking rules are resolved
          </h3>

          <ol className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <li className="rounded-2xl border bg-white p-4">
              <strong className="block text-slate-950">
                1. Service override
              </strong>
              A service can define its own payment
              or confirmation requirement.
            </li>

            <li className="rounded-2xl border bg-white p-4">
              <strong className="block text-slate-950">
                2. Practice setting
              </strong>
              The saved values on this page apply
              when the service has no override.
            </li>

            <li className="rounded-2xl border bg-white p-4">
              <strong className="block text-slate-950">
                3. Generated default
              </strong>
              The profile default is used until
              practice settings are saved.
            </li>
          </ol>
        </section>

        {!canUpdate ? (
          <p
            className="rounded-2xl border bg-white p-4 text-sm text-slate-600"
            role="status"
          >
            You have read-only access to these
            settings.
          </p>
        ) : null}

        {formError ? (
          <p
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {formError}
          </p>
        ) : null}

        {updateMutation.isError ? (
          <p
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            We could not save the booking settings.
            Review the values and try again.
          </p>
        ) : null}

        {updateMutation.isSuccess ? (
          <p
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
            role="status"
            aria-live="polite"
          >
            Booking settings saved.
          </p>
        ) : null}

        {canUpdate ? (
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending
                ? "Saving..."
                : "Save booking settings"}
            </Button>
          </div>
        ) : null}
      </form>
    </>
  );
}

export function BookingSettingsPage() {
  const { hasPermission } = useAuth();

  const settingsQuery = useQuery({
    queryKey: ["booking-settings"],
    queryFn: fetchBookingSettings,
  });

  const settings = settingsQuery.data;

  const formKey = settings
    ? [
        settings.source,
        settings.payment_policy,
        settings.deposit_percentage ?? "none",
        settings.confirmation_mode,
        settings.recommended_payment_provider ??
          "none",
      ].join(":")
    : "loading";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Booking Engine"
        title="Booking Settings"
        description="Set the practice-wide payment and confirmation rules used when a service does not provide its own override."
      />

      <DataState
        isLoading={settingsQuery.isLoading}
        isError={settingsQuery.isError}
        empty={false}
      />

      {!settingsQuery.isLoading &&
      !settingsQuery.isError &&
      settings ? (
        <BookingSettingsForm
          key={formKey}
          settings={settings}
          canUpdate={hasPermission(
            "booking_engine.update",
          )}
        />
      ) : null}
    </div>
  );
}
