import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataState } from "../../../components/data/DataState";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../../auth/context/AuthContext";
import type {
  ServiceConfirmationMode,
  ServicePaymentPolicy,
} from "../lib/servicesApi";
import {
  createService,
  deleteService,
  fetchServices,
  Service,
  ServicePayload,
  updateService,
} from "../lib/servicesApi";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function paymentRuleLabel(
  policy: ServicePaymentPolicy | null,
) {
  switch (policy) {
    case "none":
      return "No payment required";
    case "pay_later":
      return "Pay later";
    case "deposit":
      return "Deposit required";
    case "full_upfront":
      return "Full payment upfront";
    default:
      return "Practice default";
  }
}

function confirmationRuleLabel(
  mode: ServiceConfirmationMode | null,
) {
  switch (mode) {
    case "instant":
      return "Confirm instantly";
    case "staff_approval":
      return "Staff approval";
    default:
      return "Practice default";
  }
}

const selectClassName =
  "min-w-0 w-full rounded-2xl border px-4 py-3 " +
  "text-sm outline-none focus:border-slate-900";

export function ServicesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const canCreate = hasPermission(
    "services.create",
  );
  const canUpdate = hasPermission(
    "services.update",
  );
  const canDelete = hasPermission(
    "services.delete",
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [serviceFormat, setServiceFormat] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [priceAmount, setPriceAmount] = useState<string>("");
  const [currency, setCurrency] = useState("KES");
  const [
    paymentPolicyOverride,
    setPaymentPolicyOverride,
  ] = useState<ServicePaymentPolicy | "">("");
  const [
    depositPercentageOverride,
    setDepositPercentageOverride,
  ] = useState<number | "">("");
  const [
    confirmationModeOverride,
    setConfirmationModeOverride,
  ] = useState<ServiceConfirmationMode | "">("");
  const [ctaLabel, setCtaLabel] = useState("Book this service");
  const [ctaUrl, setCtaUrl] = useState("/book");
  const [sortOrder, setSortOrder] = useState(0);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [formError, setFormError] =
    useState<string | null>(null);
  const [editorOpen, setEditorOpen] =
    useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
  });

  function resetForm() {
    setEditingId(null);
    setName("");
    setSlug("");
    setSummary("");
    setDescription("");
    setCategory("");
    setServiceFormat("");
    setDurationMinutes("");
    setPriceAmount("");
    setCurrency("KES");
    setPaymentPolicyOverride("");
    setDepositPercentageOverride("");
    setConfirmationModeOverride("");
    setCtaLabel("Book this service");
    setCtaUrl("/book");
    setSortOrder(0);
    setIsFeatured(false);
    setIsPublished(true);
    setFormError(null);
    setEditorOpen(false);
  }

  function editService(service: Service) {
    setEditingId(service.id);
    setName(service.name);
    setSlug(service.slug);
    setSummary(service.summary ?? "");
    setDescription(service.description ?? "");
    setCategory(service.category ?? "");
    setServiceFormat(service.service_format ?? "");
    setDurationMinutes(service.duration_minutes ?? "");
    setPriceAmount(service.price_amount === null || service.price_amount === undefined ? "" : String(service.price_amount));
    setCurrency(service.currency ?? "KES");
    setPaymentPolicyOverride(
      service.payment_policy_override ?? "",
    );
    setDepositPercentageOverride(
      service.deposit_percentage_override ?? "",
    );
    setConfirmationModeOverride(
      service.confirmation_mode_override ?? "",
    );
    setCtaLabel(service.cta_label ?? "Book this service");
    setCtaUrl(service.cta_url ?? "/book");
    setSortOrder(service.sort_order ?? 0);
    setIsFeatured(service.is_featured);
    setIsPublished(service.is_published);
    setFormError(null);
    setEditorOpen(true);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function startCreateService() {
    resetForm();
    setEditorOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["public-services"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateService,
    onSuccess: () => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["public-services"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["public-services"] });
    },
  });

  function handleNameChange(value: string) {
    setName(value);
    if (!slug) setSlug(slugify(value));
  }

  function payload(): ServicePayload {
    return {
      name,
      slug: slugify(slug || name),
      summary,
      description,
      category,
      service_format: serviceFormat,
      duration_minutes: durationMinutes === "" ? null : Number(durationMinutes),
      price_amount:
        priceAmount === "" ? null : priceAmount,
      currency,
      payment_policy_override:
        paymentPolicyOverride || null,
      deposit_percentage_override:
        paymentPolicyOverride === "deposit" &&
        depositPercentageOverride !== ""
          ? Number(depositPercentageOverride)
          : null,
      confirmation_mode_override:
        confirmationModeOverride || null,
      cta_label: ctaLabel,
      cta_url: ctaUrl,
      sort_order: sortOrder,
      is_featured: isFeatured,
      is_published: isPublished,
    };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const canSave = editingId
      ? canUpdate
      : canCreate;

    if (!canSave) {
      setFormError(
        "You do not have permission to save this service.",
      );
      return;
    }

    const parsedDeposit =
      depositPercentageOverride === ""
        ? null
        : Number(depositPercentageOverride);

    if (
      paymentPolicyOverride === "deposit" &&
      (
        parsedDeposit === null ||
        !Number.isInteger(parsedDeposit) ||
        parsedDeposit < 1 ||
        parsedDeposit > 99
      )
    ) {
      setFormError(
        "Deposit percentage must be a whole number between 1 and 99.",
      );
      return;
    }

    const nextPayload = payload();

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: nextPayload });
      return;
    }

    createMutation.mutate(nextPayload);
  }

  const showState =
    isLoading || isError || !data?.length;
  const saving =
    createMutation.isPending ||
    updateMutation.isPending;
  const showEditor =
    editorOpen &&
    (
      (editingId === null && canCreate) ||
      (editingId !== null && canUpdate)
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="order-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Reusable catalog
          </p>
          <h2 className="text-3xl font-bold">
            Services
          </h2>
          <p className="mt-2 text-slate-600">
            Manage public services, formats, durations,
            pricing, booking rules and publishing state.
          </p>
        </div>

        {canCreate ? (
          <Button
            type="button"
            onClick={startCreateService}
          >
            + Add service
          </Button>
        ) : null}
      </div>

      {showEditor ? (
        <form
          onSubmit={handleSubmit}
          className="order-3 rounded-2xl border bg-white p-6 shadow-sm"
        >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{editingId ? "Edit service" : "Create service"}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Keep this limited to public offer content. Do not store appointment, payment, intake, consent, or client-record data here.
            </p>
          </div>

          {editingId ? (
            <Button type="button" onClick={resetForm}>
              Cancel edit
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Service name" value={name} onChange={(event) => handleNameChange(event.target.value)} required />
          <Input label="Slug" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required />
          <Input label="Category" value={category} onChange={(event) => setCategory(event.target.value)} />
          <Input label="Format" value={serviceFormat} onChange={(event) => setServiceFormat(event.target.value)} />
          <Input
            label="Duration minutes"
            type="number"
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value === "" ? "" : Number(event.target.value))}
          />
          <Input label="Price amount" type="number" value={priceAmount} onChange={(event) => setPriceAmount(event.target.value)} />
          <Input label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
          <Input label="CTA label" value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} />
          <Input label="CTA URL" value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} />
          <Input label="Sort order" type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} />
        </div>

        <section className="mt-6 rounded-2xl border bg-slate-50 p-5">
          <div>
            <h4 className="font-semibold text-slate-950">
              Booking and payment rules
            </h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Leave a rule on practice default to inherit
              the values configured under Booking Settings.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block min-w-0 space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Payment rule
              </span>

              <select
                className={selectClassName}
                value={paymentPolicyOverride}
                onChange={(event) => {
                  const nextPolicy =
                    event.target.value as
                      | ServicePaymentPolicy
                      | "";

                  setPaymentPolicyOverride(nextPolicy);
                  setFormError(null);

                  if (nextPolicy !== "deposit") {
                    setDepositPercentageOverride("");
                  }
                }}
              >
                <option value="">
                  Use practice default
                </option>
                <option value="none">
                  No payment required
                </option>
                <option value="pay_later">
                  Pay later
                </option>
                <option value="deposit">
                  Require a deposit
                </option>
                <option value="full_upfront">
                  Require full payment upfront
                </option>
              </select>
            </label>

            {paymentPolicyOverride === "deposit" ? (
              <Input
                label="Deposit percentage"
                type="number"
                min={1}
                max={99}
                step={1}
                inputMode="numeric"
                value={depositPercentageOverride}
                required
                onChange={(event) => {
                  setDepositPercentageOverride(
                    event.target.value === ""
                      ? ""
                      : Number(event.target.value),
                  );
                  setFormError(null);
                }}
              />
            ) : null}

            <label className="block min-w-0 space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Confirmation rule
              </span>

              <select
                className={selectClassName}
                value={confirmationModeOverride}
                onChange={(event) => {
                  setConfirmationModeOverride(
                    event.target.value as
                      | ServiceConfirmationMode
                      | "",
                  );
                  setFormError(null);
                }}
              >
                <option value="">
                  Use practice default
                </option>
                <option value="instant">
                  Confirm instantly
                </option>
                <option value="staff_approval">
                  Require staff approval
                </option>
              </select>
            </label>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            For 100% payment, select full payment
            upfront. Deposits are limited to 1–99%.
          </p>
        </section>

        <div className="mt-4 grid gap-4">
          <Input label="Summary" value={summary} onChange={(event) => setSummary(event.target.value)} />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} />
            Featured
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
            Published
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Create service"}
          </Button>
        </div>

        {formError ? (
          <p
            className="mt-3 text-sm text-red-600"
            role="alert"
          >
            {formError}
          </p>
        ) : null}

        {createMutation.isError || updateMutation.isError ? (
          <p className="mt-3 text-sm text-red-600">
            Service save failed. Check required fields, price, currency, and CTA URL.
          </p>
        ) : null}
        </form>
      ) : (
        <section className="order-3 rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
          {canUpdate ? (
            <>
              Select <strong>Edit</strong> on a service
              to change its content, price or booking
              rules.
            </>
          ) : (
            <>
              You have read-only access to services.
              Creating, editing and deleting require
              additional permissions.
            </>
          )}
        </section>
      )}

      <div className="order-2">
      {showState ? (
        <DataState isLoading={isLoading} isError={isError} empty={!data?.length} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">Service</th>
                <th className="p-4">Details</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((service) => (
                <tr className="border-t align-top" key={service.id}>
                  <td className="p-4">
                    <div className="font-medium">{service.name}</div>
                    <div className="text-slate-500">/{service.slug}</div>
                    {service.summary ? <div className="mt-1 text-slate-600">{service.summary}</div> : null}
                  </td>
                  <td className="p-4">
                    <div>{service.category || "—"}</div>
                    <div className="text-slate-500">{service.service_format || ""}</div>
                    <div className="text-slate-500">
                      {service.duration_minutes ? `${service.duration_minutes} minutes` : ""}
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-600">
                      Payment:{" "}
                      {paymentRuleLabel(
                        service.payment_policy_override,
                      )}
                    </div>
                    {service.payment_policy_override ===
                    "deposit" ? (
                      <div className="text-xs text-slate-500">
                        Deposit:{" "}
                        {service.deposit_percentage_override}%
                      </div>
                    ) : null}
                    <div className="text-xs text-slate-500">
                      Confirmation:{" "}
                      {confirmationRuleLabel(
                        service.confirmation_mode_override,
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div>{service.is_published ? "Published" : "Draft"}</div>
                    <div className="text-slate-500">{service.is_featured ? "Featured" : "Standard"}</div>
                    <div className="text-slate-500">Order: {service.sort_order}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {canUpdate ? (
                        <Button
                          type="button"
                          onClick={() =>
                            editService(service)
                          }
                        >
                          Edit
                        </Button>
                      ) : null}
                      {canUpdate ? (
                        <Button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: service.id,
                              data: {
                                is_published:
                                  !service.is_published,
                              },
                            })
                          }
                          disabled={
                            updateMutation.isPending
                          }
                        >
                          {service.is_published
                            ? "Unpublish"
                            : "Publish"}
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() =>
                            deleteMutation.mutate(
                              service.id,
                            )
                          }
                          disabled={
                            deleteMutation.isPending
                          }
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
