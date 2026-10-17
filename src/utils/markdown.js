/**
 * Detects whether a bracketed string is an equation/mathematical expression.
 * Prevents false positives on citations ([1]), footnotes, or normal English text.
 */
function isMathExpression(content) {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length < 2) return false;

  // Pure digits or citations like [1], [2, 3], [1-5]
  if (/^\d+(?:[,\s-]+\d+)*$/.test(trimmed)) return false;

  // Has backslash LaTeX commands (e.g. \sigma, \frac, \mathbf, \text, \sqrt, \cdot, etc.)
  if (/\\[a-zA-Z]+/.test(trimmed)) {
    return true;
  }

  // Common math symbols, relations, and operations
  const hasSubOrSuper = /[_^]\{?[a-zA-Z0-9+\-*]+\}?/.test(trimmed);
  const hasRelation = /[=≈≠≤≥<>]|\\(?:approx|le|ge|leq|geq|neq|equiv|sim|propto|coloneqq|coloneq)/.test(trimmed);
  const hasMathOperators = /[+\-*/×÷·±]/.test(trimmed);

  // If it has relation (=, <, >, etc.) or (sub/superscript with operators)
  if (hasRelation || (hasSubOrSuper && hasMathOperators)) {
    const words = trimmed.split(/\s+/).filter((w) => /^[a-zA-Z]{3,}$/.test(w));
    if (words.length <= 2) {
      return true;
    }
  }

  return false;
}

/**
 * Scans for standalone bracketed expressions `[ ... ]` and converts those
 * that contain mathematical expressions into display math blocks `$$ ... $$`
 * or inline math `$ ... $`.
 * Correctly handles nested brackets (e.g. `[ \mathbf{w}[i] + b ]`).
 */
function convertBracketMath(str) {
  let result = "";
  let i = 0;
  while (i < str.length) {
    if (str[i] === "[") {
      let depth = 1;
      let j = i + 1;
      while (j < str.length && depth > 0) {
        if (str[j] === "[") depth++;
        else if (str[j] === "]") depth--;
        j++;
      }
      if (depth === 0) {
        const inner = str.slice(i + 1, j - 1);
        let punct = "";
        let k = j;
        if (k < str.length && [".", ",", ";"].includes(str[k])) {
          punct = str[k];
          k++;
        }
        if (isMathExpression(inner)) {
          const trimmed = inner.trim();
          const mathWithPunct = punct ? `${trimmed} ${punct}` : trimmed;
          const before = str.slice(Math.max(0, i - 2), i);
          const isBlock =
            before.includes("\n") ||
            before === "" ||
            trimmed.includes("\n") ||
            trimmed.length > 25;

          if (isBlock) {
            result += `\n\n$$\n${mathWithPunct}\n$$\n\n`;
          } else {
            result += `$$${mathWithPunct}$$`;
          }
          i = k;
          continue;
        }
      }
    }
    result += str[i];
    i++;
  }
  return result;
}

/**
 * Robust Markdown & LaTeX preprocessor for remark-math and rehype-katex.
 * Standardizes mathematical delimiters while strictly preserving code blocks,
 * inline code, Markdown links, and other Markdown elements.
 */
export function formatMarkdown(text = "") {
  if (typeof text !== "string" || !text) return "";

  const tokens = [];
  const makePlaceholder = (type) =>
    `\x02__SUBCHAT_${type}_${tokens.length}__\x03`;

  // 1. Protect code blocks and inline code
  // 1a. Fenced code blocks
  let processed = text.replace(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g, (match) => {
    const placeholder = makePlaceholder("FENCE");
    tokens.push({ placeholder, content: match });
    return placeholder;
  });

  // 1b. Inline code
  processed = processed.replace(/(`+)([\s\S]*?)\1/g, (match) => {
    const placeholder = makePlaceholder("INLINE_CODE");
    tokens.push({ placeholder, content: match });
    return placeholder;
  });

  // 1c. Markdown links & images: [text](url) and ![alt](url)
  processed = processed.replace(/(!?\[[^\]]*?\]\([^)]*?\))/g, (match) => {
    const placeholder = makePlaceholder("MD_LINK");
    tokens.push({ placeholder, content: match });
    return placeholder;
  });

  // 1d. Markdown reference-style links: [text][ref] and [ref]: url
  processed = processed.replace(
    /(\[[^\]]*?\]\[[^\]]*?\]|^\s*\[[^\]]+\]:\s*\S+)/gm,
    (match) => {
      const placeholder = makePlaceholder("REF_LINK");
      tokens.push({ placeholder, content: match });
      return placeholder;
    }
  );

  // 1e. Task list checkboxes: - [ ] or - [x]
  processed = processed.replace(/(\[\s*[xX ]\s*\])/g, (match) => {
    const placeholder = makePlaceholder("TASK_BOX");
    tokens.push({ placeholder, content: match });
    return placeholder;
  });

  // 2. Convert explicit LaTeX display math \[ ... \] or \\[ ... \\]
  processed = processed.replace(
    /(?:\\+\[)([\s\S]*?)(?:\\+\])([.,;]?)/g,
    (_, math, punct) => {
      const trimmed = math.trim();
      const p = punct ? ` ${punct.trim()}` : "";
      return `\n\n$$\n${trimmed}${p}\n$$\n\n`;
    }
  );

  // 3. Convert explicit LaTeX inline math \( ... \) or \\( ... \\)
  processed = processed.replace(/(?:\\+\()([\s\S]*?)(?:\\+\))/g, (_, math) => {
    return `$${math.trim()}$`;
  });

  // 4. Convert standalone LaTeX environments without $$
  const latexEnvRegex =
    /(?<!\$)\s*(\\begin\{(?:align\*?|equation\*?|gather\*?|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|split)\}[\s\S]*?\\end\{(?:align\*?|equation\*?|gather\*?|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|split)\})\s*(?!\$)/g;
  processed = processed.replace(latexEnvRegex, (_, env) => {
    return `\n\n$$\n${env.trim()}\n$$\n\n`;
  });

  // 5. Convert standalone square brackets [ ... ] containing math
  processed = convertBracketMath(processed);

  // 6. Fix $$ with trailing punctuation directly attached (e.g. $$a=b$$. -> $$a=b .$$)
  processed = processed.replace(/\$\$\s*([.,;])(?!\$)/g, (_, punct) => {
    return ` ${punct} $$`;
  });

  // 7. Ensure standard display math blocks have newlines around $$
  processed = processed.replace(
    /\n\s*\$\$\s*\n([\s\S]*?)\n\s*\$\$\s*\n/g,
    (_, math) => {
      return `\n\n$$\n${math.trim()}\n$$\n\n`;
    }
  );

  // 8. Restore protected tokens in reverse order
  for (let idx = tokens.length - 1; idx >= 0; idx--) {
    const { placeholder, content } = tokens[idx];
    processed = processed.split(placeholder).join(content);
  }

  return processed;
}

export default formatMarkdown;
