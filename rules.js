// Rule functions: (parsed) => [{ ruleId, line, col, message, detail }]
function isInsideEntity(line, col) {
  // Check if the character at col is part of an HTML entity
  // Hex entity: &#x...;
  // Decimal entity: &#...;
  // Named entity: &...;
  // Scan backwards from col to find '&', then forward to find ';'
  // If pattern matches &...;, &#...; or &#x...; return true
  let start = col;
  while (start >= 0 && line[start] !== '&') start--;
  if (start < 0) return false;
  if (line[start] !== '&') return false;
  let end = col;
  while (end < line.length && line[end] !== ';') end++;
  if (end >= line.length) return false;
  const entity = line.slice(start, end + 1);
  if (/^&#x[0-9A-Fa-f]+;$/.test(entity)) return true;
  if (/^&#[0-9]+;$/.test(entity)) return true;
  if (/^&[a-zA-Z]+;$/.test(entity)) return true;
  return false;
}

window.RULES = {
  'multi-space'(parsed) {
    const results = [];
    const { lines, textMask } = parsed;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const mask = textMask[i];

      for (let c = 0; c < line.length; c++) {
        // --- existing: multiple spaces ---
        if (mask[c] && line[c] === ' ' && mask[c + 1] && line[c + 1] === ' ') {
          if (isInsideEntity(line, c)) continue;
          let runEnd = c;
          while (runEnd + 1 < line.length && line[runEnd + 1] === ' ' && mask[runEnd + 1]) runEnd++;
          const length = runEnd - c + 1;
          const snipS = Math.max(0, c - 20);
          const snipE = Math.min(line.length, c + 20);
          results.push({
            ruleId: 'multi-space', line: i + 1, col: c + 1, length,
            message: 'Multiple spaces found in text content',
            detail: line.slice(snipS, snipE).trim() || '(blank text)'
          });
          c = runEnd;
          continue;
        }

        // --- existing: tab ---
        if (mask[c] && line[c] === '\t') {
          if (isInsideEntity(line, c)) continue;
          const snipS = Math.max(0, c - 20);
          const snipE = Math.min(line.length, c + 20);
          results.push({
            ruleId: 'multi-space', line: i + 1, col: c + 1, length: 1,
            message: 'Tab character found in text content',
            detail: line.slice(snipS, snipE).trim() || '(blank text)'
          });
          continue;
        }

        if (mask[c] && line[c] === ' ' && c > 0 && line[c - 1] === '>') {
          // Find the '<' that belongs to this '>' by scanning backwards simply
          let t = c - 2;
          while (t >= 0 && line[t] !== '<') t--;
          if (t < 0) continue;
          const tagChunk = line.slice(t + 1, c - 1).trim();
          const isClosing = tagChunk.startsWith('/');
          if (isClosing) continue; // </tag> space after = always normal
          const tagName = tagChunk.split(/[\s>\/]/)[0].toLowerCase();
          const snipS = Math.max(0, c - 20);
          const snipE = Math.min(line.length, c + 20);
          results.push({
            ruleId: 'multi-space', line: i + 1, col: c + 1, length: 1,
            message: 'Space found immediately after tag opening',
            detail: line.slice(snipS, snipE).trim() || '(blank text)'
          });
          continue;
        }

        if (mask[c] && line[c] === ' ' && c + 1 < line.length && line[c + 1] === '<') {
          // Only flag if previous visible char is a word character (not another tag boundary)
          let prevChar = '';
          for (let p = c - 1; p >= 0; p--) {
            if (mask[p]) { prevChar = line[p]; break; }
          }
          if (!prevChar || !/[a-zA-Z0-9.,;:!?'")\]]/.test(prevChar)) continue;

          const isClosing = line[c + 2] === '/';
          if (!isClosing) continue;
          const afterLt = line.slice(c + 3).trim();
          const tagName = afterLt.split(/[\s>\/]/)[0].toLowerCase();
          const SKIP_TAGS = ['a', 'sup', 'sub'];
          if (SKIP_TAGS.includes(tagName)) continue;
          const snipS = Math.max(0, c - 20);
          const snipE = Math.min(line.length, c + 20);
          results.push({
            ruleId: 'multi-space', line: i + 1, col: c + 1, length: 1,
            message: 'Space found immediately before tag closing',
            detail: line.slice(snipS, snipE).trim() || '(blank text)'
          });
          continue;
        }
      }
    }

    return results;
  },

  'invalid-char-spacing'(parsed) {
    const results = [];
    const { lines, textMask } = parsed;

    const isDigit = ch => ch >= '0' && ch <= '9';
    const isLower = ch => ch >= 'a' && ch <= 'z';
    const isUpper = ch => ch >= 'A' && ch <= 'Z';
    const isLetter = ch => isLower(ch) || isUpper(ch);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const mask = textMask[i];

      for (let c = 0; c < line.length - 1; c++) {
        if (!mask[c] || !mask[c + 1]) continue;
        if (isInsideEntity(line, c)) continue;

        const a = line[c];
        const b = line[c + 1];

        const start = Math.max(0, c - 20);
        const end = Math.min(line.length, c + 20);
        const snippet = line.slice(start, end).trim();

        if (isDigit(a) && isLetter(b)) {
          // Skip ordinal suffixes: 1st, 2nd, 3rd, 4th...nth
          const twoChar = (b + (line[c + 2] || '')).toLowerCase();
          const isOrdinal = twoChar === 'st' || twoChar === 'nd' || twoChar === 'rd' || twoChar === 'th';
          // Skip decade/era patterns: 1690s, 1800s etc. (digit followed by 's' then non-letter)
          const isDecadeS = (b === 's' || b === 'S') && (!line[c + 2] || !isLetter(line[c + 2]));
          if (isOrdinal || isDecadeS) continue;
          results.push({
            ruleId: 'invalid-char-spacing',
            line: i + 1,
            col: c + 1,
            length: 2,
            message: 'Number directly followed by letter without space',
            detail: snippet || '(blank text)'
          });
          continue;
        }

        if (isLower(a) && isUpper(b)) {
          results.push({
            ruleId: 'invalid-char-spacing',
            line: i + 1,
            col: c + 1,
            length: 2,
            message: 'Lowercase letter directly followed by uppercase without space',
            detail: snippet || '(blank text)'
          });
          continue;
        }

        if (a === '.' && (isLetter(b) || isDigit(b))) {
          const prev = c > 0 ? line[c - 1] : '';
          const isDecimal = isDigit(prev) && isDigit(b);

          results.push({
            ruleId: 'invalid-char-spacing',
            line: i + 1,
            col: c + 1,
            length: 2,
            severity: isDecimal ? 'warn' : 'error',
            message: isDecimal
              ? 'Decimal number — check if space is needed'
              : 'Dot not followed by a space',
            detail: snippet || '(blank text)'
          });
        }
      }
    }

    return results;
  },

  'paragraph-start-case'(parsed) {
    const results = [];
    if (!parsed.dom) return results;

    const BLOCK_TAGS = 'p,div,h1,h2,h3,h4,h5,h6,li,blockquote,td,th';
    const SKIP = /^[\s\d\.,\-\(\)\[\]"';:!?\/\\@#%\*_\+=~\^\{\}\|<>&]/;

    const body = parsed.dom.querySelector('body');
    if (!body) return results;
    // Skip if dom parse put content outside body
    const bodyText = body.textContent.trim();
    if (!bodyText) return results;

    const els = body.querySelectorAll(BLOCK_TAGS);
    els.forEach(el => {
      if (['TITLE','HEAD','SCRIPT','STYLE'].includes(el.tagName.toUpperCase())) return;

      // Skip if this element contains other block elements — only check leaf blocks
      const BLOCK_TAG_NAMES = ['P','DIV','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','TD','TH'];
      const hasBlockChild = Array.from(el.children).some(c => BLOCK_TAG_NAMES.includes(c.tagName.toUpperCase()));
      if (hasBlockChild) return;

      // Get only the FIRST non-empty direct text node
      const firstTextNode = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '')
        [0];

      // If no direct text node, check if first child is an inline element (span, em, strong, a)
      // and get its text as the opener
      const INLINE = ['SPAN','EM','STRONG','A','B','I','U','SUB','SUP'];
      let ownText = '';
      if (firstTextNode) {
        ownText = firstTextNode.textContent.trim();
      } else {
        const firstInline = Array.from(el.children)
          .find(c => INLINE.includes(c.tagName.toUpperCase()));
        if (firstInline) ownText = firstInline.textContent.trim();
      }

      if (!ownText) return;

      const first = ownText[0];
      if (SKIP.test(first)) return;
      if (first >= 'A' && first <= 'Z') return;
      if (first >= 'a' && first <= 'z') {
        const needle = ownText.slice(0, 20);
        let lineNum = 1, colNum = 1;
        outer: for (let i = 0; i < parsed.lines.length; i++) {
          const line = parsed.lines[i];
          const mask = parsed.textMask[i];
          if (!mask) continue;
          let searchFrom = 0;
          while (true) {
            const idx = line.indexOf(needle, searchFrom);
            if (idx === -1) break;
            if (mask[idx]) {
              // Only accept if this position is at start of visible text run
              // i.e. char before is either start of line, or previous char is not visible text
              const prevVisible = idx > 0 && mask[idx - 1];
              if (!prevVisible) {
                lineNum = i + 1;
                colNum = idx + 1;
                break outer;
              }
            }
            searchFrom = idx + 1;
          }
        }

        const rawLine = parsed.lines[lineNum - 1] || '';
        if (
          rawLine.includes('<?xml') ||
          rawLine.includes('<!DOCTYPE') ||
          rawLine.includes('<html') ||
          rawLine.includes('<head')
        ) return;

        results.push({
          ruleId: 'paragraph-start-case',
          line: lineNum,
          col: colNum,
          length: 1,
          message: 'Block element starts with a lowercase letter',
          detail: ownText.slice(0, 40)
        });
      }
    });
    return results;
  },

  'duplicate-id'(parsed) {
    const results = [];
    if (!parsed.dom) return results;

    const body = parsed.dom.querySelector('body');
    if (!body) return results;

    const all = body.querySelectorAll('[id]');
    const seen = {};

    // Find all line numbers for each id
    parsed.lines.forEach((line, i) => {
      const regex = /id="([^"]+)"/g;
      let match;
      while ((match = regex.exec(line)) !== null) {
        const id = match[1];
        if (!seen[id]) seen[id] = [];
        seen[id].push(i + 1);
      }
    });

    Object.entries(seen).forEach(([id, lines]) => {
      if (lines.length < 2) return;
      results.push({
        ruleId: 'duplicate-id',
        line: lines[0],
        col: 1,
        length: 1,
        message: `"${id}"`,
        detail: lines.join(', ')
      });
    });

    return results;
  },

  'pagebreak-sequence'(parsed) {
    const results = [];

    const romanToInt = r => {
      const map = { i:1, v:5, x:10, l:50, c:100, d:500, m:1000 };
      let val = 0, prev = 0;
      for (const ch of r.toLowerCase().split('').reverse()) {
        const cur = map[ch] || 0;
        val += cur < prev ? -cur : cur;
        prev = cur;
      }
      return val;
    };

    const intToRoman = (num, uppercase = false) => {
      const lookup = [
        [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
        [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
        [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
      ];
      let res = '';
      for (const [val, char] of lookup) {
        while (num >= val) {
          res += char;
          num -= val;
        }
      }
      return uppercase ? res.toUpperCase() : res;
    };

    const isRoman = str => /^(?=[ivxlcdm])m{0,4}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/i.test(str);

    const parsePageNum = val => {
      if (/^\d+$/.test(val)) {
        return { type: 'numeric', value: parseInt(val, 10), raw: val };
      }
      if (isRoman(val)) {
        return { type: 'roman', value: romanToInt(val), raw: val, isUpper: val === val.toUpperCase() };
      }
      return null;
    };

    // Scan lines for pagebreak tags
    const pages = [];
    const pagebreakTagRegex = /<[^>]*?(?:pagebreak|role=["']doc-pagebreak["']|epub:type=["']pagebreak["']|id=["'](?:page|pb)[_-]?\w+["'])[^>]*?>/gi;
    const idRegex = /id=["']([^"']+)["']/i;

    parsed.lines.forEach((line, i) => {
      let tagMatch;
      // Reset regex index per line
      pagebreakTagRegex.lastIndex = 0;
      while ((tagMatch = pagebreakTagRegex.exec(line)) !== null) {
        const tagStr = tagMatch[0];
        const idMatch = tagStr.match(idRegex);
        if (!idMatch) continue;

        const rawId = idMatch[1];
        const pageVal = rawId.replace(/^(?:page|pb)[_-]?/i, '');
        const parsed2 = parsePageNum(pageVal);
        if (!parsed2) continue;

        const col = tagMatch.index + 1;
        pages.push({ ...parsed2, rawId, line: i + 1, col, length: tagStr.length });
      }
    });

    // Check sequence
    for (let i = 0; i < pages.length - 1; i++) {
      const cur = pages[i];
      const next = pages[i + 1];
      if (cur.type !== next.type) continue;
      if (next.value !== cur.value + 1) {
        let expectedRaw = '';
        if (cur.type === 'roman') {
          expectedRaw = intToRoman(cur.value + 1, cur.isUpper);
        } else {
          const expectedVal = cur.value + 1;
          if (cur.raw.startsWith('0') && cur.raw.length > 1) {
            expectedRaw = String(expectedVal).padStart(cur.raw.length, '0');
          } else {
            expectedRaw = String(expectedVal);
          }
        }

        results.push({
          ruleId: 'pagebreak-sequence',
          line: next.line,
          col: next.col || 1,
          length: next.length || 1,
          message: `Page "${next.raw}" is out of sequence — expected "${expectedRaw}" after "${cur.raw}"`,
          detail: `page_${next.raw}`
        });
      }
    }

    return results;
  },

  'italic-paren-start'(parsed) {
    const results = [];
    if (!parsed.dom) return results;

    const body = parsed.dom.querySelector('body');
    if (!body) return results;

    const italics = body.querySelectorAll('i');
    italics.forEach(el => {
      const text = el.textContent.trim();
      const startsWithParen = text[0] === '(';
      const endsWithParen = text[text.length - 1] === ')';
      if (!startsWithParen && !endsWithParen) return;

      const needleStart = startsWithParen ? `<i>${text.slice(0, 15)}` : text.slice(-15);
      let lineNum = 1, colNum = 1;
      for (let i = 0; i < parsed.lines.length; i++) {
        const idx = parsed.lines[i].indexOf(needleStart);
        if (idx !== -1) { lineNum = i + 1; colNum = idx + 1; break; }
      }

      results.push({
        ruleId: 'italic-paren-start',
        line: lineNum,
        col: colNum,
        length: 1,
        message: startsWithParen
          ? 'Italic tag starts with "(" — opening parenthesis should not be italicised'
          : 'Italic tag ends with ")" — closing parenthesis should not be italicised',
        detail: text.slice(0, 40)
      });
    });

    return results;
  },

  'sup-sequence'(parsed) {
    const results = [];

    // Find header end line
    let headerEndLine = 0;
    for (let i = 0; i < parsed.lines.length; i++) {
      if (parsed.lines[i].includes('</header>')) { headerEndLine = i + 1; break; }
    }

    // Find footnotes start line
    let footnotesStartLine = Infinity;
    for (let i = 0; i < parsed.lines.length; i++) {
      if (
        parsed.lines[i].includes('epub:type="footnotes"') ||
        parsed.lines[i].includes("epub:type='footnotes'")
      ) { footnotesStartLine = i + 1; break; }
    }

    // Scan raw lines directly — no DOM needed
    const numericSups = [];
    const supRegex = /<sup[^>]*>([\s\S]*?)<\/sup>/g;

    for (let i = 0; i < parsed.lines.length; i++) {
      const lineNum = i + 1;
      if (lineNum <= headerEndLine) continue;
      if (lineNum >= footnotesStartLine) break;

      let match;
      const line = parsed.lines[i];
      supRegex.lastIndex = 0;
      while ((match = supRegex.exec(line)) !== null) {
        // Strip any inner tags to get plain text
        const text = match[1].replace(/<[^>]+>/g, '').trim();
        const n = parseInt(text, 10);
        // Skip non-pure-number
        if (isNaN(n) || String(n) !== text) continue;
        const colNum = match.index + 1;
        numericSups.push({ value: n, raw: text, line: lineNum, col: colNum });
      }
    }

    // Check sequence
    for (let i = 0; i < numericSups.length - 1; i++) {
      const cur = numericSups[i];
      const next = numericSups[i + 1];
      if (next.value !== cur.value + 1) {
        results.push({
          ruleId: 'sup-sequence',
          line: next.line,
          col: next.col,
          length: 1,
          message: `Superscript "${next.raw}" is out of sequence — expected "${cur.value + 1}" after "${cur.raw}"`,
          detail: `sup: ${next.raw}`
        });
      }
    }

    return results;
  },

  'raw-entity'(parsed) {
    const results = [];
    if (!window.ENTITY_MAP || Object.keys(window.ENTITY_MAP).length === 0) return results;

    const raw = parsed.raw;

    // Step 1: Strip tags to get text outside tags
    const textOutsideTags = raw.replace(/<[^>]+>/g, '');

    // Step 2: Strip all valid encoded entity tokens to get plain text only
    const tokenPattern = /&#x[0-9A-Za-z]*;|&#[0-9A-Za-z]*;|&[a-zA-Z][a-zA-Z0-9]*;/g;
    const textOnly = textOutsideTags.replace(tokenPattern, '');

    // Step 3: Build a set of characters that appear in textOnly
    const charsInText = new Set(textOnly);

    // Step 4: For each entity char found in textOnly, locate it in original lines
    for (const [ch, entity] of Object.entries(window.ENTITY_MAP)) {
      if (!ch || !charsInText.has(ch)) continue;

      for (let i = 0; i < parsed.lines.length; i++) {
        const line = parsed.lines[i];
        const mask = parsed.textMask[i];

        let searchFrom = 0;
        while (true) {
          const idx = line.indexOf(ch, searchFrom);
          if (idx === -1) break;

          // Only flag if in visible text (not inside a tag)
          if (!mask[idx]) { searchFrom = idx + 1; continue; }

          // Skip if inside an encoded entity
          if (isInsideEntity(line, idx)) { searchFrom = idx + 1; continue; }

          const snipS = Math.max(0, idx - 20);
          const snipE = Math.min(line.length, idx + ch.length + 20);

          results.push({
            ruleId: 'raw-entity',
            line: i + 1,
            col: idx + 1,
            length: ch.length,
            message: `Raw character "${ch}" should be encoded as ${entity.decimal} or ${entity.hex} or ${entity.character}`,
            detail: line.slice(snipS, snipE).trim() || '(blank text)'
          });

          searchFrom = idx + ch.length;
        }
      }
    }

    return results;
  },

  'encoded-entity'(parsed) {
    const results = [];

    // Only check for these exact tokens
    const watchTokens = ['&#x27;', '&#39;'];

    for (let i = 0; i < parsed.lines.length; i++) {
      const line = parsed.lines[i];

      for (const token of watchTokens) {
        let searchFrom = 0;
        while (true) {
          const idx = line.indexOf(token, searchFrom);
          if (idx === -1) break;

          const snipS = Math.max(0, idx - 20);
          const snipE = Math.min(line.length, idx + token.length + 20);

          results.push({
            ruleId: 'encoded-entity',
            line: i + 1,
            col: idx + 1,
            length: token.length,
            message: `Encoded entity "${token}" found — should be a plain apostrophe or left as raw character`,
            detail: line.slice(snipS, snipE).trim() || '(blank text)'
          });

          searchFrom = idx + token.length;
        }
      }
    }

    return results;
  }
};

window.RULES['file-size'] = function(parsed) {
  const bytes = new Blob([parsed.raw]).size;
  if (bytes > 300 * 1024) {
    return [{
      ruleId: 'file-size',
      line: 1, col: 1, length: 1,
      message: `File size ${(bytes/1024).toFixed(1)}KB exceeds the 300KB limit`,
      detail: `Current size: ${(bytes/1024).toFixed(1)}KB — Expected: max 300KB`
    }];
  }
  return [];
};

window.RULES['para-end-punctuation'] = function(parsed) {
  const issues = [];
  parsed.lines.forEach((line, i) => {
    const matches = [...line.matchAll(/<\/p>/gi)];
    matches.forEach(match => {
      const stripped = line.slice(0, match.index)
        .replace(/<[^>]*>/g, '')       // strip all tags
        .replace(/&[^;]+;/g, 'X')     // replace entities with placeholder
        .trimEnd();
      const charBefore = stripped.slice(-1);
      if (!charBefore) return;
      if (charBefore !== '.' && charBefore !== ';') {
        // col = position of charBefore in original line
        const charBeforeCol = match.index; // char just before </p>
        issues.push({
          ruleId: 'para-end-punctuation',
          line: i + 1,
          col: charBeforeCol, // points to last visible char
          length: 1,
          message: `Paragraph ends with '${charBefore}' instead of . or ;`,
          detail: `Found: '${charBefore}' before </p>`
        });
      }
    });
  });
  return issues;
};

window.RULES['li-span-between'] = function(parsed) {
  const issues = [];
  let insideList = false;
  let insideLi = false;

  parsed.lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Track entering/exiting ul or ol
    if (/<(ul|ol)[\s>]/i.test(trimmed)) insideList = true;
    if (/<\/(ul|ol)>/i.test(trimmed)) { insideList = false; insideLi = false; }

    if (/<li[\s>]/i.test(trimmed)) insideLi = true;

    // Span check BEFORE closing </li> resets the flag
    if (insideList && !insideLi && /<span/i.test(trimmed)) {
      const spanIdx = line.toLowerCase().indexOf('<span');
      const liIdx = line.toLowerCase().indexOf('<li');
      if (liIdx !== -1 && liIdx < spanIdx) {
        // span is inside an <li> that opens on this line — not a real issue
      } else {
        const col = spanIdx + 1;
        issues.push({
          ruleId: 'li-span-between',
          line: i + 1,
          col,
          length: trimmed.length,
          message: `Span tag found outside <li> inside a list`,
          detail: `Found: ${trimmed} as direct child of list`
        });
      }
    }

    // Reset insideLi AFTER span check so </li> on same line as <span doesn't cause false positive
    if (/<\/li>/i.test(trimmed)) insideLi = false;
    if (/<li[\s>]/i.test(trimmed) && /<\/li>/i.test(trimmed)) insideLi = false;
  });

  return issues;
};

window.RULES['unlinked-reference'] = function(parsed) {
  const issues = [];

  const REFERENCE_RE = /(?<![A-Za-z])(?:(Chapter|Ch\.)[\s\-\.]*([IVXLCDMivxlcdm]+|\d[\d\.]*[A-Za-z]?)|(Figure|Fig\.|Fig|Illustration|Illus\.|Ill\.|Section|Sect\.|Sec\.|Appendix|App\.|Algorithm|Algo\.|Exercise|Equation|Eq\.|Footnote|Theorem|Thm\.|Listing|List\.|Problem|Prob\.|Example|Ex\.|Article|Art\.|Exhibit|Formula|Diagram|Sidebar|Annex|Amendment|Schedule|Clause|Specimen|Solution|Sample|Stanza|Scene|Verse|Volume|Vol\.|Plate|Pl\.|Table|Tab\.|Graph|Chart|Image|Scheme|Lemma|Proof|Answer|Panel|Part|Map|Box|Note|Act|Line|Case)[\s\-\.]*(\d[\d\.]*[A-Za-z]?))(?![A-Za-z])/gi;

  parsed.lines.forEach((line, i) => {
    // Skip if entire match is inside an <a>...</a> tag
    REFERENCE_RE.lastIndex = 0;
    let match;
    while ((match = REFERENCE_RE.exec(line)) !== null) {
      const matchIndex = match.index;

      // Check if this position is inside an <a> tag by scanning backwards
      const before = line.slice(0, matchIndex);
      const openA = before.lastIndexOf('<a ');
      const closeA = before.lastIndexOf('</a>');

      // If last <a seen is after last </a>, we are inside an anchor
      if (openA !== -1 && openA > closeA) continue;

      // Also skip if inside any tag (textMask check)
      if (parsed.textMask[i] && !parsed.textMask[i][matchIndex]) continue;

      issues.push({
        ruleId: 'unlinked-reference',
        line: i + 1,
        col: matchIndex + 1,
        length: match[0].length,
        message: `Cross-reference "${match[0].trim()}" is not wrapped in an anchor tag`,
        detail: `Found: ${match[0].trim()}`
      });
    }
  });

  return issues;
};

window.RULES['raw-url'] = function(parsed) {
  const issues = [];

  const URL_RE = /(?:https?:\/\/|ftp:\/\/|mailto:|www\.)[^\s<>"']+/gi;

  parsed.lines.forEach((line, i) => {
    URL_RE.lastIndex = 0;
    let match;
    while ((match = URL_RE.exec(line)) !== null) {
      // Skip if inside a tag (not visible text)
      if (!parsed.textMask[i] || !parsed.textMask[i][match.index]) continue;

      issues.push({
        ruleId: 'raw-url',
        line: i + 1,
        col: match.index + 1,
        length: match[0].length,
        message: `Raw URL found in text: ${match[0]}`,
        detail: match[0]
      });
    }
  });

  return issues;
};

window.RULES['body-top-level-div'] = function(parsed) {
  const issues = [];
  if (!parsed.dom) return issues;

  const body = parsed.dom.querySelector('body');
  if (!body) return issues;

  const firstChild = Array.from(body.children).find(el => el.nodeType === 1);
  if (!firstChild) return issues;

  if (firstChild.tagName.toLowerCase() !== 'div') {
    const tag = firstChild.tagName.toLowerCase();
    let lineNum = 1;
    for (let i = 0; i < parsed.lines.length; i++) {
      if (parsed.lines[i].includes('<' + tag)) {
        lineNum = i + 1;
        break;
      }
    }
    issues.push({
      ruleId: 'body-top-level-div',
      line: lineNum,
      col: 1,
      length: 1,
      message: `Top-level element inside <body> is <${tag}> — it must be a <div>`,
      detail: `Found: <${tag}>`
    });
  }

  return issues;
};

window.RULES['forbidden-tags'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;
  let inPoetry = false;

  const forbiddenTags = ['section', 'em', 'strong', 'dl', 'dt', 'dd'];
  const forbiddenRegex = /<\/?(section|em|strong|dl|dt|dd)[\s>\/]/gi;
  const brRegex = /<br\s*\/?>/gi;
  const poetryRegex = /class="[^"]*poetry[^"]*"/i;
  const closingDivRegex = /<\/div>/i;

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // Track poetry context
    if (poetryRegex.test(line)) inPoetry = true;
    if (closingDivRegex.test(line)) inPoetry = false;

    // Check forbidden tags
    forbiddenRegex.lastIndex = 0;
    let match;
    while ((match = forbiddenRegex.exec(line)) !== null) {
      const tag = match[1].toLowerCase();
      issues.push({
        ruleId: 'forbidden-tags',
        line: lineNum,
        col: match.index + 1,
        length: match[0].length,
        message: `Forbidden tag <${tag}> found`,
        detail: `Found: <${tag}>`
      });
    }

    // Check <br/> only inside poetry context
    if (inPoetry) {
      brRegex.lastIndex = 0;
      while ((brRegex.exec(line)) !== null) {
        issues.push({
          ruleId: 'forbidden-tags',
          line: lineNum,
          col: brRegex.lastIndex,
          length: 1,
          message: `Forbidden tag <br/> found inside poetry section`,
          detail: `Found: <br/>`
        });
      }
    }
  });

  return issues;
};

