import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
} from "lucide-react";
import {
  FormEvent,
  useState,
} from "react";
import {
  Link,
  Navigate,
  useParams,
} from "react-router";

import { Button } from "../../../components/ui/Button";
import { DataState } from "../../../components/data/DataState";
import { Input } from "../../../components/ui/Input";
import { apiClient } from "../../../lib/api-client";
import { ManagedImageAssetPicker } from "../../files/components/ManagedImageAssetPicker";
import {
  getCmsPage,
  type CmsSectionContent,
  type CmsSectionDefinition,
} from "../lib/pageCms";

type LandingSection = {
  id: string;
  key: string;
  title: string;
  eyebrow: string | null;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  image_asset_id: string | null;
  sort_order: number;
  is_visible: boolean;
};

type EditorForm = CmsSectionContent & {
  imageAssetId: string | null;
  isVisible: boolean;
};

async function fetchSections() {
  const response = await apiClient.get<LandingSection[]>(
    "/landing-sections",
  );
  return response.data;
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function formFromDefinition(
  definition: CmsSectionDefinition,
  existing?: LandingSection,
): EditorForm {
  return {
    eyebrow:
      existing?.eyebrow ??
      definition.defaults.eyebrow,
    title:
      existing?.title ??
      definition.defaults.title,
    body:
      existing?.body ??
      definition.defaults.body,
    ctaLabel:
      existing?.cta_label ??
      definition.defaults.ctaLabel,
    ctaUrl:
      existing?.cta_url ??
      definition.defaults.ctaUrl,
    imageUrl:
      existing?.image_url ??
      definition.defaults.imageUrl,
    imageAssetId:
      existing?.image_asset_id ?? null,
    isVisible:
      existing?.is_visible ?? true,
  };
}

export function WebsitePageEditorPage() {
  const { pageKey } = useParams();
  const page = getCmsPage(pageKey);
  const queryClient = useQueryClient();

  const [editingKey, setEditingKey] =
    useState<string | null>(null);
  const [form, setForm] =
    useState<EditorForm | null>(null);

  const sectionsQuery = useQuery({
    queryKey: ["landing-sections"],
    queryFn: fetchSections,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      definition,
      existing,
      values,
      order,
    }: {
      definition: CmsSectionDefinition;
      existing?: LandingSection;
      values: EditorForm;
      order: number;
    }) => {
      const payload = {
        key: definition.key,
        title: values.title.trim(),
        eyebrow: nullable(values.eyebrow),
        body: nullable(values.body),
        cta_label: nullable(values.ctaLabel),
        cta_url: nullable(values.ctaUrl),
        image_url: values.imageAssetId
          ? null
          : nullable(values.imageUrl),
        image_asset_id: values.imageAssetId,
        sort_order: order,
        is_visible: values.isVisible,
      };

      if (existing) {
        const response =
          await apiClient.patch<LandingSection>(
            `/landing-sections/${existing.id}`,
            payload,
          );
        return response.data;
      }

      const response =
        await apiClient.post<LandingSection>(
          "/landing-sections",
          payload,
        );

      return response.data;
    },
    onSuccess: () => {
      setEditingKey(null);
      setForm(null);

      queryClient.invalidateQueries({
        queryKey: ["landing-sections"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-media"],
      });
      queryClient.invalidateQueries({
        queryKey: ["public-landing-sections"],
      });
      queryClient.invalidateQueries({
        queryKey: ["public-contact-sections"],
      });
    },
  });

  if (!page) {
    return (
      <Navigate
        to="/dashboard/content"
        replace
      />
    );
  }

  const sections =
    sectionsQuery.data ?? [];

  function existingFor(
    definition: CmsSectionDefinition,
  ) {
    return sections.find(
      (section) =>
        section.key === definition.key,
    );
  }

  function openEditor(
    definition: CmsSectionDefinition,
  ) {
    if (editingKey === definition.key) {
      setEditingKey(null);
      setForm(null);
      return;
    }

    const existing =
      existingFor(definition);

    setEditingKey(definition.key);
    setForm(
      formFromDefinition(
        definition,
        existing,
      ),
    );
  }

  function save(
    event: FormEvent,
    definition: CmsSectionDefinition,
    order: number,
  ) {
    event.preventDefault();

    if (!form) return;

    saveMutation.mutate({
      definition,
      existing:
        existingFor(definition),
      values: form,
      order,
    });
  }

  const showState =
    sectionsQuery.isLoading ||
    sectionsQuery.isError;

  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/dashboard/content"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Website Content
        </Link>

        <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Website page
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-950">
              {page.label}
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {page.description}
            </p>
          </div>

          <a
            href={page.publicPath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            View public page
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </header>

      {showState ? (
        <DataState
          isLoading={sectionsQuery.isLoading}
          isError={sectionsQuery.isError}
          empty={false}
        />
      ) : (
        <div className="space-y-4">
          {page.sections.map(
            (definition, index) => {
              const existing =
                existingFor(definition);
              const isOpen =
                editingKey ===
                definition.key;
              const status =
                existing
                  ? existing.is_visible
                    ? "Visible"
                    : "Hidden"
                  : "Using website default";

              return (
                <article
                  key={definition.key}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() =>
                      openEditor(
                        definition,
                      )
                    }
                    className="flex w-full items-center justify-between gap-5 p-5 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {index + 1}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-slate-950">
                            {definition.label}
                          </h2>

                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {status}
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {
                            definition.description
                          }
                        </p>
                      </div>
                    </div>

                    {isOpen ? (
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                    )}
                  </button>

                  {isOpen && form ? (
                    <form
                      onSubmit={(event) =>
                        save(
                          event,
                          definition,
                          index + 1,
                        )
                      }
                      className="border-t border-slate-100 bg-slate-50/60 p-5 md:p-6"
                    >
                      {definition.note ? (
                        <div className="mb-5 flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          <Info className="mt-0.5 h-4 w-4 shrink-0" />
                          <p>
                            {
                              definition.note
                            }
                          </p>
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-2">
                        {definition.fields.includes(
                          "eyebrow",
                        ) ? (
                          <Input
                            label="Small heading"
                            value={
                              form.eyebrow
                            }
                            onChange={(
                              event,
                            ) =>
                              setForm({
                                ...form,
                                eyebrow:
                                  event
                                    .target
                                    .value,
                              })
                            }
                          />
                        ) : null}

                        {definition.fields.includes(
                          "title",
                        ) ? (
                          <Input
                            label={
                              definition.titleLabel ??
                              "Heading"
                            }
                            value={
                              form.title
                            }
                            onChange={(
                              event,
                            ) =>
                              setForm({
                                ...form,
                                title:
                                  event
                                    .target
                                    .value,
                              })
                            }
                            required
                          />
                        ) : null}

                        {definition.fields.includes(
                          "cta",
                        ) ? (
                          <>
                            <Input
                              label="Button text"
                              value={
                                form.ctaLabel
                              }
                              onChange={(
                                event,
                              ) =>
                                setForm({
                                  ...form,
                                  ctaLabel:
                                    event
                                      .target
                                      .value,
                                })
                              }
                            />

                            <Input
                              label="Button destination"
                              value={
                                form.ctaUrl
                              }
                              onChange={(
                                event,
                              ) =>
                                setForm({
                                  ...form,
                                  ctaUrl:
                                    event
                                      .target
                                      .value,
                                })
                              }
                            />
                          </>
                        ) : null}
                      </div>

                      {definition.fields.includes(
                        "image",
                      ) ? (
                        <div className="mt-5">
                          <ManagedImageAssetPicker
                            label="Section image"
                            purpose="landing_section_image"
                            selectedAssetId={
                              form.imageAssetId
                            }
                            legacyUrl={
                              form.imageUrl ||
                              null
                            }
                            scope="admin"
                            disabled={
                              saveMutation.isPending
                            }
                            onChange={(
                              assetId,
                            ) =>
                              setForm({
                                ...form,
                                imageAssetId:
                                  assetId,
                                imageUrl: "",
                              })
                            }
                          />
                        </div>
                      ) : null}

                      {definition.fields.includes(
                        "body",
                      ) ? (
                        <label className="mt-5 block space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            Supporting text
                          </span>

                          <textarea
                            value={
                              form.body
                            }
                            onChange={(
                              event,
                            ) =>
                              setForm({
                                ...form,
                                body:
                                  event
                                    .target
                                    .value,
                              })
                            }
                            className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                          />
                        </label>
                      ) : null}

                      <label className="mt-5 flex items-center gap-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={
                            form.isVisible
                          }
                          onChange={(
                            event,
                          ) =>
                            setForm({
                              ...form,
                              isVisible:
                                event
                                  .target
                                  .checked,
                            })
                          }
                        />

                        Show this section on the public page
                      </label>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                          type="submit"
                          disabled={
                            saveMutation.isPending
                          }
                        >
                          {saveMutation.isPending
                            ? "Saving..."
                            : "Save changes"}
                        </Button>

                        <Button
                          type="button"
                          onClick={() => {
                            setEditingKey(
                              null,
                            );
                            setForm(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>

                      {saveMutation.isError ? (
                        <p className="mt-4 text-sm font-medium text-red-700">
                          The section could not be saved. Check the fields and try again.
                        </p>
                      ) : null}
                    </form>
                  ) : null}
                </article>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
