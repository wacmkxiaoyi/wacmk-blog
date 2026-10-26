import Prism from "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-markdown";

let markdownGrammarExtended = false;

function createDirectiveInside(name: string) {
  return {
    "directive-name": {
      pattern: new RegExp(`^::${name}`),
      alias: "keyword",
    },
    "directive-brace": {
      pattern: /[{}]/,
      alias: "punctuation",
    },
    "directive-attr-name": {
      pattern: /\b[a-zA-Z_][\w-]*(?==)/,
      alias: "attr-name",
    },
    "directive-equals": {
      pattern: /=/,
      alias: "operator",
    },
    "directive-kind-value": {
      pattern: /kind="([^"\\]|\\.)*"/,
      inside: {
        "directive-attr-name": {
          pattern: /^kind/,
          alias: "attr-name",
        },
        "directive-equals": {
          pattern: /=/,
          alias: "operator",
        },
        "directive-attr-value": {
          pattern: /"([^"\\]|\\.)*"$/,
          alias: "string",
        },
      },
    },
    "directive-attr-value": {
      pattern: /"([^"\\]|\\.)*"/,
      alias: "string",
    },
  };
}

function aliasAdmonitionVariantTokens(html: string) {
  return html.replace(
    /<span class="token admonition-variant([^"]*)">(note|tip|warning|error)<\/span>/g,
    (_match, classes, variant) => {
      return `<span class="token admonition-variant${classes} ${variant}">${variant}</span>`;
    },
  );
}

function aliasDirectiveKindValues(html: string) {
  return html.replace(
    /(<span class="token directive-attr-name[^"]*">kind<\/span><span class="token directive-equals[^"]*">=<\/span><span class="token directive-attr-value)([^"]*)(">"[^<]*"<\/span>)/g,
    "$1 directive-kind-value$2$3",
  );
}

function aliasColorTextTokens(html: string) {
  return html.replace(
    /(<span class="token extended-color-text">[\s\S]*?<span class="token color-text-class-prefix[^\"]*">\.md-color-<\/span>)(berry|rose|orange|gold|green|cyan|blue|purple)(<span class="token color-text-brace punctuation">\}<\/span><\/span>)/g,
    (_match, before, token, after) => {
      return `${before}<span class="token color-text-token ${token}">${token}</span>${after}`;
    },
  );
}

export function ensureMarkdownGrammarExtensions() {
  if (markdownGrammarExtended) {
    return;
  }

  Prism.languages.insertBefore("markdown", "title", {
    "extended-admonition": {
      pattern:
        /^\s*(\?\?\?\+?|!!!)\s+(note|tip|warning|error)(?:\s+("([^"\\]|\\.)*"))?\s*$/m,
      inside: {
        "admonition-marker": {
          pattern: /^\s*(\?\?\?\+?|!!!)/,
          alias: "important",
        },
        "admonition-variant": {
          pattern: /\b(note|tip|warning|error)\b/,
          alias: "keyword",
        },
        "admonition-title": {
          pattern: /"([^"\\]|\\.)*"/,
          inside: {
            punctuation: /^"|"$/,
            string: /[^\"]+/,
          },
        },
      },
    },
    "extended-tabs": {
      pattern: /^\s*(===)\s+("([^"\\]|\\.)*")\s*$/m,
      inside: {
        "tabs-marker": {
          pattern: /^\s*===/,
          alias: "important",
        },
        "tabs-label": {
          pattern: /"([^"\\]|\\.)*"/,
          inside: {
            punctuation: /^"|"$/,
            string: /[^\"]+/,
          },
        },
      },
    },
    "extended-custom-directive": {
      pattern: /^\s*::custom\{[^}\n]*\}\s*$/m,
      inside: createDirectiveInside("custom"),
    },
    "extended-html-directive": {
      pattern: /(^\s*::html\s*$|^\s*:: .*$)/m,
      inside: {
        "directive-name": {
          pattern: /^::html|^::/,
          alias: "keyword",
        },
        "directive-html-content": {
          pattern: /.+$/,
          alias: "string",
        },
      },
    },
    "extended-video-directive": {
      pattern: /^\s*::video\{[^}\n]*\}\s*$/m,
      inside: createDirectiveInside("video"),
    },
    "extended-anchor-directive": {
      pattern: /^\s*::anchor\{[^}\n]*\}\s*$/m,
      inside: createDirectiveInside("anchor"),
    },
    "extended-color-text": {
      pattern:
        /\[([^\]]+)\]\{\.md-color-(berry|rose|orange|gold|green|cyan|blue|purple)\}/,
      inside: {
        "color-text-label": {
          pattern: /^\[[^\]]+\]/,
          inside: {
            punctuation: /^\[|\]$/,
            string: /[^\[\]]+/,
          },
        },
        "color-text-brace": {
          pattern: /[{}]/,
          alias: "punctuation",
        },
        "color-text-class-prefix": {
          pattern: /\.md-color-/,
          alias: "attr-name",
        },
        "color-text-token": {
          pattern: /(berry|rose|orange|gold|green|cyan|blue|purple)(?=\})/,
        },
      },
    },
  });

  markdownGrammarExtended = true;
}

export function highlightExtendedMarkdown(markdown: string) {
  ensureMarkdownGrammarExtensions();
  return aliasColorTextTokens(
    aliasDirectiveKindValues(
      aliasAdmonitionVariantTokens(
        Prism.highlight(markdown || " ", Prism.languages.markdown, "markdown"),
      ),
    ),
  );
}
