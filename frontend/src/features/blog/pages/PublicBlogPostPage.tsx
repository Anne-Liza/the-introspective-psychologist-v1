import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { MarkdownContent } from "../components/MarkdownContent";
import {
  fetchPublicBlogPost,
  resolveBlogCoverImageUrl,
} from "../lib/blogApi";

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function PublicBlogPostPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-blog-post", slug],
    queryFn: () => fetchPublicBlogPost(slug || ""),
    enabled: Boolean(slug),
  });

  if (isLoading) {
    return <main className="mx-auto max-w-4xl px-5 py-20 text-[#5f6d54]">Loading article…</main>;
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-20">
        <h1 className="font-serif text-4xl text-[#26311f]">Article not found</h1>
        <Link to="/blog" className="mt-6 inline-flex font-semibold text-[#4e642c] underline">
          Return to the blog
        </Link>
      </main>
    );
  }

  const coverImageUrl =
    resolveBlogCoverImageUrl(
      data.cover_image_url,
    );

  return (
    <main className="bg-[#fbfaf5]">
      <article className="mx-auto max-w-4xl px-5 py-14 lg:px-8 lg:py-20">
        <Link to="/blog" className="text-sm font-semibold text-[#4e642c] underline underline-offset-4">
          ← All articles
        </Link>

        <header className="mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6a7a4e]">
            {data.category || "Article"}
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.04] tracking-[-0.04em] text-[#26311f] md:text-6xl">
            {data.title}
          </h1>
          {data.excerpt ? (
            <p className="mt-6 text-xl leading-9 text-[#5f6d54]">{data.excerpt}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#6b7564]">
            {data.author_name ? <span>By {data.author_name}</span> : null}
            <time dateTime={data.published_at || data.created_at}>
              {displayDate(data.published_at || data.created_at)}
            </time>
          </div>
        </header>

        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={data.cover_image_alt || ""}
            className="mt-10 aspect-[16/8] w-full rounded-[2rem] object-cover shadow-sm"
          />
        ) : null}

        <div className="mt-12 rounded-[2rem] border border-[#dfe5d6] bg-white p-7 shadow-sm md:p-12">
          <MarkdownContent markdown={data.body_markdown} />
        </div>

        {data.tags.length ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {data.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[#eef2e7] px-4 py-2 text-xs font-semibold text-[#52623d]">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <aside className="mt-12 rounded-[2rem] bg-[#26311f] p-8 text-white">
          <h2 className="font-serif text-3xl">Continue exploring</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#dfe5d6]">
            Browse more articles or get in touch if you have a question about this publication.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/blog" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#26311f]">
              Read more articles
            </Link>
            <Link to="/contact" className="rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white">
              Contact us
            </Link>
          </div>
        </aside>
      </article>
    </main>
  );
}
