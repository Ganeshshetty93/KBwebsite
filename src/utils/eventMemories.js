export function normalizeEventMemories(value, { includeDisabled = true } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 40)
    .map((item, index) => ({
      id: String(item?.id || `event-memory-${index + 1}`),
      image: String(item?.image || '').trim(),
      title: String(item?.title || '').trim().slice(0, 120),
      date: String(item?.date || 'Past celebration').trim().slice(0, 80),
      alt: String(item?.alt || item?.title || '').trim().slice(0, 180),
      enabled: item?.enabled !== false
    }))
    .filter((item) => item.image && (includeDisabled || item.enabled));
}
