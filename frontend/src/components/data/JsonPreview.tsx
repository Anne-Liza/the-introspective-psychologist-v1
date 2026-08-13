type JsonPreviewProps = { data: unknown };
export function JsonPreview({ data }: JsonPreviewProps) {
  return <pre className="max-h-[520px] max-w-full overflow-auto rounded-2xl bg-slate-950 p-4 text-sm text-white">{JSON.stringify(data, null, 2)}</pre>;
}
