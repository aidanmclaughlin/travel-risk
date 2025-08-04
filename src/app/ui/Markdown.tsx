"use client";

import React from "react";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(md: string): string {
  // code spans
  md = md.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);
  // bold
  md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italics
  md = md.replace(/\*(?!\s)([^*]+)\*/g, '<em>$1</em>');
  // links [text](url)
  md = md.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return md;
}

function mdToHtml(md: string): string {
  // Handle fenced code blocks first
  const codeBlockRegex = /```([\w-]*)\n([\s\S]*?)```/g;
  const placeholders: string[] = [];
  md = md.replace(codeBlockRegex, (_, _lang, code) => {
    const html = `<pre><code>${escapeHtml(code)}</code></pre>`;
    placeholders.push(html);
    return `__CODEBLOCK_${placeholders.length - 1}__`;
  });

  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let listOpen = false;
  let olistOpen = false;

  const flushList = () => {
    if (listOpen) { out.push('</ul>'); listOpen = false; }
    if (olistOpen) { out.push('</ol>'); olistOpen = false; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); out.push(''); continue; }
    if (/^######\s+/.test(line)) { flushList(); out.push(`<h6>${inline(escapeHtml(line.replace(/^######\s+/, '')))}</h6>`); continue; }
    if (/^#####\s+/.test(line)) { flushList(); out.push(`<h5>${inline(escapeHtml(line.replace(/^#####\s+/, '')))}</h5>`); continue; }
    if (/^####\s+/.test(line)) { flushList(); out.push(`<h4>${inline(escapeHtml(line.replace(/^####\s+/, '')))}</h4>`); continue; }
    if (/^###\s+/.test(line)) { flushList(); out.push(`<h3>${inline(escapeHtml(line.replace(/^###\s+/, '')))}</h3>`); continue; }
    if (/^##\s+/.test(line)) { flushList(); out.push(`<h2>${inline(escapeHtml(line.replace(/^##\s+/, '')))}</h2>`); continue; }
    if (/^#\s+/.test(line))  { flushList(); out.push(`<h1>${inline(escapeHtml(line.replace(/^#\s+/, '')))}</h1>`); continue; }

    if (/^[-*]\s+/.test(line)) {
      if (!listOpen) { out.push('<ul>'); listOpen = true; }
      out.push(`<li>${inline(escapeHtml(line.replace(/^[-*]\s+/, '')))}</li>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      if (!olistOpen) { out.push('<ol>'); olistOpen = true; }
      out.push(`<li>${inline(escapeHtml(line.replace(/^\d+\.\s+/, '')))}</li>`);
      continue;
    }
    if (/^>\s+/.test(line)) {
      flushList();
      out.push(`<blockquote><p>${inline(escapeHtml(line.replace(/^>\s+/, '')))}</p></blockquote>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushList();
      out.push('<hr />');
      continue;
    }

    // paragraph
    flushList();
    out.push(`<p>${inline(escapeHtml(line))}</p>`);
  }
  flushList();

  let html = out.join('\n');
  // restore code blocks
  html = html.replace(/__CODEBLOCK_(\d+)__/g, (_, i) => placeholders[Number(i)] ?? '');
  return html;
}

export default function Markdown({ content }: { content: string }) {
  const html = React.useMemo(() => mdToHtml(content || ''), [content]);
  return (
    <article
      className="prose prose-invert max-w-none"
      style={{ color: 'var(--foreground)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