window.RULES['heading-skip-level'] = function(parsed) {
  const issues = [];
  if (!parsed.dom) return issues;

  const body = parsed.dom.querySelector('body');
  if (!body) return issues;

  const headings = Array.from(body.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  if (headings.length < 2) return issues;

  for (let i = 0; i < headings.length - 1; i++) {
    const cur = parseInt(headings[i].tagName[1]);
    const next = parseInt(headings[i + 1].tagName[1]);
    if (next > cur + 1) {
      const tag = headings[i + 1].tagName.toLowerCase();
      const text = headings[i + 1].textContent.trim().slice(0, 30);
      let lineNum = 1;
      for (let j = 0; j < parsed.lines.length; j++) {
        if (parsed.lines[j].includes('<' + tag)) {
          lineNum = j + 1;
          break;
        }
      }
      // Find line number of current heading too
      const curTag = headings[i].tagName.toLowerCase();
      const curText = headings[i].textContent.trim().slice(0, 30);
      let curLineNum = 1;
      for (let j = 0; j < parsed.lines.length; j++) {
        if (parsed.lines[j].includes('<' + curTag) && parsed.lines[j].includes(curText.slice(0, 10))) {
          curLineNum = j + 1;
          break;
        }
      }
      issues.push({
        ruleId: 'heading-skip-level',
        line: lineNum,
        col: 1,
        length: 1,
        message: `Heading level skipped — <h${cur}> is directly followed by <h${next}>`,
        detail: `${curLineNum} → ${lineNum}`
      });
    }
  }

  return issues;
};

window.RULES['untitled-chapter-div'] = function(parsed) {
  const issues = [];
  if (!parsed.dom) return issues;

  const body = parsed.dom.querySelector('body');
  if (!body) return issues;

  // Check if file has any headings
  const headings = body.querySelectorAll('h1,h2,h3,h4,h5,h6');
  if (headings.length > 0) return issues;

  // No headings found — check top-level div
  const firstDiv = Array.from(body.children).find(el => el.tagName.toLowerCase() === 'div');
  if (!firstDiv) return issues;

  const hasRole = firstDiv.getAttribute('role') === 'doc-chapter';
  const hasAriaLabel = firstDiv.hasAttribute('aria-label');

  if (!hasRole || !hasAriaLabel) {
    let lineNum = 1;
    for (let i = 0; i < parsed.lines.length; i++) {
      if (parsed.lines[i].includes('<div')) {
        lineNum = i + 1;
        break;
      }
    }
    const missing = [];
    if (!hasRole) missing.push('role="doc-chapter"');
    if (!hasAriaLabel) missing.push('aria-label');
    issues.push({
      ruleId: 'untitled-chapter-div',
      line: lineNum,
      col: 1,
      length: 1,
      message: `Top-level <div> is missing: ${missing.join(' and ')}`,
      detail: `Missing: ${missing.join(', ')}`
    });
  }

  return issues;
};

window.RULES['pagebreak-format'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;

  const pagebreakRegex = /<span[^>]*(?:epub:type=["']pagebreak["']|role=["']doc-pagebreak["']|id=["']page_[^"']*["'])[^>]*\/?>/gi;
  const idFormatRegex = /^page_([0-9]+|[ivxlcdmIVXLCDM]+)$/;

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    pagebreakRegex.lastIndex = 0;
    let match;

    while ((match = pagebreakRegex.exec(line)) !== null) {
      const tag = match[0];
      const missing = [];

      // Check self-closing
      const isSelfClosing = tag.trimEnd().endsWith('/>');
      if (!isSelfClosing) {
        missing.push('must be self-closing (end with />)');
      }

      // Check id attribute
      const idMatch = tag.match(/id=["']([^"']+)["']/);
      if (!idMatch) {
        missing.push('missing id attribute');
      } else {
        // Check id format
        if (!idFormatRegex.test(idMatch[1])) {
          missing.push(`id="${idMatch[1]}" does not match page_[number] or page_[roman] format`);
        }
      }

      // Check epub:type
      if (!tag.includes('epub:type="pagebreak"') && !tag.includes("epub:type='pagebreak'")) {
        missing.push('missing epub:type="pagebreak"');
      }

      // Check role
      if (!tag.includes('role="doc-pagebreak"') && !tag.includes("role='doc-pagebreak'")) {
        missing.push('missing role="doc-pagebreak"');
      }

      // Check title
      if (!tag.match(/title=["'][^"']+["']/)) {
        missing.push('missing title attribute');
      }

      if (missing.length > 0) {
        issues.push({
          ruleId: 'pagebreak-format',
          line: lineNum,
          col: match.index + 1,
          length: tag.length,
          message: `Page break tag has issues: ${missing.join(' | ')}`,
          detail: missing.join(' | ')
        });
      }
    }
  });

  return issues;
};

window.RULES['ellipsis-check'] = function(parsed) {
  const issues = [];
  const { lines, textMask } = parsed;

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const mask = textMask[i];

    // Check 1 — Three dots or spaced dots in visible text
    // ... or . . .
    const threeDotRegex = /\.\.\.|\. \. \./g;
    threeDotRegex.lastIndex = 0;
    let match;
    while ((match = threeDotRegex.exec(line)) !== null) {
      if (!mask[match.index]) continue;
      issues.push({
        ruleId: 'ellipsis-check',
        line: lineNum,
        col: match.index + 1,
        length: match[0].length,
        message: `Three dots found — should be ellipsis character … (&#x2026;)`,
        detail: `Found: "${match[0]}"`
      });
    }

    // Check 2 — Ellipsis+period (….) not followed by space
    // unless next char is " ' ) ] " '
    // Also catch encoded form &#x2026;.
    const ellipsisPeriodRegex = /(?:…|&#x2026;)\./g;
    ellipsisPeriodRegex.lastIndex = 0;
    while ((match = ellipsisPeriodRegex.exec(line)) !== null) {
      if (!mask[match.index]) continue;
      const nextChar = line[match.index + match[0].length];
      const safeChars = ['"', "'", ')', ']', '”', '’', '<'];
      if (nextChar && !safeChars.includes(nextChar) && nextChar !== ' ') {
        issues.push({
          ruleId: 'ellipsis-check',
          line: lineNum,
          col: match.index + 1,
          length: match[0].length,
          message: `Ellipsis+period (….) must be followed by a space`,
          detail: `Found: "….${nextChar}"`
        });
      }
    }

    // Check 3 — Colon before ellipsis without space
    // Q:… should be Q: …
    const colonEllipsisRegex = /:…/g;
    colonEllipsisRegex.lastIndex = 0;
    while ((match = colonEllipsisRegex.exec(line)) !== null) {
      if (!mask[match.index]) continue;
      issues.push({
        ruleId: 'ellipsis-check',
        line: lineNum,
        col: match.index + 1,
        length: match[0].length,
        message: `Colon before ellipsis must be followed by a space — use ": …" not ":…"`,
        detail: `Found: ":…"`
      });
    }
  });

  return issues;
};

