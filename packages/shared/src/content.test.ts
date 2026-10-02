import { it, expect } from "vitest";
import { contentBlocks, inlineContent, safeContentLink } from "./content";
it("supports paragraphs, H2/H3, bullet and numbered lists", () => {
  expect(
    contentBlocks(
      "First paragraph\ncontinues here\n\n## Heading\n### Subheading\n- One\n- Two\n\n1. First\n2. Second",
    ),
  ).toEqual([
    { kind: "paragraph", text: "First paragraph\ncontinues here" },
    { kind: "h2", text: "Heading" },
    { kind: "h3", text: "Subheading" },
    { kind: "bullets", items: ["One", "Two"] },
    { kind: "numbered", items: ["First", "Second"] },
  ]);
});
it("supports bold, italic and safe links", () => {
  expect(
    inlineContent("**Bold** *italic* [Help](https://example.com/help)").filter(
      (p) => p.kind !== "text",
    ),
  ).toEqual([
    { kind: "bold", text: "Bold" },
    { kind: "italic", text: "italic" },
    { kind: "link", text: "Help", href: "https://example.com/help" },
  ]);
});
it("treats raw HTML as text and rejects unsafe links", () => {
  expect(contentBlocks("<script>alert(1)</script>")[0]).toEqual({
    kind: "paragraph",
    text: "<script>alert(1)</script>",
  });
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "//evil.example",
    "/\\evil.example",
    "javascript&#58;bad",
  ])
    expect(safeContentLink(href)).toBe(false);
  expect(inlineContent("[Bad](javascript:bad)")).toEqual([
    { kind: "text", text: "Bad" },
  ]);
  expect(safeContentLink("/safe-path")).toBe(true);
});
