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
  FileClock,
  History,
  Pencil,
  Plus,
  Send,
} from "lucide-react";

import { SearchField } from "../../../components/data/SearchField";
import { StatusBadge } from "../../../components/data/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { BlogArticleEditor } from "../components/BlogArticleEditor";
import {
  BlogDraftPayload,
  BlogReviewEvent,
  BlogReviewStatus,
  BlogWorkflowPost,
  createMyBlogPost,
  fetchMyBlogHistory,
  fetchMyBlogPosts,
  submitMyBlogPost,
  updateMyBlogPost,
} from "../lib/blogApi";


type MyArticlesView =
  | "all"
  | "draft"
  | "pending_review"
  | "changes_requested"
  | "approved"
  | "published"
  | "rejected";


type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";


const PAGE_SIZE = 10;


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
    case "approved":
    case "published":
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


function isEditable(
  post: BlogWorkflowPost,
) {
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


function matchesView(
  post: BlogWorkflowPost,
  view: MyArticlesView,
) {
  if (view === "all") {
    return true;
  }

  if (view === "published") {
    return post.status === "published";
  }

  return (
    post.working_revision?.review_status ===
    view
  );
}


function matchesSearch(
  post: BlogWorkflowPost,
  search: string,
) {
  if (!search.trim()) {
    return true;
  }

  const revision =
    post.working_revision ??
    post.current_publication;

  const haystack = [
    post.title,
    post.slug,
    revision?.category,
    revision?.content_type,
    revision?.source_name,
    ...(revision?.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(
    search.trim().toLowerCase(),
  );
}


function ViewCard({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
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
            rounded-2xl
            border border-[#8c9d79]
            bg-[#eef2e7]
            px-4 py-4
            text-left
            shadow-sm
          `
          : `
            rounded-2xl
            border border-[#dfe5d6]
            bg-white
            px-4 py-4
            text-left
            shadow-sm
            transition
            hover:border-[#b9c4ae]
            hover:bg-[#fbfcf9]
          `
      }
    >
      <p
        className="
          text-xs font-bold uppercase
          tracking-[0.14em]
          text-[#718064]
        "
      >
        {label}
      </p>

      <p
        className="
          mt-2 font-serif
          text-3xl text-[#26311f]
        "
      >
        {count}
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
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >
      <p className="text-sm text-slate-500">
        Page{" "}
        <strong className="text-slate-800">
          {page}
        </strong>
        {" of "}
        <strong className="text-slate-800">
          {pageCount}
        </strong>
      </p>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() =>
            onPageChange(page - 1)
          }
        >
          Previous
        </Button>

        <Button
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


function HistoryPanel({
  post,
  events,
  loading,
  error,
  onClose,
}: {
  post: BlogWorkflowPost;
  events: BlogReviewEvent[];
  loading: boolean;
  error: boolean;
  onClose: () => void;
}) {
  const revision =
    post.working_revision ??
    post.current_publication;

  return (
    <section
      className="
        rounded-[2rem]
        border border-[#dfe5d6]
        bg-white
        shadow-sm
      "
    >
      <div
        className="
          flex flex-col gap-4
          border-b border-[#e5e9df]
          p-6
          sm:flex-row
          sm:items-start
          sm:justify-between
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
            Article history
          </p>

          <h3
            className="
              mt-2 font-serif
              text-3xl
              text-[#26311f]
            "
          >
            {post.title}
          </h3>

          <div
            className="
              mt-3 flex flex-wrap
              items-center gap-2
            "
          >
            <StatusBadge
              tone={statusTone(
                effectiveStatus(post),
              )}
            >
              {statusLabel(
                effectiveStatus(post),
              )}
            </StatusBadge>

            {revision ? (
              <span
                className="
                  text-sm text-slate-500
                "
              >
                Version{" "}
                {revision.version_number}
              </span>
            ) : null}
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={onClose}
        >
          Close
        </Button>
      </div>


      <div className="p-6">
        {revision?.review_notes &&
        [
          "changes_requested",
          "rejected",
        ].includes(
          revision.review_status,
        ) ? (
          <div
            className={
              revision.review_status ===
              "rejected"
                ? `
                  rounded-2xl
                  border border-red-200
                  bg-red-50
                  p-5
                `
                : `
                  rounded-2xl
                  border border-amber-200
                  bg-amber-50
                  p-5
                `
            }
          >
            <p
              className="
                text-xs font-bold uppercase
                tracking-[0.16em]
                text-slate-700
              "
            >
              Practice feedback
            </p>

            <p
              className="
                mt-2 text-sm
                leading-6
                text-slate-800
              "
            >
              {revision.review_notes}
            </p>
          </div>
        ) : null}


        {loading ? (
          <p
            className="
              mt-6 text-sm
              text-slate-500
            "
          >
            Loading article history…
          </p>
        ) : null}


        {error ? (
          <p
            className="
              mt-6 rounded-xl
              border border-red-200
              bg-red-50
              px-4 py-3
              text-sm text-red-700
            "
          >
            Article history could not be loaded.
          </p>
        ) : null}


        {!loading &&
        !error &&
        !events.length ? (
          <p
            className="
              mt-6 text-sm
              text-slate-500
            "
          >
            No history has been recorded yet.
          </p>
        ) : null}


        {events.length ? (
          <div
            className="
              mt-6 max-w-3xl
              space-y-5
            "
          >
            {events.map((event) => (
              <div
                key={event.id}
                className="
                  border-l-2
                  border-[#cad4c0]
                  pl-4
                "
              >
                <p
                  className="
                    text-sm font-semibold
                    capitalize
                    text-slate-900
                  "
                >
                  {event.action.replace(
                    /_/g,
                    " ",
                  )}
                </p>

                <p
                  className="
                    mt-1 text-xs
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
                      mt-2 max-w-2xl
                      text-sm leading-6
                      text-slate-600
                    "
                  >
                    {event.note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}


export function MyBlogArticlesPage() {
  const queryClient = useQueryClient();

  const [view, setView] =
    useState<MyArticlesView>("all");

  const [search, setSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [editorOpen, setEditorOpen] =
    useState(false);

  const [
    editorPost,
    setEditorPost,
  ] = useState<BlogWorkflowPost | null>(
    null,
  );

  const [
    historyPost,
    setHistoryPost,
  ] = useState<BlogWorkflowPost | null>(
    null,
  );


  const {
    data: posts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["my-blog-articles"],
    queryFn: fetchMyBlogPosts,
  });


  const historyQuery = useQuery({
    queryKey: [
      "my-blog-history",
      historyPost?.id,
    ],
    queryFn: () =>
      fetchMyBlogHistory(
        historyPost!.id,
      ),
    enabled: Boolean(historyPost),
  });


  function refresh() {
    queryClient.invalidateQueries({
      queryKey: ["my-blog-articles"],
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
          await updateMyBlogPost({
            postId: editorPost.id,
            data: payload,
          });
      } else {
        saved =
          await createMyBlogPost(
            payload,
          );
      }

      if (submitAfterSave) {
        saved =
          await submitMyBlogPost(
            saved.id,
          );
      }

      return saved;
    },

    onSuccess: () => {
      refresh();
      setEditorOpen(false);
      setEditorPost(null);
    },
  });


  const submitMutation = useMutation({
    mutationFn: submitMyBlogPost,

    onSuccess: () => {
      refresh();
    },
  });


  const filteredPosts = useMemo(
    () =>
      posts
        .filter(
          (post) =>
            matchesView(post, view) &&
            matchesSearch(post, search),
        )
        .sort(
          (a, b) =>
            new Date(
              b.updated_at,
            ).getTime() -
            new Date(
              a.updated_at,
            ).getTime(),
        ),
    [posts, search, view],
  );


  const pageCount = Math.max(
    1,
    Math.ceil(
      filteredPosts.length /
        PAGE_SIZE,
    ),
  );

  const currentPage = Math.min(
    page,
    pageCount,
  );

  const start =
    (currentPage - 1) *
    PAGE_SIZE;

  const paginatedPosts =
    filteredPosts.slice(
      start,
      start + PAGE_SIZE,
    );


  const counts = useMemo(
    () => ({
      all: posts.length,

      draft: posts.filter(
        (post) =>
          post.working_revision
            ?.review_status ===
          "draft",
      ).length,

      pending_review: posts.filter(
        (post) =>
          post.working_revision
            ?.review_status ===
          "pending_review",
      ).length,

      changes_requested: posts.filter(
        (post) =>
          post.working_revision
            ?.review_status ===
          "changes_requested",
      ).length,

      approved: posts.filter(
        (post) =>
          post.working_revision
            ?.review_status ===
          "approved",
      ).length,

      published: posts.filter(
        (post) =>
          post.status === "published",
      ).length,

      rejected: posts.filter(
        (post) =>
          post.working_revision
            ?.review_status ===
          "rejected",
      ).length,
    }),
    [posts],
  );


  function chooseView(
    next: MyArticlesView,
  ) {
    setView(next);
    setPage(1);
  }


  function openNew() {
    setEditorPost(null);
    setEditorOpen(true);
    setHistoryPost(null);

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
    setHistoryPost(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  function openHistory(
    post: BlogWorkflowPost,
  ) {
    setHistoryPost(post);
    setEditorOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  const editorRevision =
    editorPost
      ? (
        editorPost.working_revision ??
        editorPost.current_publication
      )
      : null;


  const editorFeedback =
    editorPost?.working_revision &&
    [
      "changes_requested",
      "rejected",
    ].includes(
      editorPost
        .working_revision
        .review_status,
    )
      ? editorPost
          .working_revision
          .review_notes
      : null;


  return (
    <div className="space-y-7">
      <header
        className="
          flex flex-col gap-5
          border-b border-[#dfe5d6]
          pb-7
          lg:flex-row
          lg:items-end
          lg:justify-between
        "
      >
        <div>
          <p
            className="
              text-xs font-bold uppercase
              tracking-[0.22em]
              text-[#718064]
            "
          >
            Publishing
          </p>

          <h2
            className="
              mt-3 font-serif
              text-4xl font-semibold
              text-[#26311f]
              md:text-5xl
            "
          >
            My Articles
          </h2>

          <p
            className="
              mt-3 max-w-2xl
              text-sm leading-7
              text-slate-600
              md:text-base
            "
          >
            Write articles, submit them for
            editorial review, respond to
            practice feedback, and keep track
            of published work.
          </p>
        </div>

        <Button
          type="button"
          onClick={openNew}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New article
        </Button>
      </header>


      {editorOpen ? (
        <>
          {editorFeedback ? (
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
                Practice feedback
              </p>

              <h3
                className="
                  mt-2 font-serif
                  text-2xl
                  text-amber-950
                "
              >
                Changes have been requested.
              </h3>

              <p
                className="
                  mt-2 max-w-3xl
                  text-sm leading-6
                  text-amber-950
                "
              >
                {editorFeedback}
              </p>

              <p
                className="
                  mt-3 text-xs
                  leading-5
                  text-amber-800
                "
              >
                Update your article below and
                submit it again when ready.
              </p>
            </div>
          ) : null}

          <BlogArticleEditor
            key={
              editorRevision?.id ??
              "new-provider-article"
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
            providerMode
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
                  "Review the required fields and try again."
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
        </>
      ) : null}


      {historyPost ? (
        <HistoryPanel
          post={historyPost}
          events={
            historyQuery.data ?? []
          }
          loading={
            historyQuery.isLoading
          }
          error={
            historyQuery.isError
          }
          onClose={() =>
            setHistoryPost(null)
          }
        />
      ) : null}


      <section
        className="
          grid gap-3
          sm:grid-cols-2
          lg:grid-cols-4
          xl:grid-cols-7
        "
      >
        <ViewCard
          label="All"
          count={counts.all}
          active={view === "all"}
          onClick={() =>
            chooseView("all")
          }
        />

        <ViewCard
          label="Drafts"
          count={counts.draft}
          active={view === "draft"}
          onClick={() =>
            chooseView("draft")
          }
        />

        <ViewCard
          label="In review"
          count={counts.pending_review}
          active={
            view === "pending_review"
          }
          onClick={() =>
            chooseView(
              "pending_review",
            )
          }
        />

        <ViewCard
          label="Changes"
          count={counts.changes_requested}
          active={
            view === "changes_requested"
          }
          onClick={() =>
            chooseView(
              "changes_requested",
            )
          }
        />

        <ViewCard
          label="Approved"
          count={counts.approved}
          active={view === "approved"}
          onClick={() =>
            chooseView("approved")
          }
        />

        <ViewCard
          label="Published"
          count={counts.published}
          active={view === "published"}
          onClick={() =>
            chooseView("published")
          }
        />

        <ViewCard
          label="Rejected"
          count={counts.rejected}
          active={view === "rejected"}
          onClick={() =>
            chooseView("rejected")
          }
        />
      </section>


      <div
        className="
          rounded-2xl
          border border-[#dfe5d6]
          bg-white p-4
          shadow-sm
        "
      >
        <div
          className="
            flex flex-col gap-3
            md:flex-row
            md:items-center
            md:justify-between
          "
        >
          <SearchField
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search your articles"
            label="Search my articles"
          />

          <p
            className="
              shrink-0 text-sm
              text-slate-500
            "
          >
            <strong
              className="
                font-semibold
                text-slate-800
              "
            >
              {filteredPosts.length}
            </strong>
            {" "}
            article
            {filteredPosts.length === 1
              ? ""
              : "s"}
          </p>
        </div>
      </div>


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
            border-b border-[#e7eadf]
            px-5 py-4
            lg:px-6
          "
        >
          <h3
            className="
              text-lg font-semibold
              text-slate-950
            "
          >
            Articles
          </h3>

          <p
            className="
              mt-1 text-sm
              text-slate-500
            "
          >
            Your working revision can move
            through review while an older
            published version remains live.
          </p>
        </div>


        {isLoading ? (
          <p
            className="
              p-6 text-sm
              text-slate-500
            "
          >
            Loading your articles…
          </p>
        ) : null}


        {isError ? (
          <p
            className="
              m-6 rounded-xl
              border border-red-200
              bg-red-50
              p-4 text-sm
              text-red-700
            "
          >
            Your articles could not be loaded.
          </p>
        ) : null}


        {!isLoading &&
        !isError &&
        !paginatedPosts.length ? (
          <div
            className="
              p-10 text-center
            "
          >
            <FileClock
              className="
                mx-auto h-8 w-8
                text-[#80906d]
              "
            />

            <h4
              className="
                mt-4 font-serif
                text-2xl
                text-[#26311f]
              "
            >
              No articles in this view.
            </h4>

            <p
              className="
                mt-2 text-sm
                text-slate-500
              "
            >
              Start a new article or choose
              another status.
            </p>
          </div>
        ) : null}


        {paginatedPosts.map((post) => {
          const revision =
            post.working_revision ??
            post.current_publication;

          const state =
            effectiveStatus(post);

          const feedback =
            post.working_revision
              ?.review_notes;

          const showFeedback =
            Boolean(feedback) &&
            [
              "changes_requested",
              "rejected",
            ].includes(state);

          const canEdit =
            isEditable(post);

          const canSubmit =
            post.working_revision
              ?.review_status ===
            "draft";

          return (
            <article
              key={post.id}
              className="
                border-b
                border-slate-100
                px-5 py-6
                last:border-b-0
                lg:px-6
              "
            >
              <div
                className="
                  flex flex-col gap-5
                  xl:flex-row
                  xl:items-start
                  xl:justify-between
                "
              >
                <div
                  className="
                    min-w-0
                    max-w-4xl
                  "
                >
                  <div
                    className="
                      flex flex-wrap
                      items-center gap-2
                    "
                  >
                    <StatusBadge
                      tone={
                        statusTone(state)
                      }
                    >
                      {statusLabel(state)}
                    </StatusBadge>

                    {post.status ===
                    "published" ? (
                      <span
                        className="
                          rounded-full
                          border
                          border-emerald-200
                          bg-emerald-50
                          px-2.5 py-1
                          text-xs
                          font-semibold
                          text-emerald-700
                        "
                      >
                        Live
                      </span>
                    ) : null}

                    {revision ? (
                      <span
                        className="
                          text-xs
                          text-slate-500
                        "
                      >
                        v
                        {
                          revision.version_number
                        }
                      </span>
                    ) : null}
                  </div>

                  <h4
                    className="
                      mt-3 font-serif
                      text-2xl
                      text-[#26311f]
                    "
                  >
                    {post.title}
                  </h4>

                  <p
                    className="
                      mt-2 text-sm
                      text-slate-500
                    "
                  >
                    Updated{" "}
                    {formatDate(
                      post.updated_at,
                    )}

                    {revision?.category
                      ? ` · ${revision.category}`
                      : ""}
                  </p>


                  {showFeedback ? (
                    <div
                      className={
                        state === "rejected"
                          ? `
                            mt-4
                            rounded-xl
                            border border-red-200
                            bg-red-50
                            px-4 py-3
                          `
                          : `
                            mt-4
                            rounded-xl
                            border border-amber-200
                            bg-amber-50
                            px-4 py-3
                          `
                      }
                    >
                      <p
                        className="
                          text-xs font-bold
                          uppercase
                          tracking-[0.13em]
                          text-slate-700
                        "
                      >
                        Practice feedback
                      </p>

                      <p
                        className="
                          mt-1.5
                          text-sm leading-6
                          text-slate-800
                        "
                      >
                        {feedback}
                      </p>
                    </div>
                  ) : null}


                  {state ===
                  "pending_review" ? (
                    <p
                      className="
                        mt-4 text-sm
                        leading-6
                        text-blue-700
                      "
                    >
                      This version is with the
                      practice for review and is
                      temporarily locked.
                    </p>
                  ) : null}


                  {state === "approved" ? (
                    <p
                      className="
                        mt-4 text-sm
                        leading-6
                        text-emerald-700
                      "
                    >
                      This version has been
                      approved and is waiting for
                      the practice to publish it.
                    </p>
                  ) : null}


                  {state === "rejected" ? (
                    <p
                      className="
                        mt-3 text-sm
                        leading-6
                        text-slate-500
                      "
                    >
                      This revision is closed.
                      Its history remains available
                      for reference.
                    </p>
                  ) : null}
                </div>


                <div
                  className="
                    flex shrink-0
                    flex-wrap gap-2
                  "
                >
                  {canEdit ? (
                    <Button
                      variant="secondary"
                      className="gap-2"
                      onClick={() =>
                        openEdit(post)
                      }
                    >
                      <Pencil
                        className="h-4 w-4"
                      />

                      {state ===
                      "changes_requested"
                        ? "Edit & resubmit"
                        : "Edit"}
                    </Button>
                  ) : null}


                  {canSubmit ? (
                    <Button
                      variant="success"
                      className="gap-2"
                      disabled={
                        submitMutation
                          .isPending
                      }
                      onClick={() =>
                        submitMutation.mutate(
                          post.id,
                        )
                      }
                    >
                      <Send
                        className="h-4 w-4"
                      />
                      Submit
                    </Button>
                  ) : null}


                  <Button
                    variant="ghost"
                    className="gap-2"
                    onClick={() =>
                      openHistory(post)
                    }
                  >
                    <History
                      className="h-4 w-4"
                    />
                    History
                  </Button>


                  {post.status ===
                  "published" ? (
                    <a
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="
                        inline-flex
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        border
                        border-[#ccd4c4]
                        bg-white
                        px-4 py-2.5
                        text-sm
                        font-semibold
                        text-[#34422f]
                        transition
                        hover:bg-[#f5f6f1]
                      "
                    >
                      View
                      <ExternalLink
                        className="h-4 w-4"
                      />
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>


      <PaginationControls
        page={currentPage}
        pageCount={pageCount}
        onPageChange={setPage}
      />


      {submitMutation.isError ? (
        <p
          className="
            rounded-xl
            border border-red-200
            bg-red-50
            px-4 py-3
            text-sm text-red-700
          "
        >
          The article could not be submitted
          for review.
        </p>
      ) : null}
    </div>
  );
}