window.RULES['quotation-marks-check'] = function(parsed) {
  const issues = [];
  const { lines, textMask } = parsed;

  // Smart quote characters
  const THIN_SPACE = ' ';
  const SMART_OPEN_DOUBLE = '“';   // "
  const SMART_CLOSE_DOUBLE = '”';  // "
  const SMART_OPEN_SINGLE = '‘';   // '
  const SMART_CLOSE_SINGLE = '’';  // '

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const mask = textMask[i];

    for (let c = 0; c < line.length; c++) {
      if (!mask[c]) continue;

      const ch = line[c];

      // Check 1 — Straight double quote in visible text
      if (ch === '"') {
        issues.push({
          ruleId: 'quotation-marks-check',
          line: lineNum,
          col: c + 1,
          length: 1,
          message: `Straight double quote " found — must be smart quote " or "`,
          detail: `Found: straight double quote at col ${c + 1}`
        });
        continue;
      }

      // Check 2 — Straight single quote / apostrophe in visible text
      if (ch === "'") {
        issues.push({
          ruleId: 'quotation-marks-check',
          line: lineNum,
          col: c + 1,
          length: 1,
          message: `Straight single quote ' found — must be smart quote ' or '`,
          detail: `Found: straight single quote at col ${c + 1}`
        });
        continue;
      }

      // Check 3 — Adjacent smart quotes without thin space
      // Closing single + closing double: '" → needs thin space
      if (ch === SMART_CLOSE_SINGLE && line[c + 1] === SMART_CLOSE_DOUBLE) {
        if (line[c + 1] !== THIN_SPACE) {
          issues.push({
            ruleId: 'quotation-marks-check',
            line: lineNum,
            col: c + 1,
            length: 2,
            message: `Missing thin space between closing single quote and closing double quote — use '&#x2009;"`,
            detail: `Found: '" without thin space`
          });
        }
        continue;
      }

      // Opening double + opening single: "' → needs thin space
      if (ch === SMART_OPEN_DOUBLE && line[c + 1] === SMART_OPEN_SINGLE) {
        if (line[c + 1] !== THIN_SPACE) {
          issues.push({
            ruleId: 'quotation-marks-check',
            line: lineNum,
            col: c + 1,
            length: 2,
            message: `Missing thin space between opening double quote and opening single quote — use "&#x2009;'`,
            detail: `Found: "' without thin space`
          });
        }
        continue;
      }

      // Opening double + apostrophe: "' → needs thin space
      if (ch === SMART_OPEN_DOUBLE && line[c + 1] === SMART_CLOSE_SINGLE) {
        if (line[c + 1] !== THIN_SPACE) {
          issues.push({
            ruleId: 'quotation-marks-check',
            line: lineNum,
            col: c + 1,
            length: 2,
            message: `Missing thin space between opening double quote and apostrophe — use "&#x2009;'`,
            detail: `Found: "' without thin space`
          });
        }
        continue;
      }
    }
  });

  return issues;
};

