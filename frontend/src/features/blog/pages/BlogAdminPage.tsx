import {
  useMemo,
  useState,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ExternalLink,
  Pencil,
  Plus,
} from "lucide-react";

import { FilterSelect } from "../../../components/data/FilterSelect";
import { SearchField } from "../../../components/data/SearchField";
import { StatusBadge } from "../../../components/data/StatusBadge";
import { TableToolbar } from "../../../components/data/TableToolbar";
import { Button } from "../../../components/ui/Button";
import { Textarea } from "../../../components/ui/Textarea";
import { useAuth } from "../../auth/context/AuthContext";
import { BlogArticleEditor } from "../components/BlogArticleEditor";
import { MarkdownContent } from "../components/MarkdownContent";
import {
  BlogAdminReview,
  BlogContentType,
  BlogDraftPayload,
  BlogReviewDecision,
  BlogReviewStatus,
  BlogRevision,
  BlogWorkflowPost,
  createAdminBlogPost,
  fetchAdminBlogPosts,
  fetchBlogPublicationQueue,
  fetchBlogReviewQueue,
  fetchBlogRevision,
  publishBlogRevision,
  reviewBlogRevision,
  submitAdminBlogPost,
  updateAdminBlogPost,
} from "../lib/blogApi";


type WorkspaceView =
  | "all"
  | "review"
  | "ready"
  | "published";

type SortValue =
  | "updated_desc"
  | "newest"
  | "oldest"
  | "title"
  | "published_desc";

type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";


const ADMIN_PAGE_SIZE = 20;


const CONTENT_TYPE_LABELS: Record<
  BlogContentType,
  string
> = {
  article: "Article",
  editorial: "Editorial",
  external_coverage: "External coverage",
  external_article: "External article",
  licensed_republication: "Licensed republication",
};


function formatDate(
  value: string | null | undefined,
) {
  if (!value) return "Not yet";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  ).format(date);
}


function activeRevision(
  post: BlogWorkflowPost,
): BlogRevision | null {
  return (
    post.working_revision ??
    post.current_publication
  );
}


function effectiveStatus(
  post: BlogWorkflowPost,
): BlogReviewStatus | "published" {
  if (post.working_revision) {
    return post.working_revision.review_status;
  }

  if (post.status === "published") {
    return "published";
  }

  return "draft";
}


function statusLabel(
  value: BlogReviewStatus | "published",
) {
  switch (value) {
    case "draft":
      return "Draft";
    case "pending_review":
      return "In review";
    case "changes_requested":
      return "Changes requested";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "published":
      return "Published";
  }
}


function statusTone(
  value: BlogReviewStatus | "published",
): StatusTone {
  switch (value) {
    case "published":
    case "approved":
      return "success";

    case "pending_review":
      return "info";

    case "changes_requested":
      return "warning";

    case "rejected":
      return "danger";

    default:
      return "neutral";
  }
}


function contentTypeLabel(
  value: BlogContentType,
) {
  return CONTENT_TYPE_LABELS[value];
}


function isPracticeEditable(
  post: BlogWorkflowPost,
) {
  if (post.therapist_profile_id) {
    return false;
  }

  if (!post.working_revision) {
    return true;
  }

  return [
    "draft",
    "changes_requested",
  ].includes(
    post.working_revision.review_status,
  );
}


