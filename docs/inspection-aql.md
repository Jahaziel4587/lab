# Automatic AQL for incoming inspection

New incoming MTS and project lots calculate each physical inspection method independently using QAP-013 Rev C:

- Pages 11–12, tables A and B: normal single sampling, general levels I/II/III and special levels S1/S2/S3/S4.
- Page 13: Squeglia zero acceptance, a separate sampling plan without an inspection-level lookup.
- Defaults: normal, level II, AQL 1.0. The inspector selects the AQL required by the applicable SPEC; this feature does not extract AQL from PDF contents.
- Printed arrows select another plan, including its sample size and acceptance/rejection numbers. If the resulting sample reaches/exceeds the lot size, the whole lot is inspected with the application's existing zero-acceptance rule for 100% inspection.
- Documentary inspection remains pass/fail without sampling. Process inspection and existing lots retain their current settings.

The form previews n/Ac/Re. Lot creation recomputes these values and saves a calculation snapshot with the QAP revision, original/effective code letters and full-lot indication. Existing rejection clarification, unique-piece counting and finalization workflows use the computed acceptance limit. The saved lot and operational PDF identify the applied plan. No environment variable is needed.

This implementation does not select reduced/tightened regimes or apply historical switching rules automatically; the supplied QAP includes only the normal single-sampling table. Those regimes require their approved tables and switching controls. Critical-defect handling remains governed by the applicable quality procedure.

Validation: `node --test tests/aql.test.cjs` and `npx tsc --noEmit --incremental false`. Tests cover the QAP's 3500/II/1.0 example (L, n=200, Ac=5, Re=6), table-A boundaries/levels, arrow directions, full-lot inspection, Squeglia and invalid inputs.

## Reading arrows and the preview calculation

The preview shows the lot-size range, initial code letter/base sample, effective plan selected by the AQL column and the final sample. The base sample is not a fixed sample-size guarantee: arrows replace the entire plan (n and Ac/Re). For example, D at AQL 0.25 becomes H, n=50, Ac=0/Re=1; F at AQL 0.15 becomes J, n=80. At L, AQL 0.65 gives n=200 and Ac=3/Re=4, whereas AQL 0.065 gives Ac=0/Re=1. These two decimal values must not be confused.

Primary-source explanation: ASQ, “Z1.4 Sample Size,” https://asqasktheexperts.org/2017/03/24/z1-4-sample-size/ ; CDC/NIOSH, “Sampling Procedures,” 24 September 2012, section 9.6, https://archive.cdc.gov/www_cdc_gov/niosh/npptl/resources/pressrel/letters/manufacturers/pdfs/lttr-09242012-508.pdf .

The display clarification preserves single-direction arrows and explicit numeric cells. Bidirectional ranges now use the lower plan as the operational choice described below. Existing lot snapshots need no migration. The new fields are additive calculation metadata.

## Bidirectional-arrow selection policy

For the two-row bidirectional range between Ac=0 and Ac=1 in each normal AQL column, both code letters now use the first numeric plan below the range, with that plan's sample size and Ac/Re. This is the selected operational policy, rather than an assertion that every arrow must point down. One-way down/up arrows, explicit numeric cells, Squeglia and the full-lot cap keep their existing rules. Existing lots retain their saved limits.

Example: normal level II, lot size 91–150, code F, AQL 1.0 selects H: n=50, Ac=1/Re=2 (provided the sample does not reach the entire lot). This permits one rejection but inspects more pieces than the upper alternative; it is not described as uniformly less rigorous. The calculation snapshot records bidirectionalArrow=true when this policy is applied.
