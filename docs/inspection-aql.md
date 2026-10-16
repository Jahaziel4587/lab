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
