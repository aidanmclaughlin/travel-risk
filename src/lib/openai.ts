import OpenAI from 'openai';
import { z } from 'zod';
import { SingleEstimate } from './types';

const SIMULATE = (process.env.SIMULATE_DEEP_RESEARCH ?? '').toLowerCase() === 'true' || !process.env.OPENAI_API_KEY;
const MODEL = process.env.DR_MODEL || 'o3-deep-research';
const MAX_TOOL_CALLS = Number.isFinite(Number(process.env.DR_MAX_TOOL_CALLS))
  ? Math.max(1, Number(process.env.DR_MAX_TOOL_CALLS))
  : undefined;

const OutputSchema = z.object({
  probability: z.number().min(0).max(1),
  reasoning: z.string(),
  citations: z.array(z.object({ url: z.string().url().or(z.string()), title: z.string().optional() })).optional().default([]),
});

export async function deepResearchRisk(destination?: string | null): Promise<SingleEstimate> {
  if (SIMULATE) {
    const p = clamp01(0.12 + randn_bm() * 0.05); // around 12% with some variance
    return {
      probability: p,
      report: `Simulated analysis: Estimated probability ${Math.round(p * 100)}% for a U.S. non-citizen traveler to face visa/entry denial issues on return${destination ? ` from ${destination}` : ''}. This is placeholder data; set SIMULATE_DEEP_RESEARCH=false with a valid OPENAI_API_KEY to run live.`,
      citations: [
        { url: 'https://www.dhs.gov/', title: 'DHS' },
        { url: 'https://travel.state.gov/', title: 'U.S. State Department' },
      ],
    };
  }

  const client = new OpenAI({ timeout: 3600 * 1000 });
  const input = buildPrompt(destination ?? undefined);

  const resp = await client.responses.create({
    model: MODEL,
    input,
    tools: [
      { type: 'web_search_preview' },
      { type: 'code_interpreter', container: { type: 'auto' } },
    ],
    max_output_tokens: 2000,
    ...(MAX_TOOL_CALLS ? { max_tool_calls: MAX_TOOL_CALLS } as any : {}),
  });

  // Try to parse a JSON block first
  const text = (resp.output_text ?? '').trim();
  const parsed = extractJson(text);
  if (parsed) {
    const safe = OutputSchema.safeParse(parsed);
    if (safe.success) {
      const { probability, reasoning, citations } = safe.data;
      return { probability, report: reasoning, citations: citations?.map(c => ({ url: c.url, title: c.title })) ?? [] };
    }
  }
  // Fallback: naive extraction of probability number in [0,1]
  const prob = extractProbability(text);
  return {
    probability: prob ?? 0.2,
    report: text.slice(0, 4000) || 'Deep research returned no text.',
    citations: [],
  };
}

function buildPrompt(destination?: string) {
  return `You are a careful, conservative research analyst estimating a probability for a specific risk.

Task: Estimate the probability that a U.S. non-citizen traveler who departs the U.S. today and attempts to re-enter within the next 30 days will experience a visa-related adverse outcome at the U.S. border (e.g., visa revocation, entry denial, detention, or deportation).

Origin: United States.
If a destination is specified, estimate risk conditional on travel from the U.S. to that destination. Otherwise, estimate an all-destinations aggregate risk (U.S. to any country), weighted toward common destinations and current global policy signals.

Do:
- Use only up-to-date, reputable sources. Prioritize official U.S. government sources (DHS, CBP, USCIS, DOS), major airlines/airport advisories, and reputable press.
- Use web search to find recent policy actions or executive orders and credible reporting of enforcement patterns affecting non-citizens.
- Consider traveler variability: visa categories, countries of origin, and recent policy changes. When aggregating, be conservative.
- Return a single probability in [0,1]. The probability should reflect the base rate for a typical non-citizen traveler under current conditions.
- Include a concise reasoning summary and citations.

Return JSON ONLY with the following shape and no extra keys:
{
  "probability": <number 0..1>,
  "reasoning": "<100-250 words explaining the estimate>",
  "citations": [ { "url": "<source url>", "title": "<optional>" }, ... ]
}

Destination: ${destination ?? 'ANY/AGGREGATE'}
Date (UTC): ${new Date().toISOString().slice(0, 10)}
`;
}

function extractJson(text: string): unknown | null {
  // Find first JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const maybe = text.slice(start, end + 1);
  try {
    return JSON.parse(maybe);
  } catch {
    return null;
  }
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
