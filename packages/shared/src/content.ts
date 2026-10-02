// A deliberately small Markdown subset. Raw HTML is always ordinary text.
export type Inline =
  | { kind: "text" | "bold" | "italic"; text: string }
  | { kind: "link"; text: string; href: string };
export type ContentBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbered"; items: string[] };
export function safeContentLink(href: string): boolean {
  if (/^\/(?!\/)/.test(href) && !/[\\\u0000-\u0020]/.test(href)) return true;
  try {
    const url = new URL(href);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}
export function inlineContent(text: string): Inline[] {
  const parts: Inline[] = [];
  const regex = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^\s)]+)\)/g;
  let position = 0;
  for (const match of text.matchAll(regex)) {
    if (match.index > position)
      parts.push({ kind: "text", text: text.slice(position, match.index) });
    if (match[1]) parts.push({ kind: "bold", text: match[1] });
    else if (match[2]) parts.push({ kind: "italic", text: match[2] });
    else if (safeContentLink(match[4]))
      parts.push({ kind: "link", text: match[3], href: match[4] });
    else parts.push({ kind: "text", text: match[3] });
    position = match.index + match[0].length;
  }
  if (position < text.length)
    parts.push({ kind: "text", text: text.slice(position) });
  return parts;
}
export function contentBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    const text = line.trim();
    if (!text) {
      blocks.push({ kind: "paragraph", text: "" });
      continue;
    }
    if (text.startsWith("### "))
      blocks.push({ kind: "h3", text: text.slice(4) });
    else if (text.startsWith("## "))
      blocks.push({ kind: "h2", text: text.slice(3) });
    else if (/^[-*] /.test(text) || /^\d+\. /.test(text)) {
      const kind = /^\d+/.test(text) ? "numbered" : "bullets";
      const item = text.replace(/^(?:[-*]|\d+\.) /, "");
      const previous = blocks.at(-1);
      if (previous?.kind === kind) previous.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else {
      const previous = blocks.at(-1);
      if (previous?.kind === "paragraph" && previous.text)
        previous.text += `\n${text}`;
      else blocks.push({ kind: "paragraph", text });
    }
  }
  return blocks.filter((block) => block.kind !== "paragraph" || block.text);
}
