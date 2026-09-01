import { apiClient } from "../../../lib/api-client";


export type BlogPostStatus =
  | "draft"
  | "published";

export type BlogReviewStatus =
  | "draft"
  | "pending_review"
  | "changes_requested"
  | "approved"
  | "rejected";

export type BlogReviewDecision =
  | "changes_requested"
  | "approved"
  | "rejected";

export type BlogContentType =
  | "article"
  | "editorial"
  | "external_coverage"
  | "external_article"
  | "licensed_republication";

export type BlogMediaType =
  | "none"
  | "image"
  | "video";


/*
 * Public blog DTO.
 *
 * Keep this deliberately smaller than the
 * editorial workflow DTOs so moderation data
 * never becomes part of public rendering.
 */
export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_markdown: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  category: string | null;
  tags: string[];
  author_name: string | null;
  status: BlogPostStatus;
  is_featured: boolean;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};


export type BlogDraftPayload = {
  title: string;
  excerpt: string | null;
  body_markdown: string;

  category: string | null;
  tags: string[];
  author_name: string | null;

  content_type: BlogContentType;

  external_url: string | null;
  source_name: string | null;
  source_author: string | null;
  source_published_at: string | null;

  featured_media_type: BlogMediaType;

  cover_image_url: string | null;
  cover_image_alt: string | null;
  video_url: string | null;
  media_caption: string | null;
  media_credit: string | null;

  is_featured: boolean;

  seo_title: string | null;
  seo_description: string | null;
};


export type BlogRevision = BlogDraftPayload & {
  id: string;
  blog_post_id: string;
  version_number: number;

  review_status: BlogReviewStatus;
  submitted_at: string | null;

  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;

  created_by_user_id: string | null;
  updated_by_user_id: string | null;

  is_current_publication: boolean;

  published_by_user_id: string | null;
  published_at: string | null;

  created_at: string;
  updated_at: string;
};


export type BlogWorkflowPost = {
  id: string;
  slug: string;

  owner_user_id: string | null;
  therapist_profile_id: string | null;

  status: BlogPostStatus;
  published_at: string | null;

  title: string;
  author_name: string | null;
  content_type: BlogContentType;

  created_at: string;
  updated_at: string;

  working_revision: BlogRevision | null;
  current_publication: BlogRevision | null;
};


export type BlogReviewEvent = {
  id: string;
  blog_post_id: string;
  revision_id: string | null;
  actor_user_id: string | null;
  action: string;
  note: string | null;
  created_at: string;
};


export type BlogAdminReview = {
  post: BlogWorkflowPost;
  revision: BlogRevision;
  history: BlogReviewEvent[];
};


/*
 * Legacy admin DTO.
 *
 * Keep until BlogAdminPage has been completely
 * migrated away from direct /blog CRUD.
 */
export type BlogPostPayload = Pick<
  BlogPost,
  | "title"
  | "slug"
  | "excerpt"
  | "body_markdown"
  | "cover_image_url"
  | "cover_image_alt"
  | "category"
  | "tags"
  | "author_name"
  | "status"
  | "is_featured"
  | "seo_title"
  | "seo_description"
>;


export function slugify(
  value: string,
): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


/* ------------------------------------------------------------------
 * Public blog
 * ------------------------------------------------------------------ */


export async function fetchPublicBlogPosts():
Promise<BlogPost[]> {
  const response =
    await apiClient.get<BlogPost[]>(
      "/blog/public",
    );

  return response.data;
}


export async function fetchPublicBlogPost(
  slug: string,
): Promise<BlogPost> {
  const response =
    await apiClient.get<BlogPost>(
      `/blog/public/${slug}`,
    );

  return response.data;
}


/* ------------------------------------------------------------------
 * Admin editorial workspace
 * ------------------------------------------------------------------ */


export async function fetchAdminBlogPosts():
Promise<BlogWorkflowPost[]> {
  const response =
    await apiClient.get<BlogWorkflowPost[]>(
      "/blog/admin",
    );

  return response.data;
}


export async function fetchAdminBlogPost(
  postId: string,
): Promise<BlogWorkflowPost> {
  const response =
    await apiClient.get<BlogWorkflowPost>(
      `/blog/admin/${postId}`,
    );

  return response.data;
}


export async function createAdminBlogPost(
  payload: BlogDraftPayload,
): Promise<BlogWorkflowPost> {
  const response =
    await apiClient.post<BlogWorkflowPost>(
      "/blog/admin",
      payload,
    );

  return response.data;
}


export async function updateAdminBlogPost({
  postId,
  data,
}: {
  postId: string;
  data: Partial<BlogDraftPayload>;
}): Promise<BlogWorkflowPost> {
  const response =
    await apiClient.patch<BlogWorkflowPost>(
      `/blog/admin/${postId}`,
      data,
    );

  return response.data;
}


