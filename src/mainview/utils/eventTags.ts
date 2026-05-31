export const normalizeTags = (tags?: string[] | null) => {
  const unique = new Set<string>();
  for (const tag of tags ?? []) {
    const normalized = tag.trim();
    if (normalized) {
      unique.add(normalized);
    }
  }
  return [...unique];
};

export const parseTagInput = (value: string) =>
  normalizeTags(
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  );

export const collectTags = (events: { tags?: string[] }[]) => {
  const tags = new Set<string>();
  for (const event of events) {
    for (const tag of normalizeTags(event.tags)) {
      tags.add(tag);
    }
  }
  return [...tags];
};

export const formatTags = (tags?: string[]) =>
  normalizeTags(tags)
    .map((tag) => `#${tag}`)
    .join(" ");

export const eventMatchesTagFilters = (
  event: { tags?: string[] },
  tagFilters: Record<string, boolean>,
) => {
  const tags = normalizeTags(event.tags);
  if (tags.length === 0) {
    return true;
  }

  return tags.some((tag) => tagFilters[tag] ?? true);
};
