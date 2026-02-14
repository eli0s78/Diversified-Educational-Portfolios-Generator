/**
 * Rich text parser for AI-generated content.
 * Handles **bold** markers and inline/newline numbered lists.
 */

export interface RichSegment {
  text: string;
  bold: boolean;
}

export interface RichBlock {
  type: "paragraph" | "list-item";
  number?: number;
  segments: RichSegment[];
}

/**
 * Parse **bold** markers into segments.
 */
export function parseBoldSegments(text: string): RichSegment[] {
  const segments: RichSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  if (segments.length === 0 && text) {
    segments.push({ text, bold: false });
  }

  return segments;
}

/**
 * Parse content into rich blocks with numbered lists and bold text.
 * Handles both newline-separated and inline numbered items.
 */
export function parseRichContent(content: string): RichBlock[] {
  const blocks: RichBlock[] = [];

  // Split by newlines first
  const lines = content.split(/\n+/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line is a standalone numbered item: "1. text" or "1) text"
    const standaloneMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/);
    if (standaloneMatch && parseInt(standaloneMatch[1]) <= 50) {
      blocks.push({
        type: "list-item",
        number: parseInt(standaloneMatch[1]),
        segments: parseBoldSegments(standaloneMatch[2].trim()),
      });
      continue;
    }

    // Check for inline numbered items with bold titles:
    // "text 1. **Title:** desc 2. **Title:** desc ..."
    const inlineMatches: { index: number; number: number }[] = [];
    const inlineRegex = /(?:^|[\s:])(\d+)\.\s+\*\*/g;
    let m;
    while ((m = inlineRegex.exec(trimmed)) !== null) {
      const offset = /^[\s:]/.test(m[0]) ? 1 : 0;
      inlineMatches.push({
        index: m.index + offset,
        number: parseInt(m[1]),
      });
    }

    if (inlineMatches.length >= 2) {
      // Extract intro text before the first item
      const introText = trimmed.slice(0, inlineMatches[0].index).trim();
      if (introText) {
        blocks.push({ type: "paragraph", segments: parseBoldSegments(introText) });
      }

      // Extract each numbered item
      for (let i = 0; i < inlineMatches.length; i++) {
        const start = inlineMatches[i].index;
        const end = i < inlineMatches.length - 1
          ? inlineMatches[i + 1].index
          : trimmed.length;
        const itemText = trimmed.slice(start, end).trim();
        const numMatch = itemText.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          blocks.push({
            type: "list-item",
            number: parseInt(numMatch[1]),
            segments: parseBoldSegments(numMatch[2].trim()),
          });
        }
      }
      continue;
    }

    // Also check for inline numbered items WITHOUT bold titles:
    // "text 1. desc 2. desc 3. desc"
    const plainInlineMatches: { index: number; number: number }[] = [];
    const plainInlineRegex = /(?:^|[\s:])(\d+)\.\s+/g;
    while ((m = plainInlineRegex.exec(trimmed)) !== null) {
      const num = parseInt(m[1]);
      const offset = /^[\s:]/.test(m[0]) ? 1 : 0;
      plainInlineMatches.push({ index: m.index + offset, number: num });
    }

    // Only treat as list if we find sequential numbers starting from 1
    const isSequentialList =
      plainInlineMatches.length >= 2 &&
      plainInlineMatches[0].number === 1 &&
      plainInlineMatches.every(
        (item, i) => i === 0 || item.number === plainInlineMatches[i - 1].number + 1
      );

    if (isSequentialList) {
      const introText = trimmed.slice(0, plainInlineMatches[0].index).trim();
      if (introText) {
        blocks.push({ type: "paragraph", segments: parseBoldSegments(introText) });
      }

      for (let i = 0; i < plainInlineMatches.length; i++) {
        const start = plainInlineMatches[i].index;
        const end = i < plainInlineMatches.length - 1
          ? plainInlineMatches[i + 1].index
          : trimmed.length;
        const itemText = trimmed.slice(start, end).trim();
        const numMatch = itemText.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          blocks.push({
            type: "list-item",
            number: parseInt(numMatch[1]),
            segments: parseBoldSegments(numMatch[2].trim()),
          });
        }
      }
      continue;
    }

    // Plain paragraph (may still contain **bold**)
    blocks.push({ type: "paragraph", segments: parseBoldSegments(trimmed) });
  }

  return blocks;
}

/**
 * Get plain text from segments (strips formatting).
 */
export function segmentsToPlainText(segments: RichSegment[]): string {
  return segments.map((s) => s.text).join("");
}
