# TokenTrim Quality Rubric (benchmark gate)

Target: blind score ≥4.3/5, factual recall ≥95%, conversion success ≥95%.

## Scoring (1–5 each, blind)
1. **Factual retention** — numbers, names, dates, obligations preserved (weight 3×)
2. **Table accuracy** — headers/rows/units intact, no hallucinated cells (weight 2×)
3. **Heading order** — document order preserved, no shuffled sections (weight 1×)
4. **Noise removal** — headers/footers/disclaimers removed without losing content (weight 1×)
5. **Token efficiency** — tokens saved without quality loss (guardrail only; never optimize alone)

## Fixtures (benchmarks/run.js)
- research-paper, financial-table, contract (+ extend to 30 docs: papers, reports, manuals, resumes, scanned)

## Gates (CI)
- `npm run benchmark` must PASS (recall ≥95%, no branding footer, 100% fixture success)
- `npm run audit:permissions` + `npm run audit:network` must PASS
- `npm test` (vitest) must PASS
