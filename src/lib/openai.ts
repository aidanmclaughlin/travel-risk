import OpenAI from 'openai';
import { z } from 'zod';
import { SingleEstimate } from './types';

const SIMULATE = (process.env.SIMULATE_DEEP_RESEARCH ?? '').toLowerCase() === 'true' || !process.env.OPENAI_API_KEY;
const MODEL = process.env.DR_MODEL || 'o3';

const OutputSchema = z.object({
  probability: z.number().min(0).max(1),
  report: z.string(),
  citations: z.array(z.object({ url: z.string().url().or(z.string()), title: z.string().optional() })).optional().default([]),
});

export async function deepResearchRisk(): Promise<SingleEstimate> {
  if (SIMULATE) {
    const p = clamp01(0.12 + randn_bm() * 0.05); // around 12% with some variance
    return {
      probability: p,
      report: `Simulated analysis: Estimated probability ${Math.round(p * 100)}% for a U.S. non-citizen traveler to face visa/entry denial issues on re-entry. This is placeholder data; set SIMULATE_DEEP_RESEARCH=false with a valid OPENAI_API_KEY to run live.`,
      citations: [
        { url: 'https://www.dhs.gov/', title: 'DHS' },
        { url: 'https://travel.state.gov/', title: 'U.S. State Department' },
      ],
    };
  }

  const client = new OpenAI({ timeout: 3600 * 1000 });
  const prompt = buildPrompt();
  const input = [{ role: 'user' as const, content: prompt }];
  let resp: Awaited<ReturnType<typeof client.responses.create>>;
  try {
    resp = MODEL.includes('deep-research')
      ? await client.responses.create({
          model: MODEL,
          input,
          tools: [
            { type: 'web_search_preview' },
            { type: 'code_interpreter', container: { type: 'auto' } },
          ],
          // Request aggregated text output for consistency across models/SDK versions
          text: { format: { type: 'text' } },
          max_output_tokens: 2000,
        })
      : await client.responses.create({
          model: MODEL,
          input,
          reasoning: { effort: 'high' },
          text: { format: { type: 'text' } },
          max_output_tokens: 2000,
        });
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string; stack?: string } | undefined;
    console.error('[LLM] responses.create failed', { name: e?.name, message: e?.message });
    const p = clamp01(0.2 + randn_bm() * 0.05);
    return {
      probability: p,
      report: 'LLM call failed — using fallback estimate. Check server logs for details.',
      citations: [],
    };
  }

  // Try to parse a JSON block first
  let text = (resp.output_text ?? '').trim();
  if (!text) {
    // Fallback: collect text from response.output tree
    text = collectOutputText(resp).trim();
    if (!text) {
      // Try to provide a compact structural summary for debugging in production logs
      try {
        const s = summarizeResponseShape(resp);
        console.warn('[LLM] output_text empty and collected text empty — response shape', s);
      } catch {
        console.warn('[LLM] output_text empty and collected text empty');
      }
    }
  }
  const parsed = extractJson(text);
  if (parsed) {
    const safe = OutputSchema.safeParse(parsed);
    if (safe.success) {
      const { probability, report, citations } = safe.data;
      return { probability, report, citations: citations?.map(c => ({ url: c.url, title: c.title })) ?? [] };
    }
    console.warn('[LLM] JSON present but schema mismatch', { keys: Object.keys(parsed as object) });
  }
  // Fallback: naive extraction of probability number in [0,1]
  const prob = extractProbability(text);
  if (prob == null) {
    console.warn('[LLM] Could not extract probability from text', { length: text.length });
  }
  return {
    probability: prob ?? 0.2,
    report: text.slice(0, 4000) || 'Model returned no text.',
    citations: [],
  };
}

function collectOutputText(resp: unknown): string {
  type U = Record<string, unknown>;
  const r = resp as U;
  // 1) Prefer Responses API aggregated output_text if present
  const agg = (r as U).output_text;
  if (typeof agg === 'string' && agg.trim()) return agg;

  // 2) Walk the Responses API output[] tree and gather text parts
  const out = r.output as unknown[] | undefined;
  let buf = '';
  if (Array.isArray(out)) {
    // First pass: strict message/content with known part types
    for (const item of out) {
      const it = item as U;
      if (it.type !== 'message') continue;
      const content = it.content as unknown[] | undefined;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        const p = part as U;
        const t = typeof p.text === 'string' ? p.text : '';
        if ((p.type === 'output_text' || p.type === 'text') && t) buf += t;
      }
    }
    if (buf.trim()) return buf;

    // Second pass: recursively gather any text-bearing parts under output items
    const limit = 16000; // defensive cap
    const seen = new Set<unknown>();
    function walk(v: unknown): void {
      if (buf.length >= limit) return;
      if (v && typeof v === 'object') {
        if (seen.has(v)) return;
        seen.add(v);
        if (Array.isArray(v)) {
          for (const el of v) walk(el);
          return;
        }
        const o = v as U;
        const tprop = o.type;
        const text = o.text;
        const content = o.content as unknown;
        // Prefer recognized shapes
        if ((tprop === 'text' || tprop === 'output_text') && typeof text === 'string' && text) {
          buf += text;
        } else if (tprop === 'message') {
          if (Array.isArray(content)) walk(content);
          else if (typeof content === 'string') buf += content;
        } else {
          // Generic fallbacks inside output items only
          if (typeof text === 'string' && text) buf += text;
          if (typeof content === 'string' && content) buf += content;
          else if (Array.isArray(content)) walk(content);
          // walk all props shallowly to catch nested 'text' fields
          for (const k of Object.keys(o)) {
            const val = (o as U)[k];
            if (k === 'text' && typeof val === 'string') buf += val;
            else if (k === 'content') walk(val);
          }
        }
      }
    }
    for (const item of out) walk(item);
    if (buf.trim()) return buf;
  }

  // 3) Fallback for legacy Chat Completions shape: choices[].message.content
  const choices = (r as U).choices as unknown[] | undefined;
  if (Array.isArray(choices) && choices.length) {
    const first = choices[0] as U;
    const msg = first.message as U | undefined;
    const content = msg?.content as unknown;
    if (typeof content === 'string') return content;
  }

  return '';
}

