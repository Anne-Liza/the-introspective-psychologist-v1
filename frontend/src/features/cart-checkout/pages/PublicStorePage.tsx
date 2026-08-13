import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { fetchPublicCommerceItems } from "../../commerce-core/lib/commerceCoreApi";
import { CommerceItemCard } from "../components/CommerceItemCard";

export function PublicStorePage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-commerce-items"],
    queryFn: fetchPublicCommerceItems,
  });

  const categories = useMemo(
    () => ["All", ...Array.from(new Set((data || []).map((item) => item.category).filter(Boolean) as string[]))],
    [data],
  );
  const visibleItems = selectedCategory === "All"
    ? data
    : data?.filter((item) => item.category === selectedCategory);

  return (
    <main className="bg-[#fbfaf5]">
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6a7a4e]">
              Store
            </p>
            <h1 className="mt-4 font-serif text-5xl tracking-[-0.04em] text-[#26311f] md:text-6xl">
              Resources and support, thoughtfully gathered.
            </h1>
          </div>
          <p className="max-w-xl text-lg leading-8 text-[#5f6d54] lg:justify-self-end">
            Browse practical tools, books, workshops, support packages, and selected practice merchandise.
          </p>
        </div>

        {categories.length > 2 ? (
          <div className="mt-10 flex gap-2 overflow-x-auto pb-2" aria-label="Store categories">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                aria-pressed={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
                className={
                  selectedCategory === category
                    ? "whitespace-nowrap rounded-full bg-[#26311f] px-5 py-2.5 text-sm font-semibold text-white"
                    : "whitespace-nowrap rounded-full border border-[#cbd5ba] bg-white px-5 py-2.5 text-sm font-semibold text-[#52623d] hover:border-[#556b2f]"
                }
              >
                {category}
              </button>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <p className="mt-12 rounded-3xl border border-[#dfe5d6] bg-white p-6 text-[#5f6d54]">
            Loading the store…
          </p>
        ) : isError ? (
          <p className="mt-12 rounded-3xl border border-[#ead4cd] bg-[#fff8f5] p-6 text-[#7a4538]">
            The store could not be loaded. Please try again shortly.
          </p>
        ) : visibleItems?.length ? (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => <CommerceItemCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="mt-12 rounded-[2rem] border border-[#dfe5d6] bg-white p-8">
            <h2 className="font-serif text-2xl text-[#26311f]">New resources are being prepared.</h2>
            <p className="mt-3 text-sm leading-7 text-[#5f6d54]">
              Please check back soon for new tools, events, and support options.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
