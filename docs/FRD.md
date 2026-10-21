# ClaimClarity: Functional Requirements (FRD)

How the product meets the business requirements in the [BRD](BRD.md). Last updated 20 October 2026 against the published page.

## 1. Inputs

| Input | Behavior |
| --- | --- |
| Built-in demo | 600 synthetic claims, remitted Jan to Oct 2026 (service dates from late Nov 2025), generated with a fixed seed (`scripts/generate_data.py`). No date is later than 16 Oct 2026 |
| Sample 835 | Nine synthetic claims in a standard 835 structure, one payer |
| Chosen file or pasted text | Must start with an ISA segment and contain ST*835. Maximum 2 MB and 5,000 claims |
| Bad input | A clear message is shown and the data already on screen stays |

## 2. Reading an 835 (BR-11)

- Separators are read from the ISA header (element, sub-element, segment end). Line breaks and blank lines are ignored.
- Each transaction set (ST to SE) keeps its own payer name (N1*PR) and payment date (BPR16). Two remittances in one file do not mix.
- Per claim (CLP): claim number, status, billed, paid, patient share, facility type.
- Adjustments (CAS): every code triplet is read, including several per segment.
- Member: the patient's ID (NM1*QC), or the subscriber's ID (NM1*IL) if the patient has none.
- Procedure: the first service line only; a warning counts claims with several lines.
- Remark codes: from LQ*HE and MOA segments. The first one is shown.
- Dates: see the metric definitions. A missing service date is left blank, never copied from the payment date.

### Claim status codes (CLP02)

| Code | Handling |
| --- | --- |
| 1, 2, 3, 19, 20, 21 | Counted. Status comes from the adjustment rules below |
| 4 | Counted as Denied |
| 22 (reversal) | Skipped, with a warning |
| 25 and any other code | Skipped, with a warning naming the code |

The raw status code is kept on each record.

### Status and reason rules (BR-02, BR-03)

1. CLP status 4 gives **Denied**.
2. Otherwise, if any adjustment is not routine, the claim is **Partially Paid / Adjusted**.
3. Otherwise it is **Paid in Full**.
4. Routine adjustments, ignored for status and reason: CO-45, PR-1, PR-2, PR-3.
5. The reason code is the first non-routine adjustment, and the category comes from it.

## 3. Code translation (BR-01)

14 codes carry the official X12 wording and a plain-English line: CARC 4, 11, 15, 16, 18, 29, 49, 50, 125, 197, 198 and RARC M51, M86, MA63. Any other code is shown as "Other / Unmapped" with a note that it is outside the reference set. CARC 15 (stopped 01/05/2018) and CARC 125 (stopped 01/11/2013) are retired on x12.org. They are kept so older files still translate, and are marked "Retired code" in the claim panel and the CSV export, with a note giving the stop date as shown on x12.org.

## 4. Categories (BR-02)

| Category | Codes | Meaning of the group |
| --- | --- | --- |
| Authorization Issue | 197, 198, 15 | Authorization missing, invalid or exceeded |
| Duplicate Claim | 18 | Payer already has this claim or service |
| Coverage / Medical Necessity | 49, 50 | Non-covered, or not deemed medically necessary |
| Coding/Billing Error | 4, 11, 16, 125 | Modifier, diagnosis or information problem |
| Timely Filing | 29 | Filing deadline passed |
| Other / Unmapped | anything else | Outside the reference set |

This mapping is the author's own and has had no domain review. Completeness (every coded claim has exactly one category) is tested. Validity (the category fairly represents a claim with several reasons) is not.

## 5. Screens (BR-03 to BR-08, BR-12, BR-13)

- **Data source help:** a "What is an 835 file?" tip next to the heading. Shows on hover, keyboard focus or tap; Esc closes it.
- **Pattern summary:** a collapsed section that opens on click. Collapsed by default.
- **Summary tiles:** claims, billed, paid, denial rate, average days to remit. They follow the filters.
- **Outcome chart and reason categories:** clicking a category filters the ledger; clicking it again clears the filter.
- **Trend:** denial rate for every remittance month, with gaps for months with no claims, plus a screen-reader table.
- **Ledger:** search (claim, member, payer, procedure), filters (status, category, payer, service date from/to), 12 rows per page. A date filter leaves out claims with no service date and says so; "from" later than "to" shows a warning. Tiles, summary, trend and CSV export all follow the date filter.
- **Claim detail:** amounts, dates, both codes with the X12 wording and the plain-English line, and a note that the tool does not judge the claim. Opens by mouse, Enter or Space; Esc closes and returns focus to the row.
- **Export:** CSV of the filtered ledger. Cells starting with = + - @ are neutralised. Falls back to "Copy CSV" when downloads are unavailable.
- **Scope statement:** shown on the page header and in the detail panel.

## 6. Summary and Claude rewrite (BR-10)

- The automatic summary is built from the displayed figures and is the source of truth.
- "Rewrite with Claude" appears only where the runtime allows it. Only the summary figures are sent, never the claim list.
- A rewrite is discarded, and the automatic summary kept, if it contains a number not in the figures, or advice-style wording (appeal, resubmit, should, recommend, advise, suggest, must, need to, consider).
- Known gap: a true number attached to the wrong group would pass.

## 7. Non-functional

- **Privacy:** reading and filtering happen in the browser. Fonts load from Google Fonts. Test or de-identified files only.
- **Safety:** all file text is escaped on screen; spreadsheet formulas are neutralised on export.
- **Accessibility:** keyboard operable, labelled controls, text equivalents for charts, no horizontal scroll at 400 px. Not yet tested with a screen reader or a contrast audit.

## 8. Traceability

Each requirement and its evidence is listed in section 7 of the BRD. Test files: `tests/test_logic.js` (52 checks), `tests/test_browser.js` (61 checks).
