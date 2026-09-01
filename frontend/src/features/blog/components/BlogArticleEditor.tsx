import {
  FormEvent,
  useState,
} from "react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { MarkdownContent } from "./MarkdownContent";
import {
  BlogContentType,
  BlogDraftPayload,
  BlogMediaType,
  BlogRevision,
} from "../lib/blogApi";


const EMPTY_BODY =
  "## Start writing\n\nAdd useful, public-facing content here.";


type BlogArticleEditorProps = {
  revision?: BlogRevision | null;
  publicSlug?: string | null;
  mode: "create" | "edit";
  saving?: boolean;
  submitting?: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSave: (
    payload: BlogDraftPayload,
    submitAfterSave: boolean,
  ) => void;
};


const CONTENT_TYPE_OPTIONS: Array<{
  value: BlogContentType;
  label: string;
  description: string;
}> = [
  {
    value: "article",
    label: "Article",
    description:
      "Standard original article or practical resource.",
  },
  {
    value: "editorial",
    label: "Editorial",
    description:
      "Platform-authored commentary or editorial content.",
  },
  {
    value: "external_coverage",
    label: "External coverage",
    description:
      "Press or media coverage about the practice or its work.",
  },
  {
    value: "external_article",
    label: "External article",
    description:
      "An article hosted elsewhere that you want to reference.",
  },
  {
    value: "licensed_republication",
    label: "Licensed republication",
    description:
      "Republished content where permission or rights are held.",
  },
];


function isExternalContent(
  contentType: BlogContentType,
) {
  return [
    "external_coverage",
    "external_article",
    "licensed_republication",
  ].includes(contentType);
}


function dateInputValue(
  value: string | null | undefined,
) {
  if (!value) return "";

  return value.slice(0, 10);
}


