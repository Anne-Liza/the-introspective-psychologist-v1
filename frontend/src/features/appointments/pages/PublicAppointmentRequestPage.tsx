import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  createPublicBooking,
  createPublicBookingHold,
  createPublicBookingHoldPaymentRequest,
  fetchPublicAvailableDates,
  fetchPublicBookableSlots,
  fetchPublicBookingConfig,
  type PublicBookingHold,
} from "../../booking-engine/lib/bookingEngineApi";
import {
  initiatePublicMpesaStkPush,
} from "../../mpesa-payments/lib/mpesaPaymentsApi";
import { fetchPublicServices } from "../../services/lib/servicesApi";
import { fetchPublicTherapistProfiles } from "../../therapist-profiles/lib/therapistProfilesApi";

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function timeLabel(value: string) {
  return new Date(`2000-01-01T${value}`).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}


function moneyLabel(
  value: string | number,
  currency: string,
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${currency} ${String(value)}`;
  }

  try {
    return new Intl.NumberFormat([], {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function bookingErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function PublicAppointmentRequestPage() {
  const [serviceId, setServiceId] = useState("");
  const [sessionFormat, setSessionFormat] = useState("");
  const [location, setLocation] = useState("");
  const [preferredTherapistId, setPreferredTherapistId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [
    pendingPaymentHold,
    setPendingPaymentHold,
  ] = useState<PublicBookingHold | null>(null);

  const configQuery = useQuery({ queryKey: ["public-booking-config"], queryFn: fetchPublicBookingConfig });
  const servicesQuery = useQuery({ queryKey: ["public-services"], queryFn: fetchPublicServices });
  const therapistsQuery = useQuery({
    queryKey: ["public-therapist-profiles"],
    queryFn: fetchPublicTherapistProfiles,
  });

  const selectedService = servicesQuery.data?.find(
    (service) => service.id === serviceId,
  );

  const availableFormats = useMemo(() => {
    const formats = configQuery.data?.session_formats ?? [];

    if (!selectedService?.service_format) {
      return formats;
    }

    const supportedFormat = normalize(selectedService.service_format);

    return formats.filter((format) =>
      supportedFormat.includes(normalize(format.key)),
    );
  }, [
    configQuery.data?.session_formats,
    selectedService?.service_format,
  ]);

  const selectedFormat = configQuery.data?.session_formats.find(
    (item) => item.key === sessionFormat,
  );
  const needsLocation = selectedFormat?.requires_location ?? false;

  const readyForAvailableDates = Boolean(
    serviceId &&
      sessionFormat &&
      (!needsLocation || location),
  );

  const availableDatesQuery = useQuery({
    queryKey: [
      "public-available-dates",
      serviceId,
      sessionFormat,
      location,
      preferredTherapistId,
    ],
    queryFn: () =>
      fetchPublicAvailableDates({
        service_id: serviceId,
        session_format: sessionFormat,
        ...(needsLocation ? { location } : {}),
        ...(preferredTherapistId
          ? {
              preferred_therapist_profile_id:
                preferredTherapistId,
            }
          : {}),
      }),
    enabled: readyForAvailableDates,
  });

  const readyForSlots = Boolean(
    readyForAvailableDates && appointmentDate,
  );

  const slotsQuery = useQuery({
    queryKey: [
      "public-bookable-slots",
      appointmentDate,
      serviceId,
      sessionFormat,
      location,
      preferredTherapistId,
    ],
    queryFn: () =>
      fetchPublicBookableSlots({
        date: appointmentDate,
        service_id: serviceId,
        session_format: sessionFormat,
        ...(needsLocation ? { location } : {}),
        ...(preferredTherapistId
          ? { preferred_therapist_profile_id: preferredTherapistId }
          : {}),
      }),
    enabled: readyForSlots,
  });

  const eligibleTherapists = useMemo(() => {
    const profiles = therapistsQuery.data ?? [];
    if (!sessionFormat) return profiles;
    return profiles.filter((profile) => normalize(profile.session_formats).includes(normalize(sessionFormat)));
  }, [sessionFormat, therapistsQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const slot = slotsQuery.data?.find(
        (item) =>
          `${item.start_time}|${item.end_time}` ===
          selectedSlot,
      );

      if (!slot) {
        throw new Error(
          "Select an available time.",
        );
      }

      const paymentPolicy =
        configQuery.data?.payment_policy;

      if (!paymentPolicy) {
        throw new Error(
          "The booking configuration is still loading.",
        );
      }

      const bookingDetails = {
        hold_date: appointmentDate,
        start_time: slot.start_time,
        end_time: slot.end_time,
        service_id: serviceId,
        preferred_therapist_profile_id:
          preferredTherapistId || null,
        session_format: sessionFormat,
        location: needsLocation
          ? location
          : null,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone || null,
      };

      if (
        paymentPolicy === "deposit" ||
        paymentPolicy === "full_upfront"
      ) {
        let hold = pendingPaymentHold;

        if (!hold) {
          hold = await createPublicBookingHold(
            bookingDetails,
          );

          setPendingPaymentHold(hold);
        }

        const paymentRequest =
          await createPublicBookingHoldPaymentRequest({
            holdId: hold.id,
            customer_email: clientEmail,
          });

        setMpesaPhone(
          (current) => current || clientPhone,
        );

        return {
          kind: "payment_required" as const,
          hold,
          paymentRequest,
        };
      }

      const confirmation =
        await createPublicBooking({
          ...bookingDetails,
          client_message:
            clientMessage || null,
        });

      return {
        kind: "appointment" as const,
        confirmation,
      };
    },
  });

  function resetSlotSelection() {
    setSelectedSlot("");
    setPendingPaymentHold(null);
    setMpesaPhone("");
    mpesaMutation.reset();
    mutation.reset();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  function handleBookAnother() {
    mutation.reset();
    setServiceId("");
    setSessionFormat("");
    setLocation("");
    setPreferredTherapistId("");
    setAppointmentDate("");
    setSelectedSlot("");
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientMessage("");
    setMpesaPhone("");
    setPendingPaymentHold(null);
    mpesaMutation.reset();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  const requiresAdvancePayment =
    configQuery.data?.payment_policy === "deposit" ||
    configQuery.data?.payment_policy ===
      "full_upfront";

  const appointmentConfirmation =
    mutation.data?.kind === "appointment"
      ? mutation.data.confirmation
      : null;

  const paymentHold =
    mutation.data?.kind === "payment_required"
      ? mutation.data.hold
      : pendingPaymentHold;

  const paymentRequest =
    mutation.data?.kind === "payment_required"
      ? mutation.data.paymentRequest
      : null;

  const paymentAmount =
    paymentRequest?.amount ??
    paymentHold?.advance_payment_amount ??
    null;

  const paymentCurrency =
    paymentRequest?.currency ??
    paymentHold?.payment_currency ??
    null;

  const mpesaMutation = useMutation({
    mutationFn: async () => {
      if (!paymentRequest) {
        throw new Error(
          "The payment request is not ready.",
        );
      }

      const phoneNumber =
        mpesaPhone.trim() ||
        clientPhone.trim();

      if (!phoneNumber) {
        throw new Error(
          "Enter the Kenyan phone number that should receive the M-Pesa prompt.",
        );
      }

      return initiatePublicMpesaStkPush({
        paymentRequestId: paymentRequest.id,
        phone_number: phoneNumber,
      });
    },
  });

  const paymentDisplayStatus =
    mpesaMutation.data?.status === "processing"
      ? "processing"
      : paymentRequest?.status ?? null;

  const appointmentIsConfirmed =
    appointmentConfirmation?.status ===
    "confirmed";

  return (
    <main className="bg-[#f7f5ed] text-[#26311f]">
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#738064]">Book a session</p>
          <h1 className="mt-4 font-serif text-5xl leading-tight md:text-6xl">Choose a session that fits.</h1>
          <p className="mt-6 text-lg leading-8 text-[#53604b]">
            Select a service, format, and available time. You may request a therapist or let the practice assign the least-loaded eligible therapist.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-12 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6 rounded-[2rem] border border-[#dce3d3] bg-white p-6 shadow-sm md:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#738064]">1. Session</p>
              <h2 className="mt-2 font-serif text-3xl">What support are you looking for?</h2>
            </div>

            <label className="block text-sm font-medium">
              Service
              <select
                value={serviceId}
                onChange={(event) => {
                  const nextServiceId = event.target.value;
                  const nextService = servicesQuery.data?.find(
                    (service) => service.id === nextServiceId,
                  );

                  const nextFormats = (
                    configQuery.data?.session_formats ?? []
                  ).filter((format) => {
                    if (!nextService?.service_format) {
                      return true;
                    }

                    return normalize(
                      nextService.service_format,
                    ).includes(normalize(format.key));
                  });

                  setServiceId(nextServiceId);
                  setSessionFormat(
                    nextFormats.length === 1 ? nextFormats[0].key : "",
                  );
                  setLocation("");
                  setPreferredTherapistId("");
                  setAppointmentDate("");
                  resetSlotSelection();
                }}
                required
                className="mt-2 w-full rounded-2xl border border-[#cad5c1] bg-white px-4 py-3 outline-none focus:border-[#6f865b] focus:ring-2 focus:ring-[#e1ead9]"
              >
                <option value="">Select a service</option>
                {(servicesQuery.data ?? []).map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}{service.duration_minutes ? ` · ${service.duration_minutes} min` : ""}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-sm font-medium">Session format</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {availableFormats.map((format) => (
                  <label
                    key={format.key}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      sessionFormat === format.key
                        ? "border-[#536b43] bg-[#eef3e9]"
                        : "border-[#dce3d3] bg-white hover:border-[#9aaa8c]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="session-format"
                      value={format.key}
                      checked={sessionFormat === format.key}
                      onChange={(event) => {
                        setSessionFormat(event.target.value);
                        setLocation("");
                        setPreferredTherapistId("");
                        setAppointmentDate("");
                        resetSlotSelection();
                      }}
                      required
                      className="mr-3"
                    />
                    <span className="font-semibold">{format.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {needsLocation ? (
              <label className="block text-sm font-medium">
                Location
                <select
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value);
                    setAppointmentDate("");
                    resetSlotSelection();
                  }}
                  required
                  className="mt-2 w-full rounded-2xl border border-[#cad5c1] bg-white px-4 py-3"
                >
                  <option value="">Select a location</option>
                  {(configQuery.data?.locations ?? []).map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block text-sm font-medium">
              Therapist preference
              <select
                value={preferredTherapistId}
                onChange={(event) => {
                  setPreferredTherapistId(event.target.value);
                  setAppointmentDate("");
                  resetSlotSelection();
                }}
                className="mt-2 w-full rounded-2xl border border-[#cad5c1] bg-white px-4 py-3"
              >
                <option value="">No preference · assign fairly</option>
                {eligibleTherapists.map((therapist) => (
                  <option key={therapist.id} value={therapist.id}>{therapist.full_name}</option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-[#738064]">
                No preference uses deterministic least-loaded allocation among eligible therapists.
              </span>
            </label>

            <div className="space-y-5">
              <fieldset>
                <legend className="text-sm font-medium">
                  Available date
                </legend>

                <div className="mt-2 grid max-h-60 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {!readyForAvailableDates ? (
                    <p className="col-span-full rounded-2xl bg-[#f7f5ed] p-4 text-sm text-[#738064]">
                      Select a service, session format, and location to view available dates.
                    </p>
                  ) : availableDatesQuery.isLoading ? (
                    <p className="col-span-full rounded-2xl bg-[#f7f5ed] p-4 text-sm text-[#738064]">
                      Finding available dates…
                    </p>
                  ) : availableDatesQuery.isError ? (
                    <p className="col-span-full rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800">
                      {bookingErrorMessage(
                        availableDatesQuery.error,
                        "We could not load available dates. Please try again.",
                      )}
                    </p>
                  ) : (availableDatesQuery.data ?? []).length === 0 ? (
                    <p className="col-span-full rounded-2xl bg-[#f7f5ed] p-4 text-sm text-[#738064]">
                      No appointments are currently available for this selection. Try another format, location, or therapist preference.
                    </p>
                  ) : (
                    (availableDatesQuery.data ?? []).map(
                      (availableDate) => (
                        <label
                          key={availableDate.date}
                          className={`cursor-pointer rounded-2xl border p-4 transition ${
                            appointmentDate === availableDate.date
                              ? "border-[#536b43] bg-[#eef3e9]"
                              : "border-[#dce3d3] bg-white hover:border-[#9aaa8c]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="appointment-date"
                            value={availableDate.date}
                            checked={
                              appointmentDate ===
                              availableDate.date
                            }
                            onChange={(event) => {
                              setAppointmentDate(
                                event.target.value,
                              );
                              resetSlotSelection();
                            }}
                            className="sr-only"
                          />

                          <span className="block font-semibold">
                            {dateLabel(availableDate.date)}
                          </span>

                          <span className="mt-1 block text-xs text-[#738064]">
                            {availableDate.available_slot_count}{" "}
                            {availableDate.available_slot_count === 1
                              ? "time"
                              : "times"}{" "}
                            available · from{" "}
                            {timeLabel(
                              availableDate.first_start_time,
                            )}
                          </span>
                        </label>
                      ),
                    )
                  )}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium">
                  Available time
                </legend>

                <div className="mt-2 grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {!appointmentDate ? (
                    <p className="col-span-full rounded-2xl bg-[#f7f5ed] p-4 text-sm text-[#738064]">
                      Choose an available date to view appointment times.
                    </p>
                  ) : slotsQuery.isLoading ? (
                    <p className="col-span-full rounded-2xl bg-[#f7f5ed] p-4 text-sm text-[#738064]">
                      Checking available times…
                    </p>
                  ) : slotsQuery.isError ? (
                    <p className="col-span-full rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800">
                      {bookingErrorMessage(
                        slotsQuery.error,
                        "We could not load appointment times. Please try again.",
                      )}
                    </p>
                  ) : (slotsQuery.data ?? []).length === 0 ? (
                    <p className="col-span-full rounded-2xl bg-[#f7f5ed] p-4 text-sm text-[#738064]">
                      This date no longer has an available appointment. Choose another available date.
                    </p>
                  ) : (
                    (slotsQuery.data ?? []).map((slot) => {
                      const value = `${slot.start_time}|${slot.end_time}`;

                      return (
                        <label
                          key={value}
                          className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold ${
                            selectedSlot === value
                              ? "border-[#536b43] bg-[#eef3e9]"
                              : "border-[#dce3d3]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="slot"
                            value={value}
                            checked={selectedSlot === value}
                            onChange={(event) => {
                              setSelectedSlot(event.target.value);
                              setPendingPaymentHold(null);
                              setMpesaPhone("");
                              mpesaMutation.reset();
                              mutation.reset();
                            }}
                            className="sr-only"
                          />

                          {timeLabel(slot.start_time)}
                        </label>
                      );
                    })
                  )}
                </div>
              </fieldset>
            </div>
          </div>

          <div className="h-fit space-y-5 rounded-[2rem] bg-[#26311f] p-6 text-white shadow-sm md:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b9c7ad]">2. Your details</p>
              <h2 className="mt-2 font-serif text-3xl">Complete your request.</h2>
            </div>
            <Input className="text-[#26311f] placeholder:text-[#738064] caret-[#26311f]" label="Your name" value={clientName} onChange={(event) => setClientName(event.target.value)} required />
            <Input className="text-[#26311f] placeholder:text-[#738064] caret-[#26311f]" label="Email" type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} required />
            <Input className="text-[#26311f] placeholder:text-[#738064] caret-[#26311f]" label="Phone optional" value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} />

            <label className="block text-sm font-medium">
              Message optional
              <textarea
                value={clientMessage}
                onChange={(event) => setClientMessage(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-[#26311f] outline-none"
              />
            </label>

            <p className="text-xs leading-5 text-[#cbd5c3]">
              Do not include emergency information,
              diagnosis details, or sensitive medical
              history.{" "}
              {requiresAdvancePayment
                ? "A temporary hold protects the selected time while payment is completed."
                : "Your selected time will be checked again when you submit the booking."}
            </p>

            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                mutation.isSuccess ||
                !selectedSlot ||
                !configQuery.data
              }
              className="w-full disabled:bg-white/20 disabled:text-white/60"
            >
              {mutation.isPending
                ? paymentHold
                  ? "Preparing payment…"
                  : "Submitting…"
                : paymentRequest
                  ? "Payment request ready"
                  : paymentHold
                    ? "Retry payment setup"
                    : appointmentConfirmation
                    ? appointmentIsConfirmed
                      ? "Booking confirmed"
                      : "Request received"
                    : requiresAdvancePayment
                      ? "Reserve and continue"
                      : "Confirm booking"}
            </Button>

            {!selectedSlot && !mutation.isSuccess ? (
              <p className="text-center text-xs leading-5 text-[#cbd5c3]">
                Select an available appointment time before confirming.
              </p>
            ) : null}

            {appointmentConfirmation ? (
              <div className="rounded-2xl bg-white/10 p-5 text-sm leading-6">
                <p className="text-lg font-semibold">
                  {appointmentIsConfirmed
                    ? "Your appointment is confirmed."
                    : "Your appointment request has been received."}
                </p>

                <p className="mt-1 text-[#dce5d6]">
                  {appointmentIsConfirmed
                    ? "Your session is booked. The practice will follow up using the contact details provided."
                    : "The practice will review your request and contact you once the appointment is confirmed."}
                </p>

                <dl className="mt-5 space-y-3 rounded-2xl bg-black/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#b9c7ad]">
                      Reference
                    </dt>
                    <dd className="text-right font-semibold">
                      {appointmentConfirmation.appointment_id.slice(
                        0,
                        8,
                      )}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#b9c7ad]">
                      Status
                    </dt>
                    <dd className="text-right font-semibold capitalize">
                      {appointmentConfirmation.status}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#b9c7ad]">
                      Service
                    </dt>
                    <dd className="text-right font-semibold">
                      {selectedService?.name ??
                        "Therapy session"}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#b9c7ad]">
                      Date
                    </dt>
                    <dd className="text-right font-semibold">
                      {dateLabel(
                        appointmentConfirmation.appointment_date,
                      )}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#b9c7ad]">
                      Time
                    </dt>
                    <dd className="text-right font-semibold">
                      {timeLabel(
                        appointmentConfirmation.start_time,
                      )}
                      {" – "}
                      {timeLabel(
                        appointmentConfirmation.end_time,
                      )}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#b9c7ad]">
                      Format
                    </dt>
                    <dd className="text-right font-semibold">
                      {appointmentConfirmation.session_format ??
                        selectedFormat?.label ??
                        sessionFormat}
                    </dd>
                  </div>

                  {appointmentConfirmation.location ? (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[#b9c7ad]">
                        Location
                      </dt>
                      <dd className="text-right font-semibold">
                        {
                          appointmentConfirmation.location
                        }
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBookAnother}
                  className="mt-5 w-full border-white/20 bg-white text-[#26311f]"
                >
                  Book another session
                </Button>
              </div>
            ) : null}

            {paymentHold ? (
              <div className="rounded-2xl bg-white/10 p-5 text-sm leading-6">
                <p className="text-lg font-semibold">
                  {mpesaMutation.data
                    ? "Check your phone to complete payment."
                    : paymentRequest
                      ? "Your payment request is ready."
                      : "Your selected time is temporarily held."}
                </p>

                <p className="mt-1 text-[#dce5d6]">
                  {mpesaMutation.data
                    ? "An M-Pesa prompt was sent. Enter your PIN on your phone. Your booking remains unconfirmed until payment is verified."
                    : paymentRequest
                      ? "Send the M-Pesa prompt before the hold expires. Your booking remains unconfirmed until payment is verified."
                      : "Payment setup has not finished. Retry before the hold expires."}
                </p>

                <dl className="mt-5 space-y-3 rounded-2xl bg-black/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#b9c7ad]">
                      Hold reference
                    </dt>
                    <dd className="text-right font-semibold">
                      {paymentHold.id.slice(0, 8)}
                    </dd>
                  </div>

                  {paymentRequest ? (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[#b9c7ad]">
                        Payment reference
                      </dt>
                      <dd className="text-right font-semibold">
                        {paymentRequest.request_number}
                      </dd>
                    </div>
                  ) : null}

                  {paymentAmount &&
                  paymentCurrency ? (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[#b9c7ad]">
                        Amount due
                      </dt>
                      <dd className="text-right font-semibold">
                        {moneyLabel(
                          paymentAmount,
                          paymentCurrency,
                        )}
                      </dd>
                    </div>
                  ) : null}

                  {paymentRequest ? (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[#b9c7ad]">
                        Payment status
                      </dt>
                      <dd className="text-right font-semibold capitalize">
                        {(
                          paymentDisplayStatus ??
                          paymentRequest.status
                        ).replace(
                          /_/g,
                          " ",
                        )}
                      </dd>
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#b9c7ad]">
                      Date
                    </dt>
                    <dd className="text-right font-semibold">
                      {dateLabel(paymentHold.hold_date)}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#b9c7ad]">
                      Time
                    </dt>
                    <dd className="text-right font-semibold">
                      {timeLabel(
                        paymentHold.start_time,
                      )}
                      {" – "}
                      {timeLabel(
                        paymentHold.end_time,
                      )}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#b9c7ad]">
                      Hold expires
                    </dt>
                    <dd className="text-right font-semibold">
                      {new Date(
                        paymentHold.expires_at,
                      ).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </dd>
                  </div>
                </dl>

                {paymentRequest ? (
                  <div className="mt-5 rounded-2xl border border-white/15 bg-black/10 p-4">
                    <Input
                      className="text-[#26311f] placeholder:text-[#738064] caret-[#26311f]"
                      label="M-Pesa phone number"
                      placeholder="0712 345 678"
                      value={mpesaPhone}
                      onChange={(event) =>
                        setMpesaPhone(
                          event.target.value,
                        )
                      }
                      disabled={
                        mpesaMutation.isPending ||
                        Boolean(mpesaMutation.data)
                      }
                    />

                    <p className="mt-3 text-xs leading-5 text-[#cbd5c3]">
                      Use a Kenyan Safaricom number that can
                      receive an M-Pesa STK prompt. The
                      browser sends the phone number only.
                      The server controls the amount,
                      currency, reference, and payment
                      target.
                    </p>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        mpesaMutation.mutate()
                      }
                      disabled={
                        mpesaMutation.isPending ||
                        Boolean(mpesaMutation.data) ||
                        !(
                          mpesaPhone.trim() ||
                          clientPhone.trim()
                        )
                      }
                      className="mt-4 w-full border-white/20 bg-white text-[#26311f]"
                    >
                      {mpesaMutation.isPending
                        ? "Sending M-Pesa prompt…"
                        : mpesaMutation.data
                          ? "M-Pesa prompt sent"
                          : mpesaMutation.isError
                            ? "Try M-Pesa again"
                            : "Send M-Pesa prompt"}
                    </Button>

                    {mpesaMutation.data ? (
                      <div className="mt-4 rounded-2xl bg-white/10 p-4">
                        <p className="font-semibold">
                          Check your phone.
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#dce5d6]">
                          Complete the prompt using your
                          M-Pesa PIN. This page does not
                          treat the prompt as proof of
                          payment.
                        </p>

                        <div className="mt-3 flex items-start justify-between gap-4 text-xs">
                          <span className="text-[#b9c7ad]">
                            Prompt status
                          </span>

                          <span className="font-semibold capitalize">
                            {mpesaMutation.data.status.replace(
                              /_/g,
                              " ",
                            )}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {mpesaMutation.isError ? (
                      <p className="mt-4 rounded-2xl bg-red-100 p-4 text-sm font-medium text-red-800">
                        {bookingErrorMessage(
                          mpesaMutation.error,
                          "The M-Pesa prompt could not be sent. Review the phone number and try again.",
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <p className="mt-4 text-xs leading-5 text-[#cbd5c3]">
                  Sending the prompt does not mark the payment as complete or confirm the appointment. Verification happens separately after M-Pesa reports the result.
                </p>

                {!paymentRequest &&
                mutation.isError ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    className="mt-5 w-full border-white/20 bg-white text-[#26311f]"
                  >
                    Retry payment setup
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBookAnother}
                  disabled={mpesaMutation.isPending}
                  className="mt-3 w-full border-white/20 bg-white text-[#26311f]"
                >
                  Choose another session
                </Button>
              </div>
            ) : null}
            {mutation.isError ? (
              <p className="rounded-2xl bg-red-100 p-4 text-sm font-medium text-red-800">
                {bookingErrorMessage(
                  mutation.error,
                  "This booking could not be completed. The slot may have just been taken. Refresh the available times and try again.",
                )}
              </p>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
}
