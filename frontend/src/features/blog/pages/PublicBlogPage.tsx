import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { BlogPostCard } from "../components/BlogPostCard";
import { fetchPublicBlogPosts } from "../lib/blogApi";
import { estimateReadingTime } from "../lib/blogPresentation";

const INITIAL_VISIBLE_POSTS = 6;
const LOAD_MORE_INCREMENT = 6;

export function PublicBlogPage() {
  const siteName = import.meta.env.VITE_SITE_NAME || "this site";
  const [visiblePostCount, setVisiblePostCount] = useState(INITIAL_VISIBLE_POSTS);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-blog-posts"],
    queryFn: fetchPublicBlogPosts,
  });

  const posts = data || [];
  const featuredPost = useMemo(
    () => posts.find((post) => post.is_featured) || posts[0],
    [posts],
  );
  const visiblePosts = posts.slice(0, visiblePostCount);

  return (
    <main className="bg-[#fbfaf5]">
      <section className="mx-auto max-w-[90rem] px-5 py-10 md:px-8 lg:px-10 lg:py-16">
        {isLoading ? (
          <p className="rounded-3xl border border-[#dfe5d6] bg-white p-6 text-[#5f6d54]">
            Loading articles…
          </p>
        ) : isError ? (
          <p className="rounded-3xl border border-[#ead4cd] bg-[#fff8f5] p-6 text-[#7a4538]">
            Articles could not be loaded. Please try again shortly.
          </p>
        ) : featuredPost ? (
          <>
            <div className="relative overflow-hidden rounded-[2.5rem] border border-[#d8dfcd] bg-[radial-gradient(circle_at_top_right,_rgba(201,174,102,0.2),_transparent_34%),linear-gradient(135deg,_#fffdf8,_#f1eadc)] px-6 py-8 shadow-[0_24px_70px_rgba(38,49,31,0.08)] md:px-10 md:py-12 lg:grid lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-14 lg:px-16 lg:py-16">
              <div className="max-w-2xl">
                <p className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.32em] text-[#9a7a35]">
                  <span className="h-px w-12 bg-[#c9a45a]" aria-hidden="true" />
                  Journal
                </p>
                <h1 className="mt-8 font-serif text-6xl leading-[0.9] tracking-[-0.055em] text-[#26311f] sm:text-7xl lg:text-[6.2rem]">
                  Practice
                  <span className="block text-[#8a9b65]">Insights</span>
                </h1>
                <p className="mt-8 max-w-xl text-lg leading-8 text-[#655f54] md:text-xl md:leading-9">
                  Therapist-led reflections, practical resources, and gentle guidance from {siteName}.
                </p>
              </div>

              <article className="relative mt-10 overflow-hidden rounded-[2rem] bg-[#22301f] px-6 py-8 text-white shadow-[0_28px_70px_rgba(27,36,24,0.25)] md:px-10 md:py-11 lg:mt-0">
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-[#b4c593]/20" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#cbb47b]">
                  Featured article
                </p>
                <h2 className="relative mt-7 font-serif text-4xl leading-[1.05] tracking-[-0.035em] md:text-5xl">
                  <Link to={`/blog/${featuredPost.slug}`} className="transition hover:text-[#e4ddc9]">
                    {featuredPost.title}
                  </Link>
                </h2>
                {featuredPost.excerpt ? (
                  <p className="relative mt-6 line-clamp-3 text-base leading-8 text-[#e2e7dc]">
                    {featuredPost.excerpt}
                  </p>
                ) : null}
                <div className="relative mt-8 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#b9c4b1]">
                  <span>{featuredPost.category || "Article"}</span>
                  <span className="text-[#c9a45a]" aria-hidden="true">/</span>
                  <span>{estimateReadingTime(featuredPost.body_markdown)} min read</span>
                </div>
                <Link
                  to={`/blog/${featuredPost.slug}`}
                  className="relative mt-9 inline-flex items-center gap-4 rounded-full bg-[#f3efe5] px-6 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-[#26311f] transition hover:bg-white"
                >
                  Read featured article
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </article>
            </div>

            <section className="py-16 lg:py-24" aria-labelledby="latest-insights-heading">
              <div className="flex flex-col gap-5 border-b border-[#d8dfcd] pb-8 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#718052]">
                    From the journal
                  </p>
                  <h2 id="latest-insights-heading" className="mt-3 font-serif text-4xl tracking-[-0.035em] text-[#26311f] md:text-5xl">
                    Latest insights
                  </h2>
                </div>
                <p className="max-w-md text-sm leading-7 text-[#655f54]">
                  Explore ideas for beginning therapy, choosing support, and making space for reflection.
                </p>
              </div>

              <div className="mt-10 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
                {visiblePosts.map((post) => (
                  <BlogPostCard key={post.id} post={post} />
                ))}
              </div>

              {visiblePostCount < posts.length ? (
                <div className="mt-12 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisiblePostCount((count) => count + LOAD_MORE_INCREMENT)}
                    className="rounded-full border border-[#9a7a35] px-8 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-[#80642c] transition hover:bg-[#26311f] hover:text-white"
                  >
                    Load more
                  </button>
                </div>
              ) : null}
            </section>
          </>
        ) : (
          <div className="rounded-[2rem] border border-[#dfe5d6] bg-white p-8">
            <h2 className="font-serif text-2xl text-[#26311f]">New articles are being prepared.</h2>
            <p className="mt-3 text-sm leading-7 text-[#5f6d54]">
              Please check back soon for new writing and resources.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
