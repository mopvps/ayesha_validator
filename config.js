// Rule config: id, name, description, enabled, severity, category
window.RULES_CONFIG = [
  {
    id: 'multi-space',
    name: 'Multiple space check',
    description: 'Flags 2 or more consecutive spaces or tab characters found in visible text content',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Typography'
  },
  {
    id: 'invalid-char-spacing',
    name: 'Invalid character spacing',
    description: 'Flags missing spaces after dots, numbers followed by letters, and lowercase followed by uppercase in visible text content.',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Typography'
  },
  {
    id: 'paragraph-start-case',
    name: 'Paragraph start case',
    description: 'Flags block-level elements whose visible text begins with a lowercase letter.',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Typography'
  },
  {
    id: 'duplicate-id',
    name: 'Duplicate ID check',
    description: 'Flags any id attribute value that appears more than once in the document.',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Structure'
  },
  {
    id: 'pagebreak-sequence',
    name: 'Pagebreak sequence check',
    description: 'Flags pagebreak tags whose page number is out of sequence.',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Structure'
  },
  {
    id: 'italic-paren-start',
    name: 'Italic parenthesis check',
    description: 'Flags italic tags whose text starts with "(" or ends with ")".',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Typography'
  },
  {
    id: 'sup-sequence',
    name: 'Superscript sequence check',
    description: 'Flags superscript tags whose numeric value is out of sequence. Starts after </header>, stops before the footnotes section. Non-numeric sup values are ignored.',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Structure'
  },
  {
    id: 'raw-entity',
    name: 'Raw character entity check',
    description: 'Flags characters that should be encoded as HTML entities but appear as raw characters in the text.',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Entities'
  },
  {
    id: 'encoded-entity',
    name: 'Encoded entity check',
    description: 'Warns when &#x27; or &#39; encoded apostrophe entities are found in the file.',
    enabled: false,
    hidden: true,
    severity: 'warn',
    category: 'Entities'
  },
  {
    id: 'file-size',
    name: 'File Size Limit',
    description: 'File must not exceed 300KB',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Structure'
  },
  {
    id: 'para-end-punctuation',
    name: 'Paragraph End Punctuation',
    description: 'Every <p> tag must end with . or ; before closing',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Typography'
  },
  {
    id: 'li-span-between',
    name: 'Span Between List Items',
    description: 'A <span> tag must not appear between </li> and <li>',
    enabled: false,
    hidden: true,
    severity: 'error',
    category: 'Structure'
  },
  {
    id: 'unlinked-reference',
    name: 'Missing Hyperlink on Reference Text',
    description: 'Flags cross-reference keywords (Figure, Table, Ch. etc.) followed by a number that are not wrapped in an <a> tag',
    enabled: false,
    hidden: true,
    severity: 'warn',
    category: 'Links & Refs'
  },
  {
    id: 'raw-url',
    name: 'Raw URL in Text',
    description: 'Flags raw URLs (http, https, www, ftp, mailto) found in visible text content',
    enabled: false,
    hidden: true,
    severity: 'warn',
    category: 'Links & Refs'
  },
{
  id: 'body-top-level-div',
  name: 'Body top-level element check',
  description: 'Flags when the first child element inside <body> is not a <div>.',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Structure'
},
{
  id: 'forbidden-tags',
  name: 'Forbidden tags check',
  description: 'Flags usage of <section>, <em>, <strong>, <dl>, <dt>, <dd> and <br/> inside poetry sections.',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Structure'
},
{
  id: 'heading-skip-level',
  name: 'Heading level skip check',
  description: 'Flags when heading levels are skipped (e.g. h1 directly followed by h3).',
  enabled: true,
  hidden: false,
  severity: 'warn',
  category: 'Structure'
},
{
  id: 'untitled-chapter-div',
  name: 'Untitled chapter div check',
  description: 'Flags when a file has no headings and the top-level div is missing role="doc-chapter" and aria-label.',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Structure'
},
{
  id: 'pagebreak-format',
  name: 'Page break format check',
  description: 'Flags pagebreak spans missing required attributes or incorrect id format. Checks for self-closing span, id="page_X", epub:type="pagebreak", role="doc-pagebreak" and title attribute.',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Structure'
},
{
  id: 'ellipsis-check',
  name: 'Ellipsis format check',
  description: 'Flags three dots used instead of ellipsis character (…), missing space after ellipsis+period, and missing space after colon before ellipsis.',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Typography'
},
{
  id: 'quotation-marks-check',
  name: 'Quotation marks check',
  description: 'Flags straight quotes instead of smart quotes, and missing thin space (&#x2009;) between adjacent quotation marks.',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Typography'
},
{
  id: 'space-indentation-check',
  name: 'Space indentation check',
  description: 'Flags paragraphs or block elements that use space characters or &nbsp; for indentation instead of CSS.',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Typography'
},
{
  id: 'nbsp-abbreviation-check',
  name: 'Non-breaking space abbreviation check',
  description: 'Flags honorifics, time, era and speed abbreviations that use a regular space instead of a non-breaking space (&#x00A0;).',
  enabled: true,
  hidden: false,
  severity: 'warn',
  category: 'Typography'
},
{
  id: 'li-content-check',
  name: 'List item content check',
  description: 'Flags <li> elements whose direct content is not wrapped in a <p> tag.',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Structure'
},
{
  id: 'paragraph-list-role-check',
  name: 'Paragraph list role check',
  description: 'Flags div elements used as lists missing role="list" and p elements missing role="listitem".',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Structure'
},
{
  id: 'section-break-check',
  name: 'Section break format check',
  description: 'Flags <hr> tags missing class="transition" and missing <div class="transition" aria-hidden="true"> after the hr.',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Structure'
},
{
  id: 'img-class-check',
  name: 'Image class check',
  description: 'Flags <img> tags missing class="fill" or class="fill_height".',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Images'
},
{
  id: 'css-link-order',
  name: 'CSS link order check',
  description: 'Checks that prh_standard.css is linked before the title-specific CSS ([ISBN]_style.css) in the <head>.',
  enabled: true,
  hidden: false,
  severity: 'error',
  category: 'Structure'
}
];