function matchesSearch(
  post: BlogWorkflowPost,
  search: string,
) {
  if (!search.trim()) {
    return true;
  }

  const revision = activeRevision(post);

  const haystack = [
    post.title,
    post.author_name,
    post.slug,
    post.content_type,
    revision?.category,
    revision?.source_name,
    revision?.source_author,
    ...(revision?.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(
    search.trim().toLowerCase(),
  );
}


function queueMatchesSearch(
  item: BlogAdminReview,
  search: string,
) {
  if (!search.trim()) {
    return true;
  }

  const revision = item.revision;

  const haystack = [
    revision.title,
    revision.author_name,
    revision.category,
    revision.source_name,
    revision.source_author,
    revision.content_type,
    ...(revision.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(
    search.trim().toLowerCase(),
  );
}


function SummaryCard({
  label,
  count,
  description,
  active,
  onClick,
}: {
  label: string;
  count: number;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? `
            rounded-2xl border border-[#899979]
            bg-[#eef2e7] p-5 text-left
            shadow-sm transition
          `
          : `
            rounded-2xl border border-[#dfe5d6]
            bg-white p-5 text-left
            shadow-sm transition
            hover:border-[#b9c4ae]
            hover:bg-[#fbfcf9]
          `
      }
    >
      <p
        className="
          text-xs font-bold uppercase
          tracking-[0.18em]
          text-[#718064]
        "
      >
        {label}
      </p>

      <p
        className="
          mt-3 font-serif text-4xl
          text-[#26311f]
        "
      >
        {count}
      </p>

      <p
        className="
          mt-2 text-sm leading-5
          text-slate-500
        "
      >
        {description}
      </p>
    </button>
  );
}


function PaginationControls({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div
      className="
        flex flex-col gap-3
        rounded-2xl
        border border-[#dfe5d6]
        bg-white px-4 py-3
        shadow-sm
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >
      <p className="text-sm text-slate-500">
        Page{" "}
        <span className="font-semibold text-slate-800">
          {page}
        </span>
        {" of "}
        <span className="font-semibold text-slate-800">
          {pageCount}
        </span>
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={page <= 1}
          onClick={() =>
            onPageChange(page - 1)
          }
        >
          Previous
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() =>
            onPageChange(page + 1)
          }
        >
          Next
        </Button>
      </div>
    </div>
  );
}


function ReviewPanel({
  item,
  notes,
  onNotesChange,
  onClose,
  onReview,
  pending,
  error,
  readOnly = false,
}: {
  item: BlogAdminReview;
  notes: string;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onReview: (
    decision: BlogReviewDecision,
  ) => void;
  pending: boolean;
  error: boolean;
  readOnly?: boolean;
}) {
  const revision = item.revision;

  return (
    <section
      className="
        rounded-[2rem]
        border border-[#d6ddce]
        bg-white shadow-sm
      "
    >
      <div
        className="
          flex flex-col gap-4
          border-b border-[#e7eadf]
          p-6
          sm:flex-row
          sm:items-start
          sm:justify-between
          lg:p-8
        "
      >
        <div>
          <p
            className="
              text-xs font-bold uppercase
              tracking-[0.2em]
              text-[#718064]
            "
          >
            Editorial review
          </p>

          <h3
            className="
              mt-2 font-serif text-3xl
              text-[#26311f]
            "
          >
            {revision.title}
          </h3>

          <div
            className="
              mt-3 flex flex-wrap
              items-center gap-2
            "
          >
            <StatusBadge
              tone={statusTone(
                revision.review_status,
              )}
            >
              {statusLabel(
                revision.review_status,
              )}
            </StatusBadge>

            <span
              className="
                text-sm text-slate-500
              "
            >
              Version {revision.version_number}
            </span>

            <span
              className="
                text-sm text-slate-500
              "
            >
              {revision.author_name ||
                "No byline"}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={pending}
        >
          Close review
        </Button>
      </div>


      <div
        className="
          grid gap-8 p-6
          lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]
          lg:p-8
        "
      >
        <div className="min-w-0">
          {revision.excerpt ? (
            <p
              className="
                text-lg leading-8
                text-[#5d6954]
              "
            >
              {revision.excerpt}
            </p>
          ) : null}

          <div className="mt-6">
            <MarkdownContent
              markdown={revision.body_markdown}
            />
          </div>
        </div>


        <aside className="space-y-5">
          <div
            className="
              rounded-2xl
              border border-slate-200
              bg-slate-50 p-5
            "
          >
            <h4
              className="
                font-semibold text-slate-950
              "
            >
              Article details
            </h4>

            <dl
              className="
                mt-4 space-y-3
                text-sm
              "
            >
              <div>
                <dt className="text-slate-500">
                  Content type
                </dt>

                <dd
                  className="
                    mt-0.5 font-medium
                    text-slate-900
                  "
                >
                  {contentTypeLabel(
                    revision.content_type,
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">
                  Category
                </dt>

                <dd
                  className="
                    mt-0.5 font-medium
                    text-slate-900
                  "
                >
                  {revision.category ||
                    "Uncategorised"}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">
                  Submitted
                </dt>

                <dd
                  className="
                    mt-0.5 font-medium
                    text-slate-900
                  "
                >
                  {formatDate(
                    revision.submitted_at,
                  )}
                </dd>
              </div>

              {revision.source_name ? (
                <div>
                  <dt className="text-slate-500">
                    Source
                  </dt>

                  <dd
                    className="
                      mt-0.5 font-medium
                      text-slate-900
                    "
                  >
                    {revision.source_name}
                  </dd>
                </div>
              ) : null}

              {revision.external_url ? (
                <div>
                  <dt className="text-slate-500">
                    Original article
                  </dt>

                  <dd className="mt-1">
                    <a
                      href={revision.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="
                        inline-flex items-center
                        gap-1.5 font-semibold
                        text-[#56684b]
                        hover:underline
                      "
                    >
                      Open source
                      <ExternalLink
                        className="h-3.5 w-3.5"
                      />
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>


          {item.history.length ? (
            <div
              className="
                rounded-2xl
                border border-slate-200
                p-5
              "
            >
              <h4
                className="
                  font-semibold text-slate-950
                "
              >
                Review history
              </h4>

              <div className="mt-4 space-y-4">
                {item.history.map(
                  (event) => (
                    <div
                      key={event.id}
                      className="
                        border-l-2
                        border-[#cfd8c7]
                        pl-3
                      "
                    >
                      <p
                        className="
                          text-sm font-semibold
                          capitalize
                          text-slate-800
                        "
                      >
                        {event.action.replace(
                          /_/g,
                          " ",
                        )}
                      </p>

                      <p
                        className="
                          mt-0.5 text-xs
                          text-slate-500
                        "
                      >
                        {formatDate(
                          event.created_at,
                        )}
                      </p>

                      {event.note ? (
                        <p
                          className="
                            mt-2 text-sm
                            leading-6
                            text-slate-600
                          "
                        >
                          {event.note}
                        </p>
                      ) : null}
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : null}


          {revision.review_notes ? (
            <div
              className="
                rounded-2xl
                border border-amber-200
                bg-amber-50
                p-5
              "
            >
              <p
                className="
                  text-xs font-bold uppercase
                  tracking-[0.16em]
                  text-amber-700
                "
              >
                Reviewer note
              </p>

              <p
                className="
                  mt-2 text-sm leading-6
                  text-amber-950
                "
              >
                {revision.review_notes}
              </p>
            </div>
          ) : null}

          {!readOnly ? (
            <>
              <Textarea
            label="Editorial notes"
            value={notes}
            onChange={(event) =>
              onNotesChange(
                event.target.value,
              )
            }
            rows={5}
            placeholder="Explain requested edits or the reason for rejection."
          />

          <p
            className="
              text-xs leading-5
              text-slate-500
            "
          >
            Notes are required when requesting
            changes or rejecting an article.
            Approval may be recorded without a note.
          </p>

          <div className="grid gap-2">
            <Button
              type="button"
              variant="warning"
              disabled={
                pending ||
                !notes.trim()
              }
              onClick={() =>
                onReview(
                  "changes_requested",
                )
              }
            >
              Request changes
            </Button>

            <Button
              type="button"
              variant="danger"
              disabled={
                pending ||
                !notes.trim()
              }
              onClick={() =>
                onReview("rejected")
              }
            >
              Reject article
            </Button>

            <Button
              type="button"
              variant="success"
              disabled={pending}
              onClick={() =>
                onReview("approved")
              }
            >
              Approve article
            </Button>
          </div>

            </>
          ) : (
            <div
              className="
                rounded-xl
                border border-slate-200
                bg-slate-50
                px-4 py-3
                text-sm leading-6
                text-slate-600
              "
            >
              This revision is read-only.
              Its editorial decision and history
              remain available for reference.
            </div>
          )}

          {error && !readOnly ? (
            <p
              className="
                rounded-xl
                border border-red-200
                bg-red-50
                px-4 py-3
                text-sm text-red-700
              "
            >
              The editorial decision could not
              be saved.
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}


export function BlogAdminPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const canReview =
    hasPermission("blog.review");

  const canPublish =
    hasPermission("blog.publish");

  const [view, setView] =
    useState<WorkspaceView>("all");

  const [page, setPage] =
    useState(1);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [
    contentTypeFilter,
    setContentTypeFilter,
  ] = useState("all");

  const [authorFilter, setAuthorFilter] =
    useState("all");

  const [sort, setSort] =
    useState<SortValue>("updated_desc");

  const [editorOpen, setEditorOpen] =
    useState(false);

  const [editorPost, setEditorPost] =
    useState<BlogWorkflowPost | null>(
      null,
    );

  const [
    selectedReview,
    setSelectedReview,
  ] = useState<BlogAdminReview | null>(
    null,
  );

  const [reviewNotes, setReviewNotes] =
    useState("");

  const [
    selectedReviewReadOnly,
    setSelectedReviewReadOnly,
  ] = useState(false);


  const {
    data: posts = [],
    isLoading: postsLoading,
    isError: postsError,
  } = useQuery({
    queryKey: ["blog-admin-posts"],
    queryFn: fetchAdminBlogPosts,
  });


  const {
    data: reviewQueue = [],
    isLoading: reviewLoading,
    isError: reviewError,
  } = useQuery({
    queryKey: ["blog-review-queue"],
    queryFn: fetchBlogReviewQueue,
    enabled: canReview,
  });


  const {
    data: publicationQueue = [],
    isLoading: publicationLoading,
    isError: publicationError,
  } = useQuery({
    queryKey: [
      "blog-publication-queue",
    ],
    queryFn: fetchBlogPublicationQueue,
    enabled: canPublish,
  });


  function refreshWorkspace() {
    queryClient.invalidateQueries({
      queryKey: ["blog-admin-posts"],
    });

    queryClient.invalidateQueries({
      queryKey: ["blog-review-queue"],
    });

    queryClient.invalidateQueries({
      queryKey: [
        "blog-publication-queue",
      ],
    });

    queryClient.invalidateQueries({
      queryKey: ["public-blog-posts"],
    });
  }


  const saveMutation = useMutation({
    mutationFn: async ({
      payload,
      submitAfterSave,
    }: {
      payload: BlogDraftPayload;
      submitAfterSave: boolean;
    }) => {
      let saved: BlogWorkflowPost;

      if (editorPost) {
        saved =
          await updateAdminBlogPost({
            postId: editorPost.id,
            data: payload,
          });
      } else {
        saved =
          await createAdminBlogPost(
            payload,
          );
      }

      if (submitAfterSave) {
        saved =
          await submitAdminBlogPost(
            saved.id,
          );
      }

      return saved;
    },

    onSuccess: () => {
      refreshWorkspace();
      setEditorOpen(false);
      setEditorPost(null);
    },
  });


  const reviewMutation = useMutation({
    mutationFn: ({
      revisionId,
      decision,
      notes,
    }: {
      revisionId: string;
      decision: BlogReviewDecision;
      notes: string;
    }) =>
      reviewBlogRevision({
        revisionId,
        decision,
        notes,
      }),

    onSuccess: () => {
      refreshWorkspace();
      setSelectedReview(null);
      setSelectedReviewReadOnly(false);
      setReviewNotes("");
    },
  });


  const inspectRevisionMutation =
    useMutation({
      mutationFn: fetchBlogRevision,

      onSuccess: (item) => {
        setSelectedReview(item);
        setSelectedReviewReadOnly(true);
        setReviewNotes("");
        setEditorOpen(false);

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      },
    });


  const publishMutation = useMutation({
    mutationFn: publishBlogRevision,

    onSuccess: () => {
      refreshWorkspace();
    },
  });


  const authorOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        posts
          .map(
            (post) =>
              activeRevision(post)
                ?.author_name ??
              post.author_name,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),
      ),
    ).sort((a, b) =>
      a.localeCompare(b),
    );

    return [
      {
        value: "all",
        label: "All authors",
      },
      ...names.map((name) => ({
        value: name,
        label: name,
      })),
    ];
  }, [posts]);


  const filteredPosts = useMemo(() => {
    const result = posts.filter(
      (post) => {
        if (
          view === "published" &&
          post.status !== "published"
        ) {
          return false;
        }

        if (
          !matchesSearch(
            post,
            search,
          )
        ) {
          return false;
        }

        const status =
          effectiveStatus(post);

        if (
          statusFilter !== "all" &&
          status !== statusFilter
        ) {
          return false;
        }

        const revision =
          activeRevision(post);

        const contentType =
          revision?.content_type ??
          post.content_type;

        if (
          contentTypeFilter !== "all" &&
          contentType !==
            contentTypeFilter
        ) {
          return false;
        }

        const author =
          revision?.author_name ??
          post.author_name ??
          "";

        if (
          authorFilter !== "all" &&
          author !== authorFilter
        ) {
          return false;
        }

        return true;
      },
    );

    return result.sort((a, b) => {
      switch (sort) {
        case "newest":
          return (
            new Date(
              b.created_at,
            ).getTime() -
            new Date(
              a.created_at,
            ).getTime()
          );

        case "oldest":
          return (
            new Date(
              a.created_at,
            ).getTime() -
            new Date(
              b.created_at,
            ).getTime()
          );

        case "title":
          return a.title.localeCompare(
            b.title,
          );

        case "published_desc":
          return (
            new Date(
              b.published_at ?? 0,
            ).getTime() -
            new Date(
              a.published_at ?? 0,
            ).getTime()
          );

        default:
          return (
            new Date(
              b.updated_at,
            ).getTime() -
            new Date(
              a.updated_at,
            ).getTime()
          );
      }
    });
  }, [
    posts,
    view,
    search,
    statusFilter,
    contentTypeFilter,
    authorFilter,
    sort,
  ]);


  const filteredReviewQueue =
    useMemo(
      () =>
        reviewQueue.filter(
          (item) =>
            queueMatchesSearch(
              item,
              search,
            ),
        ),
      [reviewQueue, search],
    );


  const filteredPublicationQueue =
    useMemo(
      () =>
        publicationQueue.filter(
          (item) =>
            queueMatchesSearch(
              item,
              search,
            ),
        ),
      [publicationQueue, search],
    );


  const postPageCount = Math.max(
    1,
    Math.ceil(
      filteredPosts.length /
        ADMIN_PAGE_SIZE,
    ),
  );

  const reviewPageCount = Math.max(
    1,
    Math.ceil(
      filteredReviewQueue.length /
        ADMIN_PAGE_SIZE,
    ),
  );

  const publicationPageCount = Math.max(
    1,
    Math.ceil(
      filteredPublicationQueue.length /
        ADMIN_PAGE_SIZE,
    ),
  );

  const currentPageCount =
    view === "review"
      ? reviewPageCount
      : view === "ready"
        ? publicationPageCount
        : postPageCount;

  const currentPage = Math.min(
    page,
    currentPageCount,
  );

  const pageStart =
    (currentPage - 1) *
    ADMIN_PAGE_SIZE;

  const paginatedPosts =
    filteredPosts.slice(
      pageStart,
      pageStart + ADMIN_PAGE_SIZE,
    );

  const paginatedReviewQueue =
    filteredReviewQueue.slice(
      pageStart,
      pageStart + ADMIN_PAGE_SIZE,
    );

  const paginatedPublicationQueue =
    filteredPublicationQueue.slice(
      pageStart,
      pageStart + ADMIN_PAGE_SIZE,
    );


  const publishedCount =
    posts.filter(
      (post) =>
        post.status === "published",
    ).length;


  const hasActiveFilters =
    Boolean(search) ||
    statusFilter !== "all" ||
    contentTypeFilter !== "all" ||
    authorFilter !== "all" ||
    sort !== "updated_desc";


  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setContentTypeFilter("all");
    setAuthorFilter("all");
    setSort("updated_desc");
    setPage(1);
  }


  function openNewArticle() {
    setEditorPost(null);
    setEditorOpen(true);
    setSelectedReview(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  function openEdit(
    post: BlogWorkflowPost,
  ) {
    setEditorPost(post);
    setEditorOpen(true);
    setSelectedReview(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  function openReview(
    item: BlogAdminReview,
  ) {
    setSelectedReview(item);
    setSelectedReviewReadOnly(false);
    setReviewNotes("");
    setEditorOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  const editorRevision =
    editorPost
      ? activeRevision(editorPost)
      : null;


  return (
    <div className="space-y-7">
      <header
        className="
          flex flex-col gap-5
          xl:flex-row
          xl:items-end
          xl:justify-between
        "
      >
        <div>
          <p
            className="
              text-sm font-semibold
              uppercase
              tracking-[0.2em]
              text-[#6a7a4e]
            "
          >
            Publishing
          </p>

          <h2
            className="
              mt-2 font-serif
              text-4xl font-semibold
              text-[#26311f]
            "
          >
            Blog
          </h2>

          <p
            className="
              mt-2 max-w-3xl
              text-slate-600
            "
          >
            Manage platform articles,
            provider submissions, editorial
            review and publication from one
            workspace.
          </p>
        </div>

        <Button
          type="button"
          onClick={openNewArticle}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New article
        </Button>
      </header>


      {editorOpen ? (
        <BlogArticleEditor
          key={
            editorRevision?.id ??
            "new-admin-article"
          }
          revision={editorRevision}
          publicSlug={
            editorPost?.slug ?? null
          }
          mode={
            editorPost
              ? "edit"
              : "create"
          }
          saving={
            saveMutation.isPending
          }
          submitting={
            saveMutation.isPending
          }
          errorMessage={
            saveMutation.isError
              ? (
                "The article could not be saved. " +
                "Check the required fields and try again."
              )
              : null
          }
          onCancel={() => {
            setEditorOpen(false);
            setEditorPost(null);
          }}
          onSave={(
            payload,
            submitAfterSave,
          ) =>
            saveMutation.mutate({
              payload,
              submitAfterSave,
            })
          }
        />
      ) : null}


      {selectedReview ? (
        <ReviewPanel
          item={selectedReview}
          notes={reviewNotes}
          onNotesChange={setReviewNotes}
          onClose={() => {
            setSelectedReview(null);
            setSelectedReviewReadOnly(false);
            setReviewNotes("");
          }}
          pending={
            reviewMutation.isPending
          }
          error={
            reviewMutation.isError
          }
          readOnly={
            selectedReviewReadOnly
          }
          onReview={(decision) =>
            reviewMutation.mutate({
              revisionId:
                selectedReview
                  .revision.id,
              decision,
              notes: reviewNotes,
            })
          }
        />
      ) : null}


      <section
        className="
          grid gap-4
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >
        <SummaryCard
          label="All articles"
          count={posts.length}
          description="Drafts, reviews and live articles."
          active={view === "all"}
          onClick={() =>
            setView("all")
          }
        />

        <SummaryCard
          label="Needs review"
          count={reviewQueue.length}
          description="Submitted articles awaiting a decision."
          active={view === "review"}
          onClick={() =>
            setView("review")
          }
        />

        <SummaryCard
          label="Ready to publish"
          count={publicationQueue.length}
          description="Approved articles waiting to go live."
          active={view === "ready"}
          onClick={() =>
            setView("ready")
          }
        />

        <SummaryCard
          label="Published"
          count={publishedCount}
          description="Articles currently visible on the website."
          active={view === "published"}
          onClick={() =>
            setView("published")
          }
        />
      </section>


      {view === "all" ||
      view === "published" ? (
        <TableToolbar
          resultCount={
            filteredPosts.length
          }
          totalCount={posts.length}
          resultLabel="article"
          hasActiveFilters={
            hasActiveFilters
          }
          onClear={clearFilters}
        >
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search title, author, source, category or tag"
            label="Search articles"
          />

          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            label="Status"
            options={[
              {
                value: "all",
                label: "All statuses",
              },
              {
                value: "draft",
                label: "Draft",
              },
              {
                value: "pending_review",
                label: "In review",
              },
              {
                value: "changes_requested",
                label: "Changes requested",
              },
              {
                value: "approved",
                label: "Approved",
              },
              {
                value: "published",
                label: "Published",
              },
              {
                value: "rejected",
                label: "Rejected",
              },
            ]}
          />

          <FilterSelect
            value={contentTypeFilter}
            onChange={
              setContentTypeFilter
            }
            label="Content type"
            options={[
              {
                value: "all",
                label: "All content types",
              },
              ...Object.entries(
                CONTENT_TYPE_LABELS,
              ).map(
                ([value, label]) => ({
                  value,
                  label,
                }),
              ),
            ]}
          />

          <FilterSelect
            value={authorFilter}
            onChange={setAuthorFilter}
            label="Author"
            options={authorOptions}
          />

          <FilterSelect
            value={sort}
            onChange={(value) =>
              setSort(
                value as SortValue,
              )
            }
            label="Sort"
            options={[
              {
                value: "updated_desc",
                label: "Recently updated",
              },
              {
                value: "newest",
                label: "Newest first",
              },
              {
                value: "oldest",
                label: "Oldest first",
              },
              {
                value: "published_desc",
                label: "Recently published",
              },
              {
                value: "title",
                label: "Title A–Z",
              },
            ]}
          />
        </TableToolbar>
      ) : (
        <TableToolbar
          resultCount={
            view === "review"
              ? filteredReviewQueue.length
              : filteredPublicationQueue.length
          }
          totalCount={
            view === "review"
              ? reviewQueue.length
              : publicationQueue.length
          }
          resultLabel="article"
          hasActiveFilters={
            Boolean(search)
          }
          onClear={() =>
            setSearch("")
          }
        >
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search queue"
            label="Search queue"
          />
        </TableToolbar>
      )}


      {view === "all" ||
      view === "published" ? (
        <section
          className="
            overflow-hidden
            rounded-[2rem]
            border border-[#dfe5d6]
            bg-white
            shadow-sm
          "
        >
          <div
            className="
              flex items-center
              justify-between gap-4
              border-b border-[#e7eadf]
              px-5 py-4
              lg:px-6
            "
          >
            <div>
              <h3
                className="
                  text-lg font-semibold
                  text-slate-950
                "
              >
                {view === "published"
                  ? "Published articles"
                  : "All articles"}
              </h3>

              <p
                className="
                  mt-0.5 text-sm
                  text-slate-500
                "
              >
                Editorial state and live
                publication are tracked
                separately.
              </p>
            </div>
          </div>


          {postsLoading ? (
            <p
              className="
                p-6 text-sm
                text-slate-500
              "
            >
              Loading articles…
            </p>
          ) : null}

          {postsError ? (
            <p
              className="
                m-6 rounded-xl
                border border-red-200
                bg-red-50
                p-4 text-sm
                text-red-700
              "
            >
              Articles could not be loaded.
            </p>
          ) : null}

          {!postsLoading &&
          !postsError &&
          !filteredPosts.length ? (
            <div
              className="
                p-10 text-center
              "
            >
              <h4
                className="
                  font-serif text-2xl
                  text-[#26311f]
                "
              >
                No articles match this view.
              </h4>

              <p
                className="
                  mt-2 text-sm
                  text-slate-500
                "
              >
                Adjust the filters or create
                a new article.
              </p>
            </div>
          ) : null}


          {filteredPosts.length ? (
            <>
              <div
                className="
                  hidden grid-cols-[minmax(0,2fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_8rem_10rem]
                  gap-4
                  border-b border-slate-100
                  bg-slate-50
                  px-6 py-3
                  text-xs font-bold
                  uppercase
                  tracking-[0.12em]
                  text-slate-500
                  lg:grid
                "
              >
                <span>Article</span>
                <span>Author</span>
                <span>Status</span>
                <span>Updated</span>
                <span>Actions</span>
              </div>

              <div>
                {paginatedPosts.map(
                  (post) => {
                    const revision =
                      activeRevision(post);

                    const state =
                      effectiveStatus(post);

                    const canEdit =
                      isPracticeEditable(
                        post,
                      );

                    const pendingReview =
                      post.working_revision
                        ?.review_status ===
                      "pending_review";

                    const readyToPublish =
                      post.working_revision
                        ?.review_status ===
                      "approved";

                    return (
                      <article
                        key={post.id}
                        className="
                          grid gap-4
                          border-b
                          border-slate-100
                          px-5 py-5
                          last:border-b-0
                          lg:grid-cols-[minmax(0,2fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_8rem_10rem]
                          lg:items-center
                          lg:px-6
                        "
                      >
                        <div className="min-w-0">
                          <div
                            className="
                              flex flex-wrap
                              items-center gap-2
                            "
                          >
                            <h4
                              className="
                                min-w-0
                                font-semibold
                                text-slate-950
                              "
                            >
                              {post.title}
                            </h4>

                            {post.therapist_profile_id ? (
                              <span
                                className="
                                  rounded-full
                                  bg-[#eef2e7]
                                  px-2 py-0.5
                                  text-[0.68rem]
                                  font-bold
                                  uppercase
                                  tracking-[0.1em]
                                  text-[#61704f]
                                "
                              >
                                Provider
                              </span>
                            ) : null}
                          </div>

                          <p
                            className="
                              mt-1 line-clamp-1
                              text-sm
                              text-slate-500
                            "
                          >
                            {contentTypeLabel(
                              revision
                                ?.content_type ??
                                post.content_type,
                            )}

                            {revision?.category
                              ? ` · ${revision.category}`
                              : ""}
                          </p>

                          {post.status ===
                          "published" ? (
                            <p
                              className="
                                mt-1 text-xs
                                text-slate-400
                              "
                            >
                              /blog/{post.slug}
                            </p>
                          ) : null}
                        </div>


                        <div
                          className="
                            text-sm
                            text-slate-600
                          "
                        >
                          <span
                            className="
                              font-medium
                              text-slate-900
                              lg:hidden
                            "
                          >
                            Author:{" "}
                          </span>

                          {revision?.author_name ||
                            post.author_name ||
                            "No byline"}
                        </div>


                        <div>
                          <StatusBadge
                            tone={
                              statusTone(state)
                            }
                          >
                            {statusLabel(state)}
                          </StatusBadge>

                          {post.status ===
                            "published" &&
                          state !==
                            "published" ? (
                            <p
                              className="
                                mt-1.5 text-xs
                                text-slate-500
                              "
                            >
                              Live version remains
                              published
                            </p>
                          ) : null}
                        </div>


                        <div
                          className="
                            text-sm
                            text-slate-500
                          "
                        >
                          {formatDate(
                            post.updated_at,
                          )}
                        </div>


                        <div
                          className="
                            flex flex-wrap
                            gap-2
                          "
                        >
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(post)
                              }
                              className="
                                inline-flex
                                items-center gap-1.5
                                rounded-lg
                                border
                                border-slate-200
                                bg-white
                                px-3 py-2
                                text-xs
                                font-semibold
                                text-slate-700
                                transition
                                hover:bg-slate-50
                              "
                            >
                              <Pencil
                                className="h-3.5 w-3.5"
                              />
                              Edit
                            </button>
                          ) : null}

                          {pendingReview &&
                          canReview ? (
                            <button
                              type="button"
                              onClick={() => {
                                const queueItem =
                                  reviewQueue.find(
                                    (item) =>
                                      item.revision
                                        .id ===
                                      post
                                        .working_revision
                                        ?.id,
                                  );

                                if (
                                  queueItem
                                ) {
                                  openReview(
                                    queueItem,
                                  );
                                }
                              }}
                              className="
                                rounded-lg
                                border
                                border-blue-200
                                bg-blue-50
                                px-3 py-2
                                text-xs
                                font-semibold
                                text-blue-700
                              "
                            >
                              Review
                            </button>
                          ) : null}

                          {readyToPublish &&
                          canPublish ? (
                            <button
                              type="button"
                              disabled={
                                publishMutation
                                  .isPending
                              }
                              onClick={() =>
                                post
                                  .working_revision &&
                                publishMutation.mutate(
                                  post
                                    .working_revision
                                    .id,
                                )
                              }
                              className="
                                rounded-lg
                                border
                                border-emerald-200
                                bg-emerald-50
                                px-3 py-2
                                text-xs
                                font-semibold
                                text-emerald-700
                                disabled:opacity-50
                              "
                            >
                              Publish
                            </button>
                          ) : null}

                          {post.working_revision &&
                          [
                            "changes_requested",
                            "rejected",
                          ].includes(
                            post.working_revision
                              .review_status,
                          ) &&
                          canReview ? (
                            <button
                              type="button"
                              disabled={
                                inspectRevisionMutation
                                  .isPending
                              }
                              onClick={() =>
                                post
                                  .working_revision &&
                                inspectRevisionMutation
                                  .mutate(
                                    post
                                      .working_revision
                                      .id,
                                  )
                              }
                              className="
                                rounded-lg
                                border
                                border-slate-200
                                bg-white
                                px-3 py-2
                                text-xs
                                font-semibold
                                text-slate-700
                                transition
                                hover:bg-slate-50
                                disabled:opacity-50
                              "
                            >
                              Details
                            </button>
                          ) : null}

                          {post.status ===
                          "published" ? (
                            <a
                              href={`/blog/${post.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="
                                inline-flex
                                items-center gap-1.5
                                rounded-lg
                                border
                                border-slate-200
                                bg-white
                                px-3 py-2
                                text-xs
                                font-semibold
                                text-slate-700
                                hover:bg-slate-50
                              "
                            >
                              View
                              <ExternalLink
                                className="h-3.5 w-3.5"
                              />
                            </a>
                          ) : null}
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </>
          ) : null}
        </section>
      ) : null}


      {(view === "all" ||
        view === "published") &&
      filteredPosts.length >
        ADMIN_PAGE_SIZE ? (
        <PaginationControls
          page={currentPage}
          pageCount={postPageCount}
          onPageChange={setPage}
        />
      ) : null}


      {view === "review" ? (
        <section className="space-y-4">
          <div>
            <h3
              className="
                text-2xl font-semibold
                text-slate-950
              "
            >
              Review queue
            </h3>

            <p
              className="
                mt-1 text-sm
                text-slate-500
              "
            >
              Submitted revisions awaiting
              an editorial decision.
            </p>
          </div>

          {reviewLoading ? (
            <p
              className="
                rounded-2xl border
                bg-white p-6
                text-sm text-slate-500
              "
            >
              Loading review queue…
            </p>
          ) : null}

          {reviewError ? (
            <p
              className="
                rounded-2xl
                border border-red-200
                bg-red-50 p-6
                text-sm text-red-700
              "
            >
              The review queue could not be loaded.
            </p>
          ) : null}

          {!reviewLoading &&
          !reviewError &&
          !filteredReviewQueue.length ? (
            <div
              className="
                rounded-[2rem]
                border border-dashed
                border-[#cbd5bb]
                bg-white p-8
              "
            >
              <h4
                className="
                  font-serif text-2xl
                  text-[#26311f]
                "
              >
                Nothing needs review.
              </h4>

              <p
                className="
                  mt-2 text-sm
                  text-slate-500
                "
              >
                New submissions will appear
                here automatically.
              </p>
            </div>
          ) : null}

          {paginatedReviewQueue.map(
            (item) => (
              <article
                key={item.revision.id}
                className="
                  rounded-[2rem]
                  border border-[#dfe5d6]
                  bg-white p-6
                  shadow-sm
                "
              >
                <div
                  className="
                    flex flex-col gap-5
                    lg:flex-row
                    lg:items-center
                    lg:justify-between
                  "
                >
                  <div className="min-w-0">
                    <div
                      className="
                        flex flex-wrap
                        items-center gap-2
                      "
                    >
                      <StatusBadge tone="info">
                        In review
                      </StatusBadge>

                      <span
                        className="
                          text-xs
                          text-slate-500
                        "
                      >
                        Version{" "}
                        {
                          item.revision
                            .version_number
                        }
                      </span>
                    </div>

                    <h4
                      className="
                        mt-3 font-serif
                        text-2xl
                        text-[#26311f]
                      "
                    >
                      {item.revision.title}
                    </h4>

                    <p
                      className="
                        mt-2 text-sm
                        text-slate-600
                      "
                    >
                      {item.revision
                        .author_name ||
                        "No byline"}

                      {" · "}

                      {contentTypeLabel(
                        item.revision
                          .content_type,
                      )}

                      {" · Submitted "}

                      {formatDate(
                        item.revision
                          .submitted_at,
                      )}
                    </p>

                    {item.revision.excerpt ? (
                      <p
                        className="
                          mt-3 line-clamp-2
                          max-w-3xl
                          text-sm leading-6
                          text-slate-500
                        "
                      >
                        {item.revision.excerpt}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      openReview(item)
                    }
                  >
                    Review article
                  </Button>
                </div>
              </article>
            ),
          )}
        </section>
      ) : null}


      {view === "review" &&
      filteredReviewQueue.length >
        ADMIN_PAGE_SIZE ? (
        <PaginationControls
          page={currentPage}
          pageCount={reviewPageCount}
          onPageChange={setPage}
        />
      ) : null}


      {view === "ready" ? (
        <section className="space-y-4">
          <div>
            <h3
              className="
                text-2xl font-semibold
                text-slate-950
              "
            >
              Ready to publish
            </h3>

            <p
              className="
                mt-1 text-sm
                text-slate-500
              "
            >
              These revisions have been
              approved. Publication remains
              a separate action.
            </p>
          </div>

          {publicationLoading ? (
            <p
              className="
                rounded-2xl border
                bg-white p-6
                text-sm text-slate-500
              "
            >
              Loading publication queue…
            </p>
          ) : null}

          {publicationError ? (
            <p
              className="
                rounded-2xl
                border border-red-200
                bg-red-50 p-6
                text-sm text-red-700
              "
            >
              The publication queue could not
              be loaded.
            </p>
          ) : null}

          {!publicationLoading &&
          !publicationError &&
          !filteredPublicationQueue.length ? (
            <div
              className="
                rounded-[2rem]
                border border-dashed
                border-[#cbd5bb]
                bg-white p-8
              "
            >
              <h4
                className="
                  font-serif text-2xl
                  text-[#26311f]
                "
              >
                Nothing is waiting to publish.
              </h4>

              <p
                className="
                  mt-2 text-sm
                  text-slate-500
                "
              >
                Approved articles will move
                into this queue.
              </p>
            </div>
          ) : null}

          {paginatedPublicationQueue.map(
            (item) => (
              <article
                key={item.revision.id}
                className="
                  rounded-[2rem]
                  border border-[#dfe5d6]
                  bg-white p-6
                  shadow-sm
                "
              >
                <div
                  className="
                    flex flex-col gap-5
                    lg:flex-row
                    lg:items-center
                    lg:justify-between
                  "
                >
                  <div className="min-w-0">
                    <StatusBadge tone="success">
                      Approved
                    </StatusBadge>

                    <h4
                      className="
                        mt-3 font-serif
                        text-2xl
                        text-[#26311f]
                      "
                    >
                      {item.revision.title}
                    </h4>

                    <p
                      className="
                        mt-2 text-sm
                        text-slate-600
                      "
                    >
                      {item.revision
                        .author_name ||
                        "No byline"}

                      {" · Approved "}

                      {formatDate(
                        item.revision
                          .reviewed_at,
                      )}
                    </p>

                    {item.post.status ===
                    "published" ? (
                      <p
                        className="
                          mt-2 text-xs
                          font-medium
                          text-[#718064]
                        "
                      >
                        A previous version is
                        currently live. Publishing
                        this revision will replace it.
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    variant="success"
                    disabled={
                      publishMutation.isPending
                    }
                    onClick={() =>
                      publishMutation.mutate(
                        item.revision.id,
                      )
                    }
                  >
                    {publishMutation.isPending
                      ? "Publishing..."
                      : "Publish article"}
                  </Button>
                </div>
              </article>
            ),
          )}

          {publishMutation.isError ? (
            <p
              className="
                rounded-xl
                border border-red-200
                bg-red-50
                px-4 py-3
                text-sm text-red-700
              "
            >
              The article could not be published.
            </p>
          ) : null}
        </section>
      ) : null}

      {view === "ready" &&
      filteredPublicationQueue.length >
        ADMIN_PAGE_SIZE ? (
        <PaginationControls
          page={currentPage}
          pageCount={publicationPageCount}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
