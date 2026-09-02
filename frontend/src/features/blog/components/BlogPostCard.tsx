import { Link } from "react-router";

import {
  resolveBlogCoverImageUrl,
  type BlogPost,
} from "../lib/blogApi";
import { estimateReadingTime } from "../lib/blogPresentation";

export function BlogPostCard({ post }: { post: BlogPost }) {
  const readingTime = estimateReadingTime(post.body_markdown);
  const coverImageUrl =
    resolveBlogCoverImageUrl(
      post.cover_image_url,
    );

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#d8dfcd] bg-[#fffdf8] shadow-[0_18px_50px_rgba(38,49,31,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_65px_rgba(38,49,31,0.12)]">
      {coverImageUrl ? (
        <img
          src={coverImageUrl}
          alt={post.cover_image_alt || ""}
          className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="aspect-[16/9] bg-[radial-gradient(circle_at_top_left,_#cdd8ba,_transparent_38%),linear-gradient(145deg,_#edf1e6,_#f7f1e7)]" />
      )}

      <div className="flex flex-1 flex-col p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#718052]">
          <span>{post.category || "Article"}</span>
          <span className="text-[#7d7466]">{readingTime} min read</span>
        </div>

        <h2 className="mt-5 font-serif text-3xl leading-[1.08] tracking-[-0.025em] text-[#26311f]">
          <Link to={`/blog/${post.slug}`} className="transition group-hover:text-[#556b2f]">
            {post.title}
          </Link>
        </h2>

        {post.excerpt ? (
          <p className="mt-5 line-clamp-3 text-sm leading-7 text-[#655f54]">{post.excerpt}</p>
        ) : null}

        <Link
          to={`/blog/${post.slug}`}
          className="mt-auto inline-flex pt-7 text-sm font-semibold text-[#4e642c] underline decoration-[#b5c39a] underline-offset-4"
        >
          Read article
        </Link>
      </div>
    </article>
  );
}
