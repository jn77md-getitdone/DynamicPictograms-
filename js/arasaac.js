// Online pictogram search using ARASAAC (https://arasaac.org), a large, free
// library of AAC pictograms that show actions clearly.
// Licence: CC BY-NC-SA. Author: Sergio Palao. Owner: Government of Aragón (Spain).
// The app shows this attribution in Settings and wherever ARASAAC images are offered.

export const ARASAAC_CREDIT = 'Pictograms by Sergio Palao. Origin: ARASAAC (arasaac.org). Licence: CC BY-NC-SA. Owner: Government of Aragón (Spain).';

export function arasaacImageUrl(id) {
  return `https://static.arasaac.org/pictograms/${id}/${id}_300.png`;
}

export async function searchArasaac(query, lang = 'en') {
  const q = query.trim();
  if (!q) return [];
  const url = `https://api.arasaac.org/v1/pictograms/${encodeURIComponent(lang)}/search/${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const items = await res.json();
  return items.slice(0, 40).map(item => ({
    id: item._id,
    label: (item.keywords && item.keywords[0] && item.keywords[0].keyword) || q,
    url: arasaacImageUrl(item._id),
  }));
}
