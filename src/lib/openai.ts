import OpenAI from 'openai';
import { z } from 'zod';
import { SingleEstimate } from './types';

const MODEL = process.env.DR_MODEL || 'o3';

const OutputSchema = z.object({
  probability: z.number().min(0).max(1),
  report: z.string(),
  citations: z.array(z.object({ url: z.string().url().or(z.string()), title: z.string().optional() })).optional().default([]),
});

export async function deepResearchRisk(): Promise<SingleEstimate> {
  const client = new OpenAI({ timeout: 3600 * 1000 });
  const prompt = buildPrompt();
  const input = [{ role: 'user' as const, content: prompt }];
  const resp = MODEL.includes('deep-research')
    ? await client.responses.create({
        model: MODEL,
        input,
        tools: [
          { type: 'web_search_preview' },
          { type: 'code_interpreter', container: { type: 'auto' } },
        ],
      })
    : await client.responses.create({
        model: MODEL,
        input,
        reasoning: { effort: 'high' },
      });

  // Strict parsing only: require message/output_text and a terminal JSON block
  const text = extractOutputTextStrict(resp);
  const parsed = extractJsonStrict(text);
  const safe = OutputSchema.safeParse(parsed);
  if (!safe.success) throw new Error('LLM output did not match required schema');
  const { probability, report, citations } = safe.data;
  return { probability, report, citations: citations?.map(c => ({ url: c.url, title: c.title })) ?? [] };
}

function extractOutputTextStrict(resp: unknown): string {
  type U = Record<string, unknown>;
  const r = resp as U;
  const out = r.output as unknown[] | undefined;
  if (!Array.isArray(out) || out.length === 0) throw new Error('LLM response missing output');
  let buf = '';
  for (const item of out) {
    const it = item as U;
    if (it.type !== 'message') continue;
    const content = it.content as unknown[] | undefined;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const p = part as U;
      if (p.type === 'output_text' && typeof p.text === 'string') buf += p.text;
    }
  }
  const text = buf.trim();
  if (!text) throw new Error('LLM response contained no output_text');
  return text;
}

// (no extra debug helpers)

function buildPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a careful, conservative research analyst estimating a probability for a specific risk.

Task: Estimate the probability that a U.S. non-citizen traveler who departs the U.S. today and attempts to re-enter within the next 30 days will experience a visa-related adverse outcome at the U.S. border (e.g., visa revocation, entry denial, detention, or deportation).

Origin: United States. Estimate an all-destinations aggregate risk (U.S. to any country), weighted toward common destinations and current U.S. policy signals.

Context to incorporate explicitly:
- Date (UTC): ${today}
- Current U.S. administration: Second Trump administration. Consider current enforcement posture and public statements from CBP and DHS regarding re-entry screening and consequences for prior criminal convictions.
- Political re-entry concerns: Reports indicate that even law‑abiding non‑citizens with no criminal record have faced intensified scrutiny or adverse outcomes at ports of entry under the current administration. Civil‑liberties groups and press accounts allege discriminatory enforcement (including racism, anti‑LGBTQ+ bias, and viewpoint‑based targeting), though official policy may deny such intent.
- Specific reported patterns to evaluate and, where possible, cite: (a) transgender travelers facing issues due to name/ID mismatches; (b) international students and scholars questioned or turned away due to perceived political activity (e.g., anti‑Israel positions); (c) lawful permanent residents with historic minor offenses facing detention or removal proceedings. Treat these as claims to validate against official policy, case law, and reputable reporting; note evidentiary limits when applicable.
- CBP has emphasized that lawful permanent residents with prior convictions may face detention and removal proceedings at ports of entry. Reflect how this posture, combined with the reported patterns above, affects baseline risk for a typical non‑citizen traveler.

Do:
- Prioritize official U.S. government sources (DHS, CBP, USCIS, DOS), airline/airport advisories, and reputable press when citing. Where possible, cite primary sources.
- Consider traveler variability (visa categories, countries of origin, prior criminal history), and recent policy changes. When aggregating to a single number, be conservative.
- Return a single probability in [0,1] for the base rate under current conditions. If the evidence indicates a materially elevated risk under the current administration, reflect that in the estimate.
- Also write an extensive, well-structured Markdown report (300–700 words) with headings, bullets, and clear, readable sections suitable for direct rendering.

At the end of your response, include a JSON object with the following shape and no extra keys:
{
  "probability": <number 0..1>,
  "report": "<extensive Markdown report>",
  "citations": [ { "url": "<source url>", "title": "<optional>" }, ... ]
}
`;
}

function extractJsonStrict(text: string): unknown {
  const endAnchored = text.match(/({[\s\S]*"probability"[\s\S]*})\s*$/);
  if (!endAnchored) throw new Error('LLM response missing terminal JSON block');
  return JSON.parse(endAnchored[1]);
}

// (no probability extraction fallbacks)

// (unused helpers removed)
