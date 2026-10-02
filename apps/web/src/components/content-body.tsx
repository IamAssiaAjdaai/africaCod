import { contentBlocks, inlineContent } from "@africacod/shared/content";
function Inline({ text }: { text: string }) {
  return inlineContent(text).map((part, index) =>
    part.kind === "bold" ? (
      <strong key={index}>{part.text}</strong>
    ) : part.kind === "italic" ? (
      <em key={index}>{part.text}</em>
    ) : part.kind === "link" ? (
      <a key={index} href={part.href} rel="noopener noreferrer">
        {part.text}
      </a>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );
}
export function ContentBody({ content }: { content: string }) {
  return (
    <div className="content-body">
      {contentBlocks(content).map((block, index) =>
        block.kind === "h2" ? (
          <h2 key={index}>
            <Inline text={block.text} />
          </h2>
        ) : block.kind === "h3" ? (
          <h3 key={index}>
            <Inline text={block.text} />
          </h3>
        ) : block.kind === "paragraph" ? (
          <p key={index}>
            <Inline text={block.text} />
          </p>
        ) : block.kind === "bullets" ? (
          <ul key={index}>
            {block.items.map((text, i) => (
              <li key={i}>
                <Inline text={text} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={index}>
            {block.items.map((text, i) => (
              <li key={i}>
                <Inline text={text} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
