import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function safeHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("/") || value.startsWith("#")) return value;

  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-5 text-base leading-8 text-[#46533f]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ children }) => (
            <h1 className="pt-3 font-serif text-4xl text-[#26311f]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="pt-5 font-serif text-3xl text-[#26311f]">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="pt-4 font-serif text-2xl text-[#26311f]">{children}</h3>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-2 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-2 pl-6">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#a8b58d] bg-[#f2f4ec] px-5 py-3 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={safeHref(href)}
              className="font-semibold text-[#4e642c] underline decoration-[#a8b58d] underline-offset-4"
              rel="noreferrer"
              target={safeHref(href)?.startsWith("http") ? "_blank" : undefined}
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-[#eef2e7] px-1.5 py-0.5 text-sm text-[#26311f]">
              {children}
            </code>
          ),
          hr: () => <hr className="border-[#dfe5d6]" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
