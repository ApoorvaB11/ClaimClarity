# Metric definitions

Every number on the page, how it is calculated, and whether it comes straight from the file or is derived.

| Metric | Formula | Source type | Notes |
| --- | --- | --- | --- |
| Claims in view | Count of claims that pass the current filters | Counted | Reversals and unsupported-status claims in an 835 are not counted |
| Billed amount | Sum of billed (CLP03 in an 835) | From file | |
| Paid amount | Sum of paid (CLP04) | From file | Share of billed shown beside it |
| Denial rate | Claims with status Denied ÷ claims in view × 100 | Derived | Denied means CLP status 4 in an 835 |
| Average days to remit | Mean of (remittance date − service date) | Derived | Only claims with both dates; claims with no service date are excluded and a warning says how many |
| Status: Denied | CLP status 4 | Rule | |
| Status: Partially Paid / Adjusted | Not denied, and at least one adjustment other than the routine ones | Rule (author's) | Routine = CO-45 and PR-1, PR-2, PR-3 |
| Status: Paid in Full | Not denied, and no non-routine adjustment | Rule (author's) | Means "no non-routine adjustment found", not "paid the billed amount" |
| Reason category | Looked up from the first non-routine reason code | Mapping (author's) | See the FRD for the table. Not an industry standard |
| Allowed amount (835 files) | Paid + patient responsibility; 0 for denied | Estimated | Labelled "Allowed (est.)" on the page. Demo data carries its own allowed amount |
| Monthly denial rate | Denied ÷ all claims remitted in that month × 100 | Derived | Months with no claims show a gap, not 0% |
| Category share in summary | Claims in a category ÷ claims that have a reason code | Derived | Denominator is coded claims, not all claims |
| Highest-denial payer | Highest denial rate among payers with at least 10 claims | Derived | |

## Dates

- **Service date:** the service-line date (DTM 472). If absent, the claim statement start (DTM 232). If neither exists the field is left blank.
- **Remittance date:** the payment date in the BPR segment (BPR16) of that claim's own transaction set.
