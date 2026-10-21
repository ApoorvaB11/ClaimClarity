# Product decisions

| Decision | Why | Trade-off |
| --- | --- | --- |
| Reporting and translation only; no adjudication or advice | My experience is data and reporting on payer claims, not deciding claims. Also keeps compliance comfortable | Less "smart", but honest and defensible |
| Synthetic data only, 9.3% denial rate | No patient data risk; a plausible rate makes patterns readable | Not evidence of real denial rates |
| Five categories plus Other / Unmapped | Fewer groups are easier to read; nothing is dropped | Coarse; a claim with several reasons shows one |
| Ignore CO-45 and PR-1/2/3 when judging status | They are routine contractual or patient-share amounts | My rule, not a standard |
| Only verified codes get a translation | A wrong translation is worse than none | Only 14 codes covered |
| Claude rewrite is optional and checked | AI wording helps reading but can mislead | Checks catch invented numbers, not misplaced ones |
| Single HTML file | Easy to share and review | Logic and display live together; tests extract the logic |
| Nine codes removed from the first build | Official wording could not be confirmed | Smaller reference set |