window.RULES['space-indentation-check'] = function(parsed) {
  const issues = [];
  const { lines, textMask } = parsed;

  const BLOCK_TAGS = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'blockquote'];

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Check if line is a block element
    const isBlock = BLOCK_TAGS.some(tag => trimmed.startsWith('<' + tag + '>') || trimmed.startsWith('<' + tag + ' '));
    if (!isBlock) return;

    // Find where visible text starts after the opening tag
    const tagEndIdx = trimmed.indexOf('>');
    if (tagEndIdx === -1) return;
    const afterTag = trimmed.slice(tagEndIdx + 1);

    // Check 1 — starts with 1 or more regular spaces
    // Skip if content starts with a pagebreak span
    const afterTagTrimmed = afterTag.trimStart();
    const startsWithPagebreak = /^<span[^>]*(?:epub:type=["']pagebreak["']|role=["']doc-pagebreak["'])[^>]*\/>/.test(afterTagTrimmed);
    if (/^ +/.test(afterTag) && !startsWithPagebreak) {
      issues.push({
        ruleId: 'space-indentation-check',
        line: lineNum,
        col: 1,
        length: 1,
        message: `Space characters used for indentation — use CSS instead`,
        detail: `Found: multiple spaces at start of content`
      });
      return;
    }

    // Check 2 — starts with &nbsp; entities used as indent
    if (/^(?:&nbsp;|&#x00A0;|&#160;){1,}/.test(afterTag)) {
      issues.push({
        ruleId: 'space-indentation-check',
        line: lineNum,
        col: 1,
        length: 1,
        message: `Non-breaking space used for indentation — use CSS instead`,
        detail: `Found: &nbsp; at start of content`
      });
      return;
    }
  });

  return issues;
};

