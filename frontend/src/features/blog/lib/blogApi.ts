import { apiClient } from "../../../lib/api-client";

export type BlogPostStatus = "draft" | "published";

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

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function fetchPublicBlogPosts(): Promise<BlogPost[]> {
  return (await apiClient.get("/blog/public")).data;
}

export async function fetchPublicBlogPost(slug: string): Promise<BlogPost> {
  return (await apiClient.get(`/blog/public/${slug}`)).data;
}

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  return (await apiClient.get("/blog")).data;
}

export async function createBlogPost(payload: BlogPostPayload): Promise<BlogPost> {
  return (await apiClient.post("/blog", payload)).data;
}

export async function updateBlogPost({
  id,
  data,
}: {
  id: string;
  data: Partial<BlogPostPayload>;
}): Promise<BlogPost> {
  return (await apiClient.patch(`/blog/${id}`, data)).data;
}

export async function deleteBlogPost(id: string): Promise<void> {
  await apiClient.delete(`/blog/${id}`);
}
