export function highlightSegments(label: string, q: string): { text: string; match: boolean }[] {
  const lowerQuery = q.toLowerCase();
  const idx = lowerQuery ? label.toLowerCase().indexOf(lowerQuery) : -1;
  if (idx === -1) return [{ text: label, match: false }];

  // Lowercasing can expand a character. Map each lowercase code unit back
  // to the whole original character so slicing keeps the label intact.
  const offsets: { start: number; end: number }[] = [];
  let original = 0;
  for (const character of label) {
    const end = original + character.length;
    for (let i = 0; i < character.toLowerCase().length; i += 1) {
      offsets.push({ start: original, end });
    }
    original = end;
  }
  const start = offsets[idx]!.start;
  const end = offsets[idx + lowerQuery.length - 1]!.end;
  return [
    ...(start > 0 ? [{ text: label.slice(0, start), match: false }] : []),
    { text: label.slice(start, end), match: true },
    ...(end < label.length ? [{ text: label.slice(end), match: false }] : []),
  ];
}