window.RULES['nbsp-abbreviation-check'] = function(parsed) {
  const issues = [];
  const { lines, textMask } = parsed;

  // Patterns that need non-breaking space
  const patterns = [
    // Honorifics
    { regex: /\bDr\.\s+\w/g, label: 'Dr.' },
    { regex: /\bMr\.\s+\w/g, label: 'Mr.' },
    { regex: /\bMrs\.\s+\w/g, label: 'Mrs.' },
    { regex: /\bMs\.\s+\w/g, label: 'Ms.' },
    { regex: /\bSt\.\s+\w/g, label: 'St.' },
    { regex: /\bProf\.\s+\w/g, label: 'Prof.' },
    // Time abbreviations
    { regex: /\d+:\d+\s+AM\b/g, label: 'AM' },
    { regex: /\d+:\d+\s+PM\b/g, label: 'PM' },
    { regex: /\d+:\d+\s+am\b/g, label: 'am' },
    { regex: /\d+:\d+\s+pm\b/g, label: 'pm' },
    // Era abbreviations
    { regex: /\d+\s+BC\b/g, label: 'BC' },
    { regex: /\d+\s+AD\b/g, label: 'AD' },
    { regex: /\d+\s+BCE\b/g, label: 'BCE' },
    { regex: /\d+\s+CE\b/g, label: 'CE' },
    // Speed abbreviations
    { regex: /\d+\s+mph\b/g, label: 'mph' },
    { regex: /\d+\s+kmh\b/g, label: 'kmh' },
    { regex: /\d+\s+kph\b/g, label: 'kph' }
  ];

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const mask = textMask[i];

    patterns.forEach(({ regex, label }) => {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(line)) !== null) {
        // Check if match is in visible text
        if (!mask[match.index]) continue;

        // Check if already using non-breaking space
        // Non-breaking space is   or &#x00A0; or &nbsp;
        const matchText = match[0];
        if (matchText.includes(' ')) continue;

        // Find the space position in the match
        const spaceIdx = match.index + matchText.indexOf(' ');

        issues.push({
          ruleId: 'nbsp-abbreviation-check',
          line: lineNum,
          col: spaceIdx + 1,
          length: match[0].length,
          message: `Regular space used before "${label}" — should be non-breaking space &#x00A0;`,
          detail: `Found: "${matchText.trim()}"`
        });
      }
    });
  });

  return issues;
};

window.RULES['li-content-check'] = function(parsed) {
  const issues = [];
  if (!parsed.dom) return issues;

  const body = parsed.dom.querySelector('body');
  if (!body) return issues;

  const listItems = body.querySelectorAll('li');
  listItems.forEach(li => {
    // Check if li has direct text node with content
    const hasDirectText = Array.from(li.childNodes).some(node =>
      node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== ''
    );

    // Check if first child is not a <p>
    const firstChild = Array.from(li.children)[0];
    const firstChildIsP = firstChild && firstChild.tagName.toLowerCase() === 'p';

    if (hasDirectText || !firstChildIsP) {
      // Find line number
      const text = li.textContent.trim().slice(0, 20);
      let lineNum = 1;
      for (let i = 0; i < parsed.lines.length; i++) {
        if (parsed.lines[i].includes('<li') && parsed.lines[i].includes(text.slice(0, 10))) {
          lineNum = i + 1;
          break;
        }
      }
      issues.push({
        ruleId: 'li-content-check',
        line: lineNum,
        col: 1,
        length: 1,
        message: `<li> content is not wrapped in a <p> tag`,
        detail: `Found: "${text}"`
      });
    }
  });

  return issues;
};

window.RULES['paragraph-list-role-check'] = function(parsed) {
  const issues = [];
  if (!parsed.dom) return issues;

  const body = parsed.dom.querySelector('body');
  if (!body) return issues;

  // Check 1 — div with role="list" children must have role="listitem"
  const listDivs = body.querySelectorAll('div[role="list"]');
  listDivs.forEach(div => {
    const children = Array.from(div.children);
    children.forEach(child => {
      if (child.getAttribute('role') !== 'listitem') {
        const text = child.textContent.trim().slice(0, 20);
        let lineNum = 1;
        for (let i = 0; i < parsed.lines.length; i++) {
          if (parsed.lines[i].includes(text.slice(0, 10))) {
            lineNum = i + 1;
            break;
          }
        }
        issues.push({
          ruleId: 'paragraph-list-role-check',
          line: lineNum,
          col: 1,
          length: 1,
          message: `Child element of div[role="list"] is missing role="listitem"`,
          detail: `Found: <${child.tagName.toLowerCase()}> without role="listitem"`
        });
      }
    });
  });

  // Check 2 — p with role="listitem" must have parent with role="list"
  const listItems = body.querySelectorAll('[role="listitem"]');
  listItems.forEach(item => {
    const parent = item.parentElement;
    if (!parent || parent.getAttribute('role') !== 'list') {
      const text = item.textContent.trim().slice(0, 20);
      let lineNum = 1;
      for (let i = 0; i < parsed.lines.length; i++) {
        if (parsed.lines[i].includes(text.slice(0, 10))) {
          lineNum = i + 1;
          break;
        }
      }
      issues.push({
        ruleId: 'paragraph-list-role-check',
        line: lineNum,
        col: 1,
        length: 1,
        message: `Element with role="listitem" does not have a parent with role="list"`,
        detail: `Found: <${item.tagName.toLowerCase()}> with role="listitem" inside <${parent ? parent.tagName.toLowerCase() : 'unknown'}>`
      });
    }
  });

  return issues;
};

window.RULES['section-break-check'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Check 1 — Any <hr> tag found
    if (/<hr[\s\/>]/i.test(trimmed)) {

      // Check if hr has class="transition"
      const hasTransitionClass = /class=["'][^"']*transition[^"']*["']/.test(trimmed);

      if (!hasTransitionClass) {
        issues.push({
          ruleId: 'section-break-check',
          line: lineNum,
          col: 1,
          length: 1,
          message: `<hr> tag is missing class="transition"`,
          detail: `Found: ${trimmed.slice(0, 60)}`
        });
        return;
      }

      // Check 2 — After <hr class="transition"/> next non-empty line must be
      // <div class="transition" aria-hidden="true">
      let nextLineNum = i + 1;
      let nextLine = '';
      while (nextLineNum < lines.length) {
        nextLine = lines[nextLineNum].trim();
        if (nextLine !== '') break;
        nextLineNum++;
      }

      const hasTransitionDiv = /^<div[^>]*class=["'][^"']*transition[^"']*["'][^>]*aria-hidden=["']true["'][^>]*>/.test(nextLine) ||
                               /^<div[^>]*aria-hidden=["']true["'][^>]*class=["'][^"']*transition[^"']*["'][^>]*>/.test(nextLine);

      if (!hasTransitionDiv) {
        issues.push({
          ruleId: 'section-break-check',
          line: nextLineNum + 1,
          col: 1,
          length: 1,
          message: `Missing <div class="transition" aria-hidden="true"> after <hr class="transition"/>`,
          detail: `Expected transition div after line ${lineNum}`
        });
      }
    }
  });

  return issues;
};

window.RULES['img-class-check'] = function(parsed) {
  const issues = [];
  if (!parsed.dom) return issues;

  const body = parsed.dom.querySelector('body');
  if (!body) return issues;

  const images = body.querySelectorAll('img');
  images.forEach(img => {
    const classList = img.getAttribute('class') || '';
    const hasFill = classList.includes('fill') || classList.includes('fill_height');

    if (!hasFill) {
      const src = img.getAttribute('src') || '';
      const fileName = src.split('/').pop();

      let lineNum = 1;
      for (let i = 0; i < parsed.lines.length; i++) {
        if (parsed.lines[i].includes('<img') && parsed.lines[i].includes(src.slice(-20))) {
          lineNum = i + 1;
          break;
        }
      }

      issues.push({
        ruleId: 'img-class-check',
        line: lineNum,
        col: 1,
        length: 1,
        message: `<img> tag is missing class="fill" or class="fill_height"`,
        detail: `Found: ${fileName || 'unknown image'}`
      });
    }
  });

  return issues;
};

window.RULES['css-link-order'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;
  const isbn = (window.CSS_CHECK_ISBN || '').trim();

  let prhStandardLine = -1;
  let titleCssLine = -1;
  let prhFound = false;
  let titleFound = false;

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (trimmed.includes('prh_standard.css') && trimmed.includes('<link')) {
      prhStandardLine = i + 1;
      prhFound = true;
    }

    if (isbn) {
      if (trimmed.includes(isbn + '_style.css') && trimmed.includes('<link')) {
        titleCssLine = i + 1;
        titleFound = true;
      }
    } else {
      if (/_style\.css/.test(trimmed) && trimmed.includes('<link')) {
        titleCssLine = i + 1;
        titleFound = true;
      }
    }
  });

  if (!prhFound) {
    issues.push({
      ruleId: 'css-link-order',
      line: 1,
      col: 1,
      length: 1,
      message: `prh_standard.css is missing from <head>`,
      detail: `prh_standard.css link not found`
    });
  }

  if (!titleFound) {
    const cssName = isbn ? `${isbn}_style.css` : '[ISBN]_style.css';
    issues.push({
      ruleId: 'css-link-order',
      line: 1,
      col: 1,
      length: 1,
      message: `Title CSS (${cssName}) is missing from <head>`,
      detail: `${cssName} link not found`
    });
  }

  if (prhFound && titleFound && prhStandardLine > titleCssLine) {
    issues.push({
      ruleId: 'css-link-order',
      line: titleCssLine,
      col: 1,
      length: 1,
      message: `CSS link order is wrong — prh_standard.css (line ${prhStandardLine}) must come before title CSS (line ${titleCssLine})`,
      detail: `prh_standard.css at line ${prhStandardLine}, title CSS at line ${titleCssLine}`
    });
  }

  return issues;
};

