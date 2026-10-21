# Automatic AQL for incoming inspection

New incoming MTS/project lots calculate each physical inspection method separately using the numeric tables in QAP-013 Rev C (normal single sampling, tables A/B, and separate Squeglia C=0). Defaults are normal, level II, AQL 1.0. The inspector selects the AQL required by the SPEC; AQL is not extracted from PDF contents.

## Operational rule for bidirectional ranges

For either letter inside the two-row bidirectional range between Ac=0 and Ac=1, the sample size stays at the original code letter's size. Only Ac/Re come from the first numeric row below that range. This is a custom internal rule and differs from using the complete replacement plan (sample and Ac/Re) in the standard. The form and operational reports identify the preserved sample and the separate Ac/Re reference row.

Example: lot 1000, general II, letter J, AQL 0.25: inspect 80 pieces (J) with Ac=1/Re=2 from L. The reference sample for L is 200, but that is not the sample used. The calculation records codeLetter, effectiveCodeLetter, baseSampleSize, tableSampleSize (reference row), sampleSize (actually inspected), bidirectionalArrow and preserveBaseSample.

Single-direction arrows still replace the complete plan; explicit numeric intersections and Squeglia retain their existing behavior. If the actual sample reaches/exceeds the lot size, inspect the entire lot under the existing zero-acceptance rule. Merely reaching the lot size with the Ac/Re reference row does not trigger full-lot inspection.

Creation recalculates and saves the actual sample and acceptance limit together. Detail views, IIF and rejection decisions consume those saved quantities. Existing lots retain their saved snapshots and are not migrated. Documentary inspection has no sampling; process inspection retains its current flow.

Reduced/tightened tables and historical switching are outside this implementation. No new environment variable is needed.

Validation: node --test tests/aql.test.cjs; TypeScript/JSX compilation through the preview build. Cases cover lot-size boundaries, the QAP worked example, all bidirectional ranges, separate sample/Ac-Re lookup, one-way arrows, explicit values, Squeglia and full-lot caps.