function summarizeResponseShape(resp: unknown) {
  type U = Record<string, unknown>;
  const r = resp as U | null | undefined;
  const keys = r && typeof r === 'object' ? Object.keys(r as object) : [];
  const outUnknown = (r as U)?.output as unknown;
  const outArr = Array.isArray(outUnknown) ? (outUnknown as unknown[]) : undefined;
  const outType = outArr ? 'array' : typeof outUnknown;
  const outLen = outArr?.length;
  let firstMessageParts: string[] | undefined;
  if (outArr && outArr.length) {
    const first = outArr[0] as U;
    if ((first as U)?.type === 'message') {
      const content = (first as U)?.content as unknown[] | undefined;
      if (Array.isArray(content)) {
        firstMessageParts = content
          .map((p) => (p as U)?.type)
          .filter((t): t is string => typeof t === 'string');
      }
    }
  }
  const agg = (r as U)?.output_text as unknown;
  const hasAgg = typeof agg === 'string' && agg.length > 0;
  const model = (r as U)?.model as unknown;
  return { keys, model, output: { type: outType, len: outLen, firstMessageParts }, hasOutputText: hasAgg };
}

function buildPrompt() {
  return `You are a careful, conservative research analyst estimating a probability for a specific risk.

Task: Estimate the probability that a U.S. non-citizen traveler who departs the U.S. today and attempts to re-enter within the next 30 days will experience a visa-related adverse outcome at the U.S. border (e.g., visa revocation, entry denial, detention, or deportation).

Origin: United States. Estimate an all-destinations aggregate risk (U.S. to any country), weighted toward common destinations and current U.S. policy signals.

Do:
- Prioritize official U.S. government sources (DHS, CBP, USCIS, DOS), airline/airport advisories, and reputable press when citing.
- Consider traveler variability: visa categories, countries of origin, and recent policy changes. When aggregating, be conservative.
- Return a single probability in [0,1]. The probability should reflect the base rate for a typical non-citizen traveler under current conditions.
- Also write an extensive, well-structured Markdown report (300–700 words) with headings, bullet points, and clear, readable sections, suitable for direct rendering.

At the end of your response, include a JSON object with the following shape and no extra keys:
{
  "probability": <number 0..1>,
  "report": "<extensive Markdown report>",
  "citations": [ { "url": "<source url>", "title": "<optional>" }, ... ]
}

Date (UTC): ${new Date().toISOString().slice(0, 10)}
`;
}

function extractJson(text: string): unknown | null {
  // Prefer a JSON object at the end that contains the key "probability"
  const endAnchored = text.match(/({[\s\S]*"probability"[\s\S]*})\s*$/);
  if (endAnchored) {
    try { return JSON.parse(endAnchored[1]); } catch {}
  }
  // Fallback: take the last occurrence of a JSON-looking object that has "probability"
  const probIdx = text.lastIndexOf('"probability"');
  if (probIdx !== -1) {
    // naive expansion to nearest braces around the index
    const start = text.lastIndexOf('{', probIdx);
    const end = text.indexOf('}', probIdx);
    if (start !== -1 && end !== -1 && end > start) {
      const maybe = text.slice(start, end + 1);
      try { return JSON.parse(maybe); } catch {}
    }
  }
  // Last resort: original broad slice (may fail if braces exist earlier in the report)
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  return null;
}

function extractProbability(text: string): number | null {
  // Look for patterns like 0.12 or 12%
  const pct = text.match(/(\d{1,2}(?:\.\d+)?)\s?%/);
  if (pct) {
    const v = parseFloat(pct[1]);
    if (!Number.isNaN(v)) return clamp01(v / 100);
  }
  const frac = text.match(/\b0?\.\d{1,3}\b/);
  if (frac) {
    const v = parseFloat(frac[0]);
    if (!Number.isNaN(v)) return clamp01(v);
  }
  return null;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function randn_bm() {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