window.RULES['smallcaps-word-boundary'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;
  // Regex to find <span ... class="... fv-smallcaps / fv-allsmallcaps ..."> ... </span>
  const spanRegex = /<span\b([^>]*class\s*=\s*["'][^"']*\b(?:fv-smallcaps|fv-allsmallcaps)\b[^"']*["'][^>]*)>([\s\S]*?)<\/span>/gi;

  lines.forEach((line, lineIdx) => {
    let match;
    const lineNum = lineIdx + 1;
    // Reset regex index for this line
    spanRegex.lastIndex = 0;

    while ((match = spanRegex.exec(line)) !== null) {
      const matchIndex = match.index;
      const fullMatch = match[0];
      const innerText = match[2].replace(/<[^>]+>/g, ''); // strip any nested tags
      const afterIndex = matchIndex + fullMatch.length;

      // 1. Check preceding character on the same line
      let splitBefore = false;
      if (matchIndex > 0) {
        const charBefore = line[matchIndex - 1];
        if (/[a-zA-Z0-9]/.test(charBefore)) {
          splitBefore = true;
        }
      }

      // 2. Check succeeding character on the same line
      let splitAfter = false;
      if (afterIndex < line.length) {
        const charAfter = line[afterIndex];
        if (/[a-zA-Z0-9]/.test(charAfter)) {
          splitAfter = true;
        }
      }

      if (splitBefore || splitAfter) {
        const problemSnippet = (splitBefore ? line[matchIndex - 1] : '') + fullMatch + (splitAfter ? line[afterIndex] : '');
        issues.push({
          ruleId: 'smallcaps-word-boundary',
          line: lineNum,
          col: matchIndex + 1,
          length: fullMatch.length,
          message: `Small caps must wrap whole words and not split a word`,
          detail: `Small caps span splits a word: "${problemSnippet}"`
        });
      }
    }
  });

  return issues;
};

window.RULES['smallcaps-underlying-casing'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;

  // 1. Small caps check: inspect text inside .fv-smallcaps and .fv-allsmallcaps
  const spanRegex = /<span\b([^>]*class\s*=\s*["'][^"']*\b(?:fv-smallcaps|fv-allsmallcaps)\b[^"']*["'][^>]*)>([\s\S]*?)<\/span>/gi;

  lines.forEach((line, lineIdx) => {
    let match;
    const lineNum = lineIdx + 1;
    spanRegex.lastIndex = 0;

    while ((match = spanRegex.exec(line)) !== null) {
      const matchIndex = match.index;
      const fullMatch = match[0];
      const innerText = match[2].replace(/<[^>]+>/g, '').trim();

      if (!innerText) continue;

      // Find first alphabetic character in inner text (ignore leading punctuation/quotes like “, ", ‘)
      const firstLetterMatch = innerText.match(/[a-zA-Z]/);
      if (firstLetterMatch) {
        const firstLetter = firstLetterMatch[0];
        if (firstLetter === firstLetter.toLowerCase() && firstLetter !== firstLetter.toUpperCase()) {
          issues.push({
            ruleId: 'smallcaps-underlying-casing',
            line: lineNum,
            col: matchIndex + 1,
            length: fullMatch.length,
            message: `Small caps text must have proper underlying capitalization (starts with lowercase: "${firstLetter}")`,
            detail: `Small caps text "${innerText.slice(0, 30)}" should be properly capitalized`
          });
        }
      }
    }
  });

  // 2. Heading casing check: inspect <h1> through <h6>
  const headingRegex = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;

  lines.forEach((line, lineIdx) => {
    let match;
    const lineNum = lineIdx + 1;
    headingRegex.lastIndex = 0;

    while ((match = headingRegex.exec(line)) !== null) {
      const matchIndex = match.index;
      const fullMatch = match[0];
      const headingLevel = match[1];
      const innerText = match[3].replace(/<[^>]+>/g, '').trim();

      if (!innerText) continue;

      // Find first alphabetic character in heading
      const firstLetterMatch = innerText.match(/[a-zA-Z]/);
      if (firstLetterMatch) {
        const firstLetter = firstLetterMatch[0];
        if (firstLetter === firstLetter.toLowerCase() && firstLetter !== firstLetter.toUpperCase()) {
          issues.push({
            ruleId: 'smallcaps-underlying-casing',
            line: lineNum,
            col: matchIndex + 1,
            length: fullMatch.length,
            message: `<h${headingLevel}> heading text must begin with an uppercase letter (starts with lowercase: "${firstLetter}")`,
            detail: `Heading text "${innerText.slice(0, 30)}" starts with lowercase letter`
          });
        }
      }
    }
  });

  return issues;
};

window.RULES['dropcap-inline-preceding'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;

  // Regex matching <p ... class="... dropcaps2line / dropcaps3line / dropcap / raisedcap ...">
  const dropcapPRegex = /<p\b([^>]*class\s*=\s*["'][^"']*\b(?:dropcaps\d*line|dropcap|raisedcap|initialcap)\b[^"']*["'][^>]*)>([\s\S]*?)<\/p>/gi;

  lines.forEach((line, lineIdx) => {
    let match;
    const lineNum = lineIdx + 1;
    dropcapPRegex.lastIndex = 0;

    while ((match = dropcapPRegex.exec(line)) !== null) {
      const matchIndex = match.index;
      const fullMatch = match[0];
      const innerContent = match[2].trimStart();

      // Check if the innerContent begins with an inline tag before any visible text
      // e.g. <span epub:type="pagebreak".../> or <span id="page_..."> or <a ...>
      const leadingInlineTagMatch = innerContent.match(/^<span\b[^>]*\b(?:epub:type\s*=\s*["']pagebreak["']|id\s*=\s*["']page_\w+["']|role\s*=\s*["']doc-pagebreak["'])[^>]*\/?>|^<a\b[^>]*\/?>/i);

      if (leadingInlineTagMatch) {
        const tagSnippet = leadingInlineTagMatch[0];
        issues.push({
          ruleId: 'dropcap-inline-preceding',
          line: lineNum,
          col: matchIndex + 1,
          length: fullMatch.length,
          message: `Initial/drop caps must not be preceded by inline elements (${tagSnippet}). Place pagebreak in heading or above paragraph.`,
          detail: `Found inline element "${tagSnippet}" at start of drop cap paragraph`
        });
      }
    }
  });

  return issues;
};

window.RULES['chapter-top-padding'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;

  // Search for the first <div tag immediately inside <body>
  let inBody = false;
  let firstDivFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (/<body\b/i.test(line)) {
      inBody = true;
    }

    if (inBody && !firstDivFound) {
      const divMatch = line.match(/<div\b([^>]*)>/i);
      if (divMatch) {
        firstDivFound = true;
        const attrs = divMatch[1];
        const matchIndex = divMatch.index || 0;

        // Check if class contains page_top_padding or sink_25
        const classMatch = attrs.match(/class\s*=\s*["']([^"']*)["']/i);
        const classNames = classMatch ? classMatch[1].split(/\s+/) : [];

        const hasValidPaddingClass = classNames.includes('page_top_padding') || classNames.includes('sink_25');

        if (!hasValidPaddingClass) {
          const currentClassText = classMatch ? `class="${classMatch[1]}"` : 'no class';
          issues.push({
            ruleId: 'chapter-top-padding',
            line: lineNum,
            col: matchIndex + 1,
            length: divMatch[0].length,
            message: `Top-level <div> inside <body> must have class="page_top_padding" or class="sink_25" (found ${currentClassText})`,
            detail: `Top-level <div> has ${currentClassText} instead of page_top_padding or sink_25`
          });
        }
        break; // Only check the first top-level div
      }
    }

    if (/<\/body>/i.test(line)) {
      break;
    }
  }

  return issues;
};

window.RULES['crossref-page-link-text'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;
  const textMask = parsed.textMask;

  // Regex to detect unlinked page reference in visible text:
  // e.g. "see page 24", "on page 90", "see pages 24-36", "page 45", "pp. 12-14"
  const UNLINKED_PAGE_RE = /\b(?:(?:see|go\s+to|on|at|refer\s+to|from)\s+)?(?:pages?|pp?\.)\s*(\d+(?:[–—-]\d+)?)\b/gi;

  // Regex to detect <a> tags targeting page breaks
  const PAGE_ANCHOR_RE = /<a\b([^>]*href\s*=\s*["'][^"']*#page_\w+["'][^>]*)>([\s\S]*?)<\/a>/gi;

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;
    const mask = textMask[lineIdx];

    // --- CHECK 1: Literal page numbers inside <a href="...#page_X"> tags ---
    PAGE_ANCHOR_RE.lastIndex = 0;
    let anchorMatch;
    while ((anchorMatch = PAGE_ANCHOR_RE.exec(line)) !== null) {
      const matchIndex = anchorMatch.index;
      const fullMatch = anchorMatch[0];
      const linkText = anchorMatch[2].replace(/<[^>]+>/g, '').trim();

      // PRH Spec §2.9.1: link text must be "this page"
      if (linkText.toLowerCase() !== 'this page') {
        // Find exact start position of linkText inside the raw line
        // Opening tag ends right before linkText: <a ...>linkText</a>
        const openTagMatch = fullMatch.match(/^<a\b[^>]*>/i);
        const innerColOffset = openTagMatch ? openTagMatch[0].length : 0;
        const textStartCol = matchIndex + innerColOffset;

        issues.push({
          ruleId: 'crossref-page-link-text',
          line: lineNum,
          col: textStartCol + 1,
          length: linkText.length,
          message: `Page reference link text must be "this page" (found "${linkText}")`,
          detail: `Anchor links to a page break but uses "${linkText}" instead of "this page"`
        });
      }
    }

    // --- CHECK 2: Unlinked page references in visible text ---
    UNLINKED_PAGE_RE.lastIndex = 0;
    let refMatch;
    while ((refMatch = UNLINKED_PAGE_RE.exec(line)) !== null) {
      const matchIndex = refMatch.index;
      const matchText = refMatch[0];
      const pageNum = refMatch[1];

      // Must be outside tags (visible text)
      if (mask && !mask[matchIndex]) continue;

      // Check if this match is inside an <a> tag
      const lineBefore = line.slice(0, matchIndex);
      const openA = lineBefore.lastIndexOf('<a ');
      const closeA = lineBefore.lastIndexOf('</a>');
      if (openA !== -1 && openA > closeA) {
        // Inside an <a> tag, already checked by Check 1
        continue;
      }

      // Check if inside a <title> or <h#> tag or <span class="pagebreak">
      if (/<span\b[^>]*\bpagebreak\b/i.test(lineBefore)) continue;

      issues.push({
        ruleId: 'crossref-page-link-text',
        line: lineNum,
        col: matchIndex + 1,
        length: matchText.length,
        message: `Unlinked page reference "${matchText.trim()}" must be hyperlinked as '<a href="...#page_${pageNum}">this page</a>'`,
        detail: `Found unlinked page reference "${matchText.trim()}"`
      });
    }
  });

  return issues;
};

window.RULES['fraction-markup-format'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;
  const textMask = parsed.textMask;

  // Regex matching raw fraction patterns e.g. 1/2, 3/4, 5/8
  // Lookarounds prevent matching inside words, tags, or repeated slashes (e.g. URLs or file paths)
  const FRACTION_RE = /(?<!\w|\/|<)\b(\d{1,3})\/(\d{1,3})\b(?!\w|\/|>)/g;

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;
    const mask = textMask[lineIdx];

    FRACTION_RE.lastIndex = 0;
    let match;
    while ((match = FRACTION_RE.exec(line)) !== null) {
      const matchIndex = match.index;
      const fullMatch = match[0];
      const num = match[1];
      const den = match[2];

      // 1. Must be outside tags (visible text)
      if (mask && !mask[matchIndex]) continue;

      // 3. Skip if line context is a date: e.g. "12/05/2024" or preceded/followed by another slash
      const charBefore = line[matchIndex - 1];
      const charAfter = line[matchIndex + fullMatch.length];
      if (charBefore === '/' || charAfter === '/') continue;

      // Check wider window for dates (e.g. 12/25/99)
      const surroundingContext = line.slice(Math.max(0, matchIndex - 5), Math.min(line.length, matchIndex + fullMatch.length + 5));
      if (/\d+\/\d+\/\d+/.test(surroundingContext)) continue;

      // 4. Skip if inside existing numerator/denominator span
      const beforeText = line.slice(0, matchIndex);
      if (/class=["'][^"']*(?:numerator|denominator)[^"']*["'][^>]*>$/i.test(beforeText)) continue;

      issues.push({
        ruleId: 'fraction-markup-format',
        line: lineNum,
        col: matchIndex + 1,
        length: fullMatch.length,
        message: `Raw fraction "${fullMatch}" found — format as Unicode vulgar fraction (e.g. ½) or use <span class="numerator">${num}</span>&#x2044;<span class="denominator">${den}</span>`,
        detail: `Found raw fraction "${fullMatch}" in visible text`
      });
    }
  });

  return issues;
};

window.RULES['footnote-structure-check'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;

  // Regex for internal footnote callouts: href="#note_..." or href="#fn..." or href="#footnote_..."
  // Starts with "#" strictly so any external link (e.g. href="notes.xhtml#...") is automatically skipped!
  const INTERNAL_FN_CALLOUT_RE = /<a\b([^>]*href\s*=\s*["']#(?:note_|fn_|footnote_)[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;

  // Regex for footnote destination paragraphs: <p class="...fn...">
  const FN_P_RE = /<p\b([^>]*class\s*=\s*["'][^"']*\bfn\b[^"']*["'][^>]*)>([\s\S]*?)<\/p>/gi;

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    // Check if the current line is a footnote entry paragraph (<p class="fn">)
    const isFootnoteParagraph = /<p\b[^>]*class\s*=\s*["'][^"']*\bfn\b[^"']*["'][^>]*>/i.test(line);

    // --- CHECK 1: Internal footnote callouts in story text must have class="fnref" ---
    // (Skip backlinks inside <p class="fn"> or links containing "backlink")
    if (!isFootnoteParagraph) {
      INTERNAL_FN_CALLOUT_RE.lastIndex = 0;
      let calloutMatch;
      while ((calloutMatch = INTERNAL_FN_CALLOUT_RE.exec(line)) !== null) {
        const matchIndex = calloutMatch.index;
        const fullMatch = calloutMatch[0];
        const attrs = calloutMatch[1];
        const linkText = calloutMatch[2].replace(/<[^>]+>/g, '').trim();

        // Skip backlink anchors (e.g. href="#note_backlink_1")
        if (/backlink/i.test(attrs)) continue;

        // Check if classes contain fnref
        const classMatch = attrs.match(/class\s*=\s*["']([^"']*)["']/i);
        const classes = classMatch ? classMatch[1].split(/\s+/) : [];

        if (!classes.includes('fnref')) {
          // Calculate column offset pointing to the inner text
          const openTagMatch = fullMatch.match(/^<a\b[^>]*>/i);
          const innerOffset = openTagMatch ? openTagMatch[0].length : 0;

          issues.push({
            ruleId: 'footnote-structure-check',
            line: lineNum,
            col: matchIndex + innerOffset + 1,
            length: linkText.length || 1,
            message: `Internal footnote callout ("${linkText}") must have class="fnref"`,
            detail: `Anchor tag "${fullMatch.slice(0, 50)}" is missing class="fnref"`
          });
        }
      }
    }

    // --- CHECK 2: Destination anchor span inside <p class="fn"> must have class="fndest" ---
    if (isFootnoteParagraph) {
      FN_P_RE.lastIndex = 0;
      let fnPMatch;
      while ((fnPMatch = FN_P_RE.exec(line)) !== null) {
        const innerContent = fnPMatch[2].trimStart();

        // Look for the leading <span ...> tag wrapping the note backlink
        const leadingSpanMatch = innerContent.match(/^<span\b([^>]*)>/i);
        if (leadingSpanMatch) {
          const spanAttrs = leadingSpanMatch[1];
          const spanClassMatch = spanAttrs.match(/class\s*=\s*["']([^"']*)["']/i);
          const spanClasses = spanClassMatch ? spanClassMatch[1].split(/\s+/) : [];

          if (!spanClasses.includes('fndest')) {
            const spanTextMatch = innerContent.match(/^<span\b[^>]*>([\s\S]*?)<\/span>/i);
            const spanInnerText = spanTextMatch ? spanTextMatch[1].replace(/<[^>]+>/g, '').trim() : '1';
            const matchCol = line.indexOf(leadingSpanMatch[0]);

            issues.push({
              ruleId: 'footnote-structure-check',
              line: lineNum,
              col: (matchCol !== -1 ? matchCol : 0) + leadingSpanMatch[0].length + 1,
              length: spanInnerText.length || 1,
              message: `Footnote destination anchor span inside <p class="fn"> must have class="fndest"`,
              detail: `Destination span "${leadingSpanMatch[0]}" is missing class="fndest"`
            });
          }
        }
      }
    }
  });

  return issues;
};

window.RULES['poetry-line-p-check'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;

  let inPoetry = false;
  const poetryContainerRegex = /<(?:div|section)\b[^>]*class\s*=\s*["'][^"']*\bpoetry\b[^"']*["'][^>]*>/i;
  const closingDivRegex = /<\/(?:div|section)>/i;

  const P_TAG_RE = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    // Ignore HTML comments like <!-- ... -->
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('<!--') && trimmedLine.endsWith('-->')) {
      return;
    }

    // Detect entering poetry section
    if (poetryContainerRegex.test(line)) {
      inPoetry = true;
    }

    if (inPoetry) {
      P_TAG_RE.lastIndex = 0;
      let pMatch;
      while ((pMatch = P_TAG_RE.exec(line)) !== null) {
        const matchIndex = pMatch.index;
        const fullMatch = pMatch[0];
        const attrs = pMatch[1];
        const innerContent = pMatch[2].replace(/<[^>]+>/g, '').trim();

        // Calculate offset to point directly to inner text for clean snippet highlighting
        const openTagMatch = fullMatch.match(/^<p\b[^>]*>/i);
        const innerColOffset = openTagMatch ? openTagMatch[0].length : 0;
        const innerCol = matchIndex + innerColOffset + 1;

        // Check if classes contain standard PRH poetry classes: poetry0 to poetry6, poem_title, poem_author
        const classMatch = attrs.match(/class\s*=\s*["']([^"']*)["']/i);
        const classes = classMatch ? classMatch[1].split(/\s+/) : [];

        // Check 1: Empty spacer paragraph
        // e.g. <p>&nbsp;</p> or <p></p> or <p>&#160;</p>
        const isSpacer = !innerContent || innerContent === '&nbsp;' || innerContent === '&#160;' || innerContent === '&#x00A0;';
        if (isSpacer) {
          issues.push({
            ruleId: 'poetry-line-p-check',
            line: lineNum,
            col: innerCol,
            length: innerContent ? innerContent.length : fullMatch.length,
            message: `Empty spacer <p> tag inside poetry section is forbidden — use class="stanza" on the next verse line instead`,
            detail: `Found empty spacer: "${fullMatch}"`
          });
          continue;
        }

        // Check 2: Missing standard poetry0 - poetry6 class on verse lines
        const hasStandardPoetryClass = classes.some(c => /^poetry[0-6]$/i.test(c) || /^poem_/i.test(c));

        if (!hasStandardPoetryClass) {
          const currentClassText = classMatch ? `class="${classMatch[1]}"` : 'no class';
          issues.push({
            ruleId: 'poetry-line-p-check',
            line: lineNum,
            col: innerCol,
            length: innerContent.length || 1,
            message: `Poetry line <p> is missing standard PRH poetry class (poetry0 to poetry6) — found ${currentClassText}`,
            detail: `Poetry line has ${currentClassText} instead of poetry0 to poetry6`
          });
        }
      }
    }

    // Detect leaving poetry section
    if (inPoetry && closingDivRegex.test(line)) {
      inPoetry = false;
    }
  });

  return issues;
};

window.RULES['pullquote-omission-check'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;

  // Regex matching tags marked as pull quotes:
  // e.g. <aside class="pullquote">, <p class="pq">, <aside epub:type="pullquote">, role="doc-pullquote"
  const PULLQUOTE_RE = /<(?:aside|div|p)\b([^>]*\b(?:class\s*=\s*["'][^"']*\b(?:pull-?quote|pull_quote|pq)\b[^"']*["']|epub:type\s*=\s*["']pullquote["']|role\s*=\s*["']doc-pullquote["'])[^>]*)>/gi;

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    // Skip HTML comments
    const trimmed = line.trim();
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) return;

    PULLQUOTE_RE.lastIndex = 0;
    let match;
    while ((match = PULLQUOTE_RE.exec(line)) !== null) {
      const matchIndex = match.index;
      const fullMatch = match[0];

      issues.push({
        ruleId: 'pullquote-omission-check',
        line: lineNum,
        col: matchIndex + 1,
        length: fullMatch.length,
        message: `Pull quote found (${fullMatch}) — per PRH Spec §2.8.2, pull quotes should be omitted in ebook conversion`,
        detail: `Found pull quote tag: "${fullMatch}"`
      });
    }
  });

  return issues;
};

window.RULES['table-structure-check'] = function(parsed) {
  const issues = [];
  const { dom, lines } = parsed;

  if (!dom) return issues;

  // Helper to find the line and col of an element or tag snippet
  function findLocation(tagSnippet, startLine = 0) {
    for (let i = startLine; i < lines.length; i++) {
      const idx = lines[i].indexOf(tagSnippet);
      if (idx !== -1) {
        return { line: i + 1, col: idx + 1 };
      }
    }
    return { line: 1, col: 1 };
  }

  const tables = dom.querySelectorAll('table');
  if (!tables || tables.length === 0) return issues;

  tables.forEach((table, tableIdx) => {
    // Locate table in source lines
    const tableId = table.getAttribute('id');
    const tableIdentifier = tableId ? `id="${tableId}"` : '<table';
    let tableLoc = { line: 1, col: 1 };
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('<table') && (!tableId || lines[i].includes(tableId))) {
        tableLoc = { line: i + 1, col: lines[i].indexOf('<table') + 1 };
        break;
      }
    }

    // CHECK 1: Table must contain <thead>
    const thead = table.querySelector('thead');
    if (!thead) {
      issues.push({
        ruleId: 'table-structure-check',
        line: tableLoc.line,
        col: tableLoc.col,
        length: 6,
        message: `Table is missing required <thead> header structure (PRH Spec §2.11.1)`,
        detail: `Table ${tableId ? '#' + tableId : (tableIdx + 1)} has no <thead> element`
      });
    } else {
      // CHECK 2: Header cells in <thead> must be <th>, not <td>
      const theadTds = thead.querySelectorAll('td');
      theadTds.forEach(td => {
        const textSnippet = td.textContent.trim().slice(0, 20);
        let tdLoc = { line: tableLoc.line, col: 1 };
        for (let i = tableLoc.line - 1; i < lines.length; i++) {
          if (lines[i].includes('<td') && (!textSnippet || lines[i].includes(textSnippet.slice(0, 10)))) {
            tdLoc = { line: i + 1, col: lines[i].indexOf('<td') + 1 };
            break;
          }
        }
        issues.push({
          ruleId: 'table-structure-check',
          line: tdLoc.line,
          col: tdLoc.col,
          length: 3,
          message: `Header cell in <thead> must use <th> instead of <td> (PRH Spec §2.11.1)`,
          detail: `Found <td> in <thead>: "${textSnippet}"`
        });
      });
    }

    // CHECK 3: Table must contain <tbody>
    const tbody = table.querySelector('tbody');
    if (!tbody) {
      issues.push({
        ruleId: 'table-structure-check',
        line: tableLoc.line,
        col: tableLoc.col,
        length: 6,
        message: `Table is missing required <tbody> body structure (PRH Spec §2.11.1)`,
        detail: `Table ${tableId ? '#' + tableId : (tableIdx + 1)} has no <tbody> element`
      });
    }

    // CHECK 4: <tr> elements must not have styles or classes (PRH Spec §2.11.1 Item 4c)
    const trs = table.querySelectorAll('tr');
    trs.forEach(tr => {
      const hasClass = tr.hasAttribute('class');
      const hasStyle = tr.hasAttribute('style');
      if (hasClass || hasStyle) {
        const attrName = hasClass ? `class="${tr.getAttribute('class')}"` : `style="${tr.getAttribute('style')}"`;
        let trLoc = { line: tableLoc.line, col: 1 };
        for (let i = tableLoc.line - 1; i < lines.length; i++) {
          if (lines[i].includes('<tr') && (lines[i].includes('class=') || lines[i].includes('style='))) {
            trLoc = { line: i + 1, col: lines[i].indexOf('<tr') + 1 };
            break;
          }
        }
        issues.push({
          ruleId: 'table-structure-check',
          line: trLoc.line,
          col: trLoc.col,
          length: 3,
          message: `<tr> element must not have classes or inline styles (found ${attrName}). Styles belong on <td> classes (PRH Spec §2.11.1 Item 4c)`,
          detail: `Found <tr> with ${attrName}`
        });
      }
    });

    // CHECK 5: Cell content in <td> and <th> must be wrapped in <p> (PRH Spec §2.11.1 Item 4e)
    const cells = table.querySelectorAll('th, td');
    cells.forEach(cell => {
      // Check if direct children contain text nodes with non-whitespace content outside <p>
      let hasDirectText = false;
      for (let node of cell.childNodes) {
        if (node.nodeType === 3 /* TEXT_NODE */ && node.textContent.trim().length > 0) {
          hasDirectText = true;
          break;
        }
      }

      // Check if direct element children contain a <p> tag
      const pChild = Array.from(cell.children).find(child => child.tagName.toLowerCase() === 'p');
      const isMissingP = hasDirectText || !pChild;

      if (isMissingP) {
        const cellTag = cell.tagName.toLowerCase();
        const cellText = cell.textContent.trim().slice(0, 25);
        let cellLoc = { line: tableLoc.line, col: 1 };
        for (let i = tableLoc.line - 1; i < lines.length; i++) {
          if (lines[i].includes(`<${cellTag}`) && (!cellText || lines[i].includes(cellText.slice(0, 10)))) {
            cellLoc = { line: i + 1, col: lines[i].indexOf(`<${cellTag}`) + 1 };
            break;
          }
        }

        issues.push({
          ruleId: 'table-structure-check',
          line: cellLoc.line,
          col: cellLoc.col,
          length: cellTag.length + 2,
          message: `<${cellTag}> cell text must be wrapped in a <p> tag (e.g. <${cellTag}><p class="tb">...</p></${cellTag}>) (PRH Spec §2.11.1 Item 4e)`,
          detail: `Cell content "${cellText}" is not wrapped in <p>`
        });
      }
    });
  });

  return issues;
};

window.RULES['endnote-reference-check'] = function(parsed) {
  const issues = [];
  const lines = parsed.lines;

  // Pattern matching links pointing to an endnote document or anchor:
  // e.g. href="nts.xhtml#note_1", href="notes.xhtml#en1", href="015_notes.xhtml#...", href="...#en_1", href="...#endnote..."
  // Also internal references like href="#en1" or href="#endnote_1"
  const ENDNOTE_HREF_PATTERN = /(?:(?:nts|notes?|endnotes?)\.xhtml#[^"'>\s]+|#[a-zA-Z0-9_-]*(?:en|endnote)[a-zA-Z0-9_-]*)/i;

  const A_TAG_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    // Skip HTML comments
    const trimmed = line.trim();
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) return;

    // Skip backlink paragraphs in notes sections if present
    if (/<p\b[^>]*class\s*=\s*["'][^"']*\ben\b[^"']*["'][^>]*>/i.test(line)) return;

    A_TAG_RE.lastIndex = 0;
    let match;
    while ((match = A_TAG_RE.exec(line)) !== null) {
      const matchIndex = match.index;
      const fullMatch = match[0];
      const attrs = match[1];
      const innerText = match[2].replace(/<[^>]+>/g, '').trim();

      // Check if href links to an endnote file/destination
      const hrefMatch = attrs.match(/href\s*=\s*["']([^"']*)["']/i);
      if (!hrefMatch) continue;
      const href = hrefMatch[1];

      if (!ENDNOTE_HREF_PATTERN.test(href)) continue;

      // Skip backlink anchors (e.g. href pointing back to backlink like href="...#note_backlink_1")
      if (/backlink/i.test(href)) continue;

      // Check classes on <a>
      const classMatch = attrs.match(/class\s*=\s*["']([^"']*)["']/i);
      const classes = classMatch ? classMatch[1].split(/\s+/) : [];

      if (!classes.includes('enref')) {
        // Calculate col offset to inner text
        const openTagMatch = fullMatch.match(/^<a\b[^>]*>/i);
        const innerOffset = openTagMatch ? openTagMatch[0].length : 0;

        issues.push({
          ruleId: 'endnote-reference-check',
          line: lineNum,
          col: matchIndex + innerOffset + 1,
          length: innerText.length || 1,
          message: `Numbered endnote callout ("${innerText}") linking to "${href}" must have class="enref" (PRH Spec §2.12.1)`,
          detail: `Endnote reference anchor "${fullMatch.slice(0, 50)}" is missing class="enref"`
        });
      }
    }
  });

  return issues;
};

window.runRule = function (ruleId, parsed, enabled) {
  const config = window.RULES_CONFIG.find(r => r.id === ruleId);
  if (!config || !enabled) return [];
  const fn = window.RULES[ruleId];
  if (!fn) return [];
  return fn(parsed).map(r => ({ ...r, severity: r.severity || config.severity, ruleName: config.name }));
};
