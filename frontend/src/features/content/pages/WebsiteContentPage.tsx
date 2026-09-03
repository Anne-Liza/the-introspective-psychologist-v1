import {
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router";

import { cmsPages } from "../lib/pageCms";

export function WebsiteContentPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-500">
          Public website
        </p>

        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          Website Content
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Choose a page to edit the content visitors see.
          Page layouts and responsive design are handled by
          the website.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {cmsPages.map((page) => (
          <article
            key={page.key}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Website page
                </p>

                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {page.label}
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {page.description}
                </p>
              </div>

              <a
                href={page.publicPath}
                target="_blank"
                rel="noreferrer"
                aria-label={`View ${page.label} page`}
                className="rounded-full border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-xs text-slate-500">
                {page.sections.length + (page.key === "contact" ? 1 : 0)} editable sections
              </p>

              <Link
                to={`/dashboard/content/${page.key}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Edit {page.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