export function BlogArticleEditor({
  revision,
  publicSlug,
  mode,
  saving = false,
  submitting = false,
  errorMessage,
  onCancel,
  onSave,
}: BlogArticleEditorProps) {
  const [title, setTitle] = useState(revision?.title ?? "");
  const [excerpt, setExcerpt] = useState(revision?.excerpt ?? "");
  const [bodyMarkdown, setBodyMarkdown] =
    useState(
      revision?.body_markdown ?? EMPTY_BODY,
    );

  const [category, setCategory] = useState(revision?.category ?? "");
  const [tags, setTags] = useState(
    revision?.tags.join(", ") ?? "",
  );
  const [authorName, setAuthorName] = useState(
    revision?.author_name ?? "",
  );

  const [contentType, setContentType] =
    useState<BlogContentType>(
      revision?.content_type ?? "article",
    );

  const [externalUrl, setExternalUrl] =
    useState(
      revision?.external_url ?? "",
    );
  const [sourceName, setSourceName] =
    useState(
      revision?.source_name ?? "",
    );
  const [sourceAuthor, setSourceAuthor] =
    useState(
      revision?.source_author ?? "",
    );
  const [sourcePublishedAt, setSourcePublishedAt] =
    useState(
      dateInputValue(
        revision?.source_published_at,
      ),
    );

  const [mediaType, setMediaType] =
    useState<BlogMediaType>(
      revision?.featured_media_type ?? "none",
    );

  const [coverImageUrl, setCoverImageUrl] =
    useState(
      revision?.cover_image_url ?? "",
    );
  const [coverImageAlt, setCoverImageAlt] =
    useState(
      revision?.cover_image_alt ?? "",
    );
  const [videoUrl, setVideoUrl] =
    useState(
      revision?.video_url ?? "",
    );
  const [mediaCaption, setMediaCaption] =
    useState(
      revision?.media_caption ?? "",
    );
  const [mediaCredit, setMediaCredit] =
    useState(
      revision?.media_credit ?? "",
    );

  const [isFeatured, setIsFeatured] =
    useState(
      revision?.is_featured ?? false,
    );

  const [seoTitle, setSeoTitle] =
    useState(
      revision?.seo_title ?? "",
    );
  const [seoDescription, setSeoDescription] =
    useState(
      revision?.seo_description ?? "",
    );

  const [showPreview, setShowPreview] =
    useState(false);



  function buildPayload(): BlogDraftPayload {
    return {
      title: title.trim(),
      excerpt:
        excerpt.trim() || null,
      body_markdown:
        bodyMarkdown.trim(),

      category:
        category.trim() || null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      author_name:
        authorName.trim() || null,

      content_type: contentType,

      external_url:
        externalUrl.trim() || null,
      source_name:
        sourceName.trim() || null,
      source_author:
        sourceAuthor.trim() || null,
      source_published_at:
        sourcePublishedAt
          ? `${sourcePublishedAt}T00:00:00`
          : null,

      featured_media_type: mediaType,

      cover_image_url:
        coverImageUrl.trim() || null,
      cover_image_alt:
        coverImageAlt.trim() || null,
      video_url:
        videoUrl.trim() || null,
      media_caption:
        mediaCaption.trim() || null,
      media_credit:
        mediaCredit.trim() || null,

      is_featured: isFeatured,

      seo_title:
        seoTitle.trim() || null,
      seo_description:
        seoDescription.trim() || null,
    };
  }


  function submit(
    event: FormEvent,
    submitAfterSave: boolean,
  ) {
    event.preventDefault();

    onSave(
      buildPayload(),
      submitAfterSave,
    );
  }


  const busy = saving || submitting;
  const external =
    isExternalContent(contentType);

  const imageIncomplete =
    mediaType === "image" &&
    (
      !coverImageUrl.trim() ||
      !coverImageAlt.trim()
    );

  const videoIncomplete =
    mediaType === "video" &&
    !videoUrl.trim();

  const externalIncomplete =
    external &&
    (
      !sourceName.trim() ||
      (
        contentType !== "licensed_republication" &&
        !externalUrl.trim()
      )
    );

  const invalid =
    !title.trim() ||
    !bodyMarkdown.trim() ||
    imageIncomplete ||
    videoIncomplete ||
    externalIncomplete;


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
            {mode === "create"
              ? "New article"
              : "Article editor"}
          </p>

          <h3
            className="
              mt-2 font-serif
              text-3xl
              text-[#26311f]
            "
          >
            {mode === "create"
              ? "Create a publication draft"
              : title || "Edit article"}
          </h3>

          <p
            className="
              mt-2 max-w-3xl
              text-sm leading-6
              text-slate-600
            "
          >
            Drafting and publication are separate.
            Saving keeps the article editable.
            Submitting sends it into editorial review.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Close editor
        </Button>
      </div>


      <form
        className="space-y-7 p-6 lg:p-8"
        onSubmit={(event) =>
          submit(event, false)
        }
      >
        <section className="space-y-5">
          <div>
            <h4
              className="
                text-lg font-semibold
                text-slate-950
              "
            >
              Article details
            </h4>

            <p
              className="
                mt-1 text-sm
                text-slate-500
              "
            >
              The public URL is created once and
              remains stable through later revisions.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Input
              label="Title"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              maxLength={220}
              required
            />

            <Input
              label="Public URL"
              value={
                publicSlug
                  ? `/blog/${publicSlug}`
                  : "Generated after first save"
              }
              readOnly
              className="
                bg-slate-50
                text-slate-500
              "
            />

            <Input
              label="Category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              maxLength={120}
              placeholder="Wellbeing"
            />

            <Input
              label="Tags"
              value={tags}
              onChange={(event) =>
                setTags(event.target.value)
              }
              placeholder="reflection, anxiety, workplace"
            />

            <Input
              label="Author display name"
              value={authorName}
              onChange={(event) =>
                setAuthorName(event.target.value)
              }
              maxLength={180}
              placeholder="Practice editorial team"
            />

            <label className="block space-y-2">
              <span
                className="
                  text-sm font-medium
                  text-slate-700
                "
              >
                Content type
              </span>

              <select
                value={contentType}
                onChange={(event) =>
                  setContentType(
                    event.target
                      .value as BlogContentType,
                  )
                }
                className="
                  w-full rounded-2xl
                  border border-slate-200
                  bg-white px-4 py-3
                  text-sm text-slate-800
                  outline-none
                  focus:border-slate-400
                  focus:ring-4
                  focus:ring-slate-100
                "
              >
                {CONTENT_TYPE_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>

              <p className="text-xs leading-5 text-slate-500">
                {
                  CONTENT_TYPE_OPTIONS.find(
                    (option) =>
                      option.value === contentType,
                  )?.description
                }
              </p>
            </label>
          </div>

          <Textarea
            label="Short excerpt"
            value={excerpt}
            onChange={(event) =>
              setExcerpt(event.target.value)
            }
            maxLength={600}
            rows={3}
            placeholder="A concise introduction for article cards and search results."
          />

          <Textarea
            label="Article body (Markdown)"
            value={bodyMarkdown}
            onChange={(event) =>
              setBodyMarkdown(
                event.target.value,
              )
            }
            rows={16}
            required
            className="
              font-mono
              leading-7
            "
          />
        </section>


        {external ? (
          <section
            className="
              rounded-2xl
              border border-[#e0e5d9]
              bg-[#fafbf7]
              p-5
            "
          >
            <div>
              <h4
                className="
                  text-lg font-semibold
                  text-slate-950
                "
              >
                Original source
              </h4>

              <p
                className="
                  mt-1 text-sm leading-6
                  text-slate-600
                "
              >
                Use attribution and a canonical
                source link for externally published
                work. Full republication should only
                be used where publication rights or
                permission exist.
              </p>
            </div>

            <div
              className="
                mt-5 grid gap-5
                lg:grid-cols-2
              "
            >
              <Input
                label="Source publication"
                value={sourceName}
                onChange={(event) =>
                  setSourceName(
                    event.target.value,
                  )
                }
                placeholder="Publication or publisher"
                required={external}
              />

              <Input
                label="Original author"
                value={sourceAuthor}
                onChange={(event) =>
                  setSourceAuthor(
                    event.target.value,
                  )
                }
                placeholder="Author name"
              />

              <Input
                label="Original publication date"
                type="date"
                value={sourcePublishedAt}
                onChange={(event) =>
                  setSourcePublishedAt(
                    event.target.value,
                  )
                }
              />

              <Input
                label="Original article URL"
                value={externalUrl}
                onChange={(event) =>
                  setExternalUrl(
                    event.target.value,
                  )
                }
                placeholder="https://..."
                required={
                  contentType !==
                  "licensed_republication"
                }
              />
            </div>
          </section>
        ) : null}


        <section
          className="
            rounded-2xl
            border border-slate-200
            p-5
          "
        >
          <div>
            <h4
              className="
                text-lg font-semibold
                text-slate-950
              "
            >
              Featured media
            </h4>

            <p
              className="
                mt-1 text-sm
                text-slate-500
              "
            >
              Choose one primary media format for
              the article.
            </p>
          </div>

          <div
            className="
              mt-5 grid gap-5
              lg:grid-cols-2
            "
          >
            <label className="block space-y-2">
              <span
                className="
                  text-sm font-medium
                  text-slate-700
                "
              >
                Media type
              </span>

              <select
                value={mediaType}
                onChange={(event) =>
                  setMediaType(
                    event.target
                      .value as BlogMediaType,
                  )
                }
                className="
                  w-full rounded-2xl
                  border border-slate-200
                  bg-white px-4 py-3
                  text-sm outline-none
                  focus:border-slate-400
                  focus:ring-4
                  focus:ring-slate-100
                "
              >
                <option value="none">
                  No featured media
                </option>
                <option value="image">
                  Image
                </option>
                <option value="video">
                  Video
                </option>
              </select>
            </label>
          </div>

          {mediaType === "image" ? (
            <div
              className="
                mt-5 grid gap-5
                lg:grid-cols-2
              "
            >
              <Input
                label="Image URL or path"
                value={coverImageUrl}
                onChange={(event) =>
                  setCoverImageUrl(
                    event.target.value,
                  )
                }
                placeholder="https://... or /images/..."
                required
              />

              <Input
                label="Image description (alt text)"
                value={coverImageAlt}
                onChange={(event) =>
                  setCoverImageAlt(
                    event.target.value,
                  )
                }
                maxLength={220}
                required
              />

              <Input
                label="Caption"
                value={mediaCaption}
                onChange={(event) =>
                  setMediaCaption(
                    event.target.value,
                  )
                }
              />

              <Input
                label="Image credit"
                value={mediaCredit}
                onChange={(event) =>
                  setMediaCredit(
                    event.target.value,
                  )
                }
                placeholder="Photographer, publication, licence"
              />
            </div>
          ) : null}

          {mediaType === "video" ? (
            <div
              className="
                mt-5 grid gap-5
                lg:grid-cols-2
              "
            >
              <Input
                label="Video URL"
                value={videoUrl}
                onChange={(event) =>
                  setVideoUrl(
                    event.target.value,
                  )
                }
                placeholder="https://..."
                required
              />

              <Input
                label="Video credit"
                value={mediaCredit}
                onChange={(event) =>
                  setMediaCredit(
                    event.target.value,
                  )
                }
              />

              <div className="lg:col-span-2">
                <Input
                  label="Video caption"
                  value={mediaCaption}
                  onChange={(event) =>
                    setMediaCaption(
                      event.target.value,
                    )
                  }
                />
              </div>
            </div>
          ) : null}
        </section>


        <section
          className="
            rounded-2xl
            border border-slate-200
            p-5
          "
        >
          <div>
            <h4
              className="
                text-lg font-semibold
                text-slate-950
              "
            >
              Search and presentation
            </h4>
          </div>

          <div
            className="
              mt-5 grid gap-5
              lg:grid-cols-2
            "
          >
            <Input
              label="SEO title"
              value={seoTitle}
              onChange={(event) =>
                setSeoTitle(
                  event.target.value,
                )
              }
              maxLength={220}
            />

            <Input
              label="SEO description"
              value={seoDescription}
              onChange={(event) =>
                setSeoDescription(
                  event.target.value,
                )
              }
              maxLength={320}
            />
          </div>

          <label
            className="
              mt-5 flex items-start
              gap-3
              text-sm text-slate-700
            "
          >
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(event) =>
                setIsFeatured(
                  event.target.checked,
                )
              }
              className="mt-1"
            />

            <span>
              <strong className="font-semibold text-slate-900">
                Feature this article
              </strong>

              <span className="mt-0.5 block text-slate-500">
                Featured articles receive priority
                placement on the public blog.
              </span>
            </span>
          </label>
        </section>


        <div
          className="
            flex flex-col gap-3
            border-t border-slate-100
            pt-6
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={busy || invalid}
            >
              {saving
                ? "Saving..."
                : "Save draft"}
            </Button>

            <Button
              type="button"
              variant="success"
              disabled={busy || invalid}
              onClick={(event) =>
                submit(event, true)
              }
            >
              {submitting
                ? "Submitting..."
                : "Save and submit for review"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setShowPreview(
                  (current) => !current,
                )
              }
              disabled={busy}
            >
              {showPreview
                ? "Hide preview"
                : "Preview"}
            </Button>
          </div>

          <p
            className="
              max-w-md
              text-xs leading-5
              text-slate-500
            "
          >
            Approval does not publish automatically.
            Publishing remains a separate editorial
            action.
          </p>
        </div>


        {errorMessage ? (
          <p
            className="
              rounded-xl
              border border-red-200
              bg-red-50
              px-4 py-3
              text-sm text-red-700
            "
          >
            {errorMessage}
          </p>
        ) : null}


        {showPreview ? (
          <section
            className="
              rounded-[2rem]
              border border-[#dfe5d6]
              bg-[#fbfaf5]
              p-6
              lg:p-9
            "
          >
            <p
              className="
                text-xs font-semibold
                uppercase
                tracking-[0.24em]
                text-[#6a7a4e]
              "
            >
              Draft preview
            </p>

            <h4
              className="
                mt-3 font-serif
                text-4xl
                text-[#26311f]
              "
            >
              {title || "Untitled article"}
            </h4>

            {excerpt ? (
              <p
                className="
                  mt-4 max-w-3xl
                  text-[#5f6d54]
                "
              >
                {excerpt}
              </p>
            ) : null}

            <div className="mt-7">
              <MarkdownContent
                markdown={
                  bodyMarkdown ||
                  EMPTY_BODY
                }
              />
            </div>
          </section>
        ) : null}
      </form>
    </section>
  );
}
