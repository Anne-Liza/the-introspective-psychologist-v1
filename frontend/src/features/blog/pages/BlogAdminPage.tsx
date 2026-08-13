import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { MarkdownContent } from "../components/MarkdownContent";
import {
  BlogPost,
  BlogPostPayload,
  createBlogPost,
  deleteBlogPost,
  fetchBlogPosts,
  slugify,
  updateBlogPost,
} from "../lib/blogApi";

const EMPTY_BODY = "## Start writing\n\nAdd useful, public-facing content here.";

function displayDate(value: string | null) {
  if (!value) return "Not published";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function BlogAdminPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [savedSlug, setSavedSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState(EMPTY_BODY);
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageAlt, setCoverImageAlt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isFeatured, setIsFeatured] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: fetchBlogPosts,
  });

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setSavedSlug("");
    setExcerpt("");
    setBodyMarkdown(EMPTY_BODY);
    setCategory("");
    setTags("");
    setAuthorName("");
    setCoverImageUrl("");
    setCoverImageAlt("");
    setSeoTitle("");
    setSeoDescription("");
    setStatus("draft");
    setIsFeatured(false);
    setShowPreview(false);
  }

  function beginEdit(post: BlogPost) {
    setEditingId(post.id);
    setTitle(post.title);
    setSavedSlug(post.slug);
    setExcerpt(post.excerpt || "");
    setBodyMarkdown(post.body_markdown);
    setCategory(post.category || "");
    setTags(post.tags.join(", "));
    setAuthorName(post.author_name || "");
    setCoverImageUrl(post.cover_image_url || "");
    setCoverImageAlt(post.cover_image_alt || "");
    setSeoTitle(post.seo_title || "");
    setSeoDescription(post.seo_description || "");
    setStatus(post.status);
    setIsFeatured(post.is_featured);
    setShowPreview(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function payload(): BlogPostPayload {
    return {
      title: title.trim(),
      slug: savedSlug || slugify(title),
      excerpt: excerpt.trim() || null,
      body_markdown: bodyMarkdown,
      category: category.trim() || null,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      author_name: authorName.trim() || null,
      cover_image_url: coverImageUrl.trim() || null,
      cover_image_alt: coverImageAlt.trim() || null,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
      status,
      is_featured: isFeatured,
    };
  }

  function refreshPosts() {
    queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    queryClient.invalidateQueries({ queryKey: ["public-blog-posts"] });
  }

  const createMutation = useMutation({
    mutationFn: createBlogPost,
    onSuccess: () => {
      refreshPosts();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateBlogPost,
    onSuccess: () => {
      refreshPosts();
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBlogPost,
    onSuccess: refreshPosts,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = payload();
    if (editingId) updateMutation.mutate({ id: editingId, data: next });
    else createMutation.mutate(next);
  }

  function remove(post: BlogPost) {
    if (window.confirm(`Delete “${post.title}”? This cannot be undone.`)) {
      deleteMutation.mutate(post.id);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const saveError = createMutation.isError || updateMutation.isError;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#6a7a4e]">Website</p>
        <h2 className="mt-2 text-4xl font-bold text-slate-950">Blog</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Draft, preview, and publish reusable public articles. Markdown is supported; raw HTML is not rendered.
        </p>
      </header>

      <form onSubmit={submit} className="rounded-[2rem] border border-[#dfe5d6] bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold text-slate-950">
              {editingId ? "Edit article" : "Create article"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Keep articles public-facing. Do not include private client or clinical information.
            </p>
          </div>
          {editingId ? <Button type="button" variant="secondary" onClick={resetForm}>Cancel edit</Button> : null}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={220} required />
          <Input label="Public URL" value={`/blog/${savedSlug || slugify(title)}`} readOnly className="bg-slate-50 text-slate-500" />
          <Input label="Category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={120} />
          <Input label="Tags (comma separated)" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="reflection, wellbeing" />
          <Input label="Author display name" value={authorName} onChange={(event) => setAuthorName(event.target.value)} maxLength={180} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Publishing state</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "published")} className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-slate-900">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>

        <div className="mt-5 space-y-5">
          <Textarea label="Short excerpt" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} maxLength={500} rows={3} />
          <Textarea label="Article body (Markdown)" value={bodyMarkdown} onChange={(event) => setBodyMarkdown(event.target.value)} rows={14} required className="font-mono leading-7" />
        </div>

        <details className="mt-5 rounded-2xl border border-slate-200 p-5">
          <summary className="cursor-pointer font-semibold text-slate-900">Cover image and search details</summary>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Input label="Cover image URL" type="url" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} placeholder="https://…" />
            <Input label="Cover image description" value={coverImageAlt} onChange={(event) => setCoverImageAlt(event.target.value)} required={Boolean(coverImageUrl)} maxLength={220} />
            <Input label="SEO title" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} maxLength={220} />
            <Input label="SEO description" value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} maxLength={320} />
          </div>
        </details>

        <label className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} />
          Feature this article
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" disabled={saving || !slugify(title)}>
            {saving ? "Saving…" : editingId ? "Save article" : "Create article"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowPreview((value) => !value)}>
            {showPreview ? "Hide preview" : "Preview article"}
          </Button>
        </div>

        {saveError ? (
          <p className="mt-4 text-sm text-red-600">The article could not be saved. Check the title, image URL, and required fields.</p>
        ) : null}

        {showPreview ? (
          <section className="mt-7 rounded-[2rem] border border-[#dfe5d6] bg-[#fbfaf5] p-6 lg:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6a7a4e]">Preview</p>
            <h4 className="mt-3 font-serif text-4xl text-[#26311f]">{title || "Untitled article"}</h4>
            {excerpt ? <p className="mt-4 text-[#5f6d54]">{excerpt}</p> : null}
            <div className="mt-7"><MarkdownContent markdown={bodyMarkdown} /></div>
          </section>
        ) : null}
      </form>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#6a7a4e]">Publication</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-950">All articles</h3>
          </div>
          <span className="rounded-full bg-[#eef2e7] px-4 py-2 text-sm font-semibold text-[#52623d]">{data.length} total</span>
        </div>

        {isLoading ? <p className="mt-5 rounded-3xl border bg-white p-6 text-slate-500">Loading articles…</p> : null}
        {isError ? <p className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">Articles could not be loaded.</p> : null}
        {!isLoading && !isError && !data.length ? (
          <div className="mt-5 rounded-[2rem] border border-dashed border-[#cbd5bb] bg-white p-8">
            <h4 className="font-serif text-2xl text-[#26311f]">Your first article starts above.</h4>
            <p className="mt-2 text-sm text-slate-600">Create a draft, preview it safely, then publish when it is ready.</p>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {data.map((post) => (
            <article key={post.id} className="rounded-[2rem] border border-[#dfe5d6] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7a4e]">
                <span>{post.status}</span>
                {post.is_featured ? <span>Featured</span> : null}
              </div>
              <h4 className="mt-3 font-serif text-2xl text-[#26311f]">{post.title}</h4>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{post.excerpt || "No excerpt yet."}</p>
              <p className="mt-4 text-xs text-slate-500">{displayDate(post.published_at)}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => beginEdit(post)}>Edit</Button>
                {post.status === "published" ? (
                  <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">View</a>
                ) : null}
                <Button type="button" variant="danger" onClick={() => remove(post)} disabled={deleteMutation.isPending}>Delete</Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