export async function submitAdminBlogPost(
  postId: string,
): Promise<BlogWorkflowPost> {
  const response =
    await apiClient.post<BlogWorkflowPost>(
      `/blog/admin/${postId}/submit`,
    );

  return response.data;
}


export async function fetchAdminBlogHistory(
  postId: string,
): Promise<BlogReviewEvent[]> {
  const response =
    await apiClient.get<BlogReviewEvent[]>(
      `/blog/admin/${postId}/history`,
    );

  return response.data;
}


/* ------------------------------------------------------------------
 * Editorial review
 * ------------------------------------------------------------------ */


export async function fetchBlogReviewQueue():
Promise<BlogAdminReview[]> {
  const response =
    await apiClient.get<BlogAdminReview[]>(
      "/blog/review-queue",
    );

  return response.data;
}


export async function fetchBlogRevision(
  revisionId: string,
): Promise<BlogAdminReview> {
  const response =
    await apiClient.get<BlogAdminReview>(
      `/blog/revisions/${revisionId}`,
    );

  return response.data;
}


export async function reviewBlogRevision({
  revisionId,
  decision,
  notes,
}: {
  revisionId: string;
  decision: BlogReviewDecision;
  notes?: string | null;
}): Promise<BlogAdminReview> {
  const response =
    await apiClient.post<BlogAdminReview>(
      `/blog/revisions/${revisionId}/review`,
      {
        decision,
        notes:
          notes?.trim() || null,
      },
    );

  return response.data;
}


/* ------------------------------------------------------------------
 * Publication
 * ------------------------------------------------------------------ */


export async function fetchBlogPublicationQueue():
Promise<BlogAdminReview[]> {
  const response =
    await apiClient.get<BlogAdminReview[]>(
      "/blog/publication-queue",
    );

  return response.data;
}


export async function publishBlogRevision(
  revisionId: string,
): Promise<BlogAdminReview> {
  const response =
    await apiClient.post<BlogAdminReview>(
      `/blog/revisions/${revisionId}/publish`,
    );

  return response.data;
}


/* ------------------------------------------------------------------
 * Therapist: My Articles
 *
 * These will be used when we build the therapist workspace.
 * ------------------------------------------------------------------ */


export async function fetchMyBlogPosts():
Promise<BlogWorkflowPost[]> {
  const response =
    await apiClient.get<BlogWorkflowPost[]>(
      "/blog/mine",
    );

  return response.data;
}


export async function fetchMyBlogPost(
  postId: string,
): Promise<BlogWorkflowPost> {
  const response =
    await apiClient.get<BlogWorkflowPost>(
      `/blog/mine/${postId}`,
    );

  return response.data;
}


export async function createMyBlogPost(
  payload: BlogDraftPayload,
): Promise<BlogWorkflowPost> {
  const response =
    await apiClient.post<BlogWorkflowPost>(
      "/blog/mine",
      payload,
    );

  return response.data;
}


export async function updateMyBlogPost({
  postId,
  data,
}: {
  postId: string;
  data: Partial<BlogDraftPayload>;
}): Promise<BlogWorkflowPost> {
  const response =
    await apiClient.patch<BlogWorkflowPost>(
      `/blog/mine/${postId}`,
      data,
    );

  return response.data;
}


export async function submitMyBlogPost(
  postId: string,
): Promise<BlogWorkflowPost> {
  const response =
    await apiClient.post<BlogWorkflowPost>(
      `/blog/mine/${postId}/submit`,
    );

  return response.data;
}


export async function fetchMyBlogHistory(
  postId: string,
): Promise<BlogReviewEvent[]> {
  const response =
    await apiClient.get<BlogReviewEvent[]>(
      `/blog/mine/${postId}/history`,
    );

  return response.data;
}


/* ------------------------------------------------------------------
 * Temporary legacy admin API
 *
 * Remove once the old BlogAdminPage implementation is gone.
 * ------------------------------------------------------------------ */


export async function fetchBlogPosts():
Promise<BlogPost[]> {
  const response =
    await apiClient.get<BlogPost[]>(
      "/blog",
    );

  return response.data;
}


export async function createBlogPost(
  payload: BlogPostPayload,
): Promise<BlogPost> {
  const response =
    await apiClient.post<BlogPost>(
      "/blog",
      payload,
    );

  return response.data;
}


export async function updateBlogPost({
  id,
  data,
}: {
  id: string;
  data: Partial<BlogPostPayload>;
}): Promise<BlogPost> {
  const response =
    await apiClient.patch<BlogPost>(
      `/blog/${id}`,
      data,
    );

  return response.data;
}


export async function deleteBlogPost(
  id: string,
): Promise<void> {
  await apiClient.delete(
    `/blog/${id}`,
  );
}
