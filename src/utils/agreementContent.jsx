import DOMPurify from "dompurify";

const ALLOWED_AGREEMENT_TAGS = [
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "strike",
  "code",
  "blockquote",
  "hr",
  "h3",
  "h4",
  "h5",
  "h6",
];

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

export function hasAgreementHtml(text) {
  return HTML_TAG_PATTERN.test(text || "");
}

export function sanitizeAgreementHtml(html) {
  return DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: ALLOWED_AGREEMENT_TAGS,
    ALLOWED_ATTR: [],
  });
}

export function renderAgreementContent(
  content,
  {
    richClassName = "agreement-rich-body",
    plainClassName = "",
    listClassName = "",
    preservePlainTextBreaks = false,
  } = {},
) {
  if (!content) return null;

  if (hasAgreementHtml(content)) {
    return (
      <div
        className={richClassName}
        dangerouslySetInnerHTML={{ __html: sanitizeAgreementHtml(content) }}
      />
    );
  }

  const className = plainClassName || undefined;

  if (preservePlainTextBreaks) {
    return <p className={className}>{content}</p>;
  }

  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length > 1) {
    return (
      <ul className={listClassName || undefined}>
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    );
  }

  return <p className={className}>{content}</p>;
}
