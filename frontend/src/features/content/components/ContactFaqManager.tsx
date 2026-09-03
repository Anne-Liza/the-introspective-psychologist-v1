import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
} from "lucide-react";
import { useState } from "react";

import { Input } from "../../../components/ui/Input";
import { apiClient } from "../../../lib/api-client";

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

async function fetchSections() {
  const response =
    await apiClient.get<LandingSection[]>(
      "/landing-sections",
    );

  return response.data;
}

export function ContactFaqManager() {
  const queryClient = useQueryClient();

  const [showForm, setShowForm] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [question, setQuestion] =
    useState("");

  const [answer, setAnswer] =
    useState("");

  const sectionsQuery = useQuery({
    queryKey: ["landing-sections"],
    queryFn: fetchSections,
  });

  const faqs = (
    sectionsQuery.data ?? []
  )
    .filter((section) =>
      section.key.startsWith(
        "contact.faq.",
      ),
    )
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order,
    );

  function refresh() {
    queryClient.invalidateQueries({
      queryKey: ["landing-sections"],
    });

    queryClient.invalidateQueries({
      queryKey: [
        "public-contact-sections",
      ],
    });

    queryClient.invalidateQueries({
      queryKey: [
        "public-landing-sections",
      ],
    });
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setQuestion("");
    setAnswer("");
  }

  const saveMutation = useMutation({
    mutationFn: async ({
      publish,
    }: {
      publish?: boolean;
    }) => {
      const title = question.trim();
      const body = answer.trim();

      if (!title || !body) {
        throw new Error(
          "Question and answer are required.",
        );
      }

      if (editingId) {
        return apiClient.patch(
          `/landing-sections/${editingId}`,
          {
            title,
            body,
          },
        );
      }

      return apiClient.post(
        "/landing-sections",
        {
          key:
            `contact.faq.${crypto.randomUUID()}`,
          title,
          eyebrow: "FAQ",
          body,
          cta_label: null,
          cta_url: null,
          image_url: null,
          image_asset_id: null,
          sort_order:
            100 + faqs.length,
          is_visible:
            publish ?? false,
        },
      );
    },
    onSuccess: () => {
      resetForm();
      refresh();
    },
  });

  const visibilityMutation =
    useMutation({
      mutationFn: async (
        faq: LandingSection,
      ) => {
        await apiClient.patch(
          `/landing-sections/${faq.id}`,
          {
            is_visible:
              !faq.is_visible,
          },
        );
      },
      onSuccess: refresh,
    });

  const reorderMutation =
    useMutation({
      mutationFn: async ({
        index,
        direction,
      }: {
        index: number;
        direction: -1 | 1;
      }) => {
        const target =
          index + direction;

        if (
          target < 0 ||
          target >= faqs.length
        ) {
          return;
        }

        const reordered = [...faqs];

        [
          reordered[index],
          reordered[target],
        ] = [
          reordered[target],
          reordered[index],
        ];

        await Promise.all(
          reordered.map(
            (faq, faqIndex) =>
              apiClient.patch(
                `/landing-sections/${faq.id}`,
                {
                  sort_order:
                    100 + faqIndex,
                },
              ),
          ),
        );
      },
      onSuccess: refresh,
    });

  function startAdd() {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
    setShowForm(true);
  }

  function startEdit(
    faq: LandingSection,
  ) {
    setEditingId(faq.id);
    setQuestion(faq.title);
    setAnswer(faq.body ?? "");
    setShowForm(true);
  }

  const busy =
    saveMutation.isPending ||
    visibilityMutation.isPending ||
    reorderMutation.isPending;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold text-slate-950">
            Frequently asked questions
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            Create, edit, reorder, publish or
            unpublish public questions.
          </p>
        </div>

        <button
          type="button"
          onClick={startAdd}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add question
        </button>
      </div>

      {faqs.length ? (
        <div className="border-t border-slate-100">
          {faqs.map(
            (faq, index) => (
              <div
                key={faq.id}
                className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 last:border-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">
                      {faq.title}
                    </p>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {faq.is_visible
                        ? "Published"
                        : "Unpublished"}
                    </span>
                  </div>

                  {faq.body ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {faq.body}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      busy ||
                      index === 0
                    }
                    onClick={() =>
                      reorderMutation.mutate({
                        index,
                        direction: -1,
                      })
                    }
                    aria-label="Move question up"
                    className="rounded-full border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    disabled={
                      busy ||
                      index ===
                        faqs.length - 1
                    }
                    onClick={() =>
                      reorderMutation.mutate({
                        index,
                        direction: 1,
                      })
                    }
                    aria-label="Move question down"
                    className="rounded-full border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      startEdit(faq)
                    }
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      visibilityMutation.mutate(
                        faq,
                      )
                    }
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    {faq.is_visible ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Unpublish
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Publish
                      </>
                    )}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="border-t border-slate-100 p-5 text-sm text-slate-600">
          No FAQs yet.
        </div>
      )}

      {showForm ? (
        <div className="border-t border-slate-100 bg-slate-50/70 p-5">
          <div className="grid gap-4">
            <Input
              label="Question"
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value,
                )
              }
              required
            />

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Answer
              </span>

              <textarea
                value={answer}
                onChange={(event) =>
                  setAnswer(
                    event.target.value,
                  )
                }
                className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {editingId ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  saveMutation.mutate({})
                }
                className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saveMutation.isPending
                  ? "Saving..."
                  : "Save changes"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    saveMutation.mutate({
                      publish: false,
                    })
                  }
                  className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  Save unpublished
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    saveMutation.mutate({
                      publish: true,
                    })
                  }
                  className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Publish now
                </button>
              </>
            )}

            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
          </div>

          {saveMutation.isError ? (
            <p className="mt-4 text-sm text-red-700">
              Question and answer are required.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
