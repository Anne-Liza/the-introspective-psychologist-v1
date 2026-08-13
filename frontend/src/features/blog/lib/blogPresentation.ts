const WORDS_PER_MINUTE = 220;

export function estimateReadingTime(bodyMarkdown: string) {
  const wordCount = bodyMarkdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}
