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
  return `You are a careful, conservative research analyst estimating a probability for a specific travel risk.

Task
- Estimate the probability that a U.S. non-citizen traveler who departs the U.S. today and attempts to re-enter within the next 30 days will experience a visa- or inspection-related adverse outcome at the U.S. border (e.g., visa revocation, entry denial, expedited removal, detention, or referral to removal proceedings).

Scope and aggregation
- Origin: United States. Estimate an all-destinations aggregate risk (U.S. to any country) weighted toward common destinations and current U.S. policy signals.
- Focus on travel restrictions, security checks (including device searches), ideological screening, shortened visa validity/single-entry rules, interview waiver changes, bonds/fees, and enforcement posture under the current administration.
- Calibrate to a typical non-citizen traveler population (visa holders broadly), then discuss important variation by visa category and nationality where relevant. Produce a single base-rate probability in [0,1] reflecting current conditions.

Context to incorporate explicitly (July–early August 2025; Second Trump administration)
- Date (UTC): ${today}.
- Presidential Proclamation 10949 (June 4, 2025) issued under INA 212(f) imposes a tiered “travel ban”:
  • Full suspension of entry (immigrant and nonimmigrant) for nationals of Afghanistan, Burma/Myanmar, Chad, Republic of the Congo, Equatorial Guinea, Eritrea, Haiti, Iran, Libya, Somalia, Sudan, Yemen.
  • Partial suspensions for Burundi, Cuba, Laos, Sierra Leone, Togo, Turkmenistan, Venezuela (some categories barred; diplomatic/official generally allowed).
  • Prospective application from June 9, 2025; existing visas not auto-revoked. LPRs and dual nationals using an unaffected passport exempt; immediate relatives of U.S. citizens exempt with clear and convincing evidence (e.g., DNA) but other family categories barred.
  • Consular officers may reduce validity and issue single-entry visas; enhanced inspection likely.
- Interview waiver rollback: Most nonimmigrant interview waivers end Sept 2, 2025; many applicants (including minors/seniors) must attend interviews, increasing backlogs and renewal risk windows.
- Expanded social-media screening for F/M/J applicants (June 18, 2025): accounts expected to be public; officers assess for fraud, terrorism, antisemitism, or “hostile attitudes”; broad discretion; increased 221(g) administrative processing and delays.
- Reciprocity/validity changes (early July 2025): for many countries, new B/F/H/J/M/O visas reduced to 3 months, single entry; pre-July-8 visas retain original validity.
- Bond and fee measures: Pilot visa bonds of USD 5k–15k for travelers from certain high-overstay or inadequate-vetting countries; a USD 250 “visa integrity fee” on most nonimmigrant visa applications effective Oct 1, 2025.
- Registration requirement: USCIS renewed enforcement requiring those who entered without inspection to register and carry proof; DOJ/DHS prioritizing related prosecutions.
- Border search posture: CBP’s device search authority (basic vs advanced) continues; advanced searches require reasonable suspicion per DHS policy but routine basic searches do not. Device-derived information can be used in immigration proceedings. 2024 device searches totaled ~47k.
- Ideological screening and campus enforcement: Reports of visa revocations and entry denials tied to protest activity or online speech; administration statements emphasize excluding those deemed hostile to U.S. principles; litigation ongoing around specific actions (e.g., institution-targeted suspensions).
- Aggressive enforcement climate: Operation “Take Back America” signals heightened prosecutions for immigration violations in some districts.
- Rumored/future expansions: Country color lists (red/orange/yellow) and potential widening of bans; some proposals contested or temporarily enjoined (e.g., Harvard directive). Treat unfinalized items as uncertain; label clearly as rumor/draft and do not over-weight without corroboration.

Method and cautions
- If tools are available, perform a brief web search to confirm the above and capture any updates in the last 30–90 days; cite what you use. If tools are unavailable, ground your analysis in the context above and attribute contested items with appropriate caution.
- Distinguish verified policy from rumors/drafts; avoid overstating. Call out any temporary injunctions or pending litigation affecting applicability.
- Discuss heterogeneity by nationality, visa type, and traveler profile (e.g., prior criminal history); but keep the final probability as a single, conservative base rate for a typical non-citizen traveler today.
- This is not legal advice. Be transparent about uncertainty and data limits.

Reference leads (non-exhaustive; use for validation and citation where applicable)
- White House Proclamation 10949 (June 2025) — https://www.whitehouse.gov/presidential-actions/2025/06/restricting-the-entry-of-foreign-nationals-to-protect-the-united-states-from-foreign-terrorists-and-other-national-security-and-public-safety-threats/
- NAFSA: DOS reduces validity of new visas for a number of countries — https://www.nafsa.org/regulatory-information/dos-reduces-validity-new-visas-number-countries
- NAFSA: Social-media vetting guidance implications — https://www.nafsa.org/blog/11-Things-to-Know-Social-Media-Vetting-and-Implications
- Wildes & Weinberg: Interview waiver changes (effective Sept 2, 2025) — https://www.wildeslaw.com/news-events/in-the-news/changes-to-u-s-visa-interview-waiver-policy-effective-september-2-2025/
- Reuters: Visa bond pilot and visa integrity fee — https://www.reuters.com/world/us/us-could-require-up-15000-bonds-some-tourist-visas-under-pilot-program-2025-08-04/
- American Immigration Council: Registration requirement — https://www.americanimmigrationcouncil.org/fact-sheet/the-trump-administrations-registration-requirement-for-immigrants/
- NatLawReview: Digital privacy/device searches at U.S. borders — https://natlawreview.com/article/crossing-borders-electronics-know-your-rights-and-risks
- The Marshall Project: Targeting international students over protests — https://www.themarshallproject.org/2025/04/05/visa-immigration-first-amendment-protest-speech
- WOLA border update (enforcement trends) — https://www.wola.org/2025/03/weekly-u-s-mexico-border-update-february-migration-ice-arrests-guantanamo-empties-panama-releases/
- CILA: Second Trump administration immigration updates — https://cilacademy.org/2025/07/29/trump-administration-2-0-immigration-updates/

Deliverables
- Return a single probability in [0,1] for the current base rate of an adverse border outcome upon re-entry within 30 days.
- Produce a well-structured Markdown report (300–700 words) with clear sections (Overview, Key Drivers, Variability by Traveler, Recent Changes, Practical Implications, Confidence/Uncertainty).
- Provide a citations array of URLs (with optional titles) for key sources you relied on in this run.

At the end of your response, include a JSON object with the exact shape and no extra keys:
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
