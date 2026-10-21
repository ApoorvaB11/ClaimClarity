# Change log and review findings

## 21 October 2026: direct CSV download outside Claude

Outside claude.ai the export button used to say "Copy CSV" and only copied to the clipboard, which looked like nothing happened. It now says "Download CSV" everywhere and saves `claimclarity-ledger.csv` directly (UTF-8, opens in Excel). On claude.ai it still asks the viewer to confirm first. Two browser checks added for the plain-browser download.

## 21 October 2026: retired codes labelled

All codes used in the project were re-checked against the current X12 CARC and RARC lists. The wording of all 14 translated codes matches. Two are retired on x12.org: CARC 15 (stopped 01/05/2018) and CARC 125 (stopped 01/11/2013, used by 6 demo claims). Both are kept so older files still translate, and are now marked "Retired code" in the claim panel, with a note giving the stop date as shown on x12.org. The CSV export's plain-English column carries the same label.

## 20 October 2026: changes from showing the tool to others

| Feedback | What changed |
| --- | --- |
| Explain what an 835 file is | "What is an 835 file?" tip beside "Data source" (hover, keyboard focus or tap; Esc closes) |
| Pattern summary takes too much room | Now a single dropdown, collapsed by default, opens on click |
| Filter the ledger by service date | From/to date filter; KPIs, summary, trend and export follow it; claims without a service date are left out while it is on |

Tests rose from 43 to 61 browser checks (tip, dropdown, date filter, phone width). Two defects found by the new tests were fixed: the tip did not close on Esc while focused, and it overflowed the screen at 400px wide.

## 17 October 2026: fixes after an independent review

An external reviewer (a separate AI model) audited the HTML and raised 14 points. I reproduced each claim against the code. Six were confirmed and fixed; the rest were wrong, already known, or low priority.

| Finding | Verdict | What changed |
| --- | --- | --- |
| Two remittances in one file take the last payer and date | Confirmed (test file: all 18 claims got the second payer) | Each transaction set keeps its own payer and payment date |
| Service date prefers the statement-start date and falls back to the payment date | Confirmed | Prefers the service-line date; missing dates stay blank and are excluded from days to remit, with a warning |
| Claim status handling oversimplified | Confirmed | Codes 1, 2, 3, 4, 19, 20, 21 handled; 22, 25 and others skipped with a warning; raw status kept |
| "Allowed" amount is derived from an unsafe assumption | Confirmed | Labelled "Allowed (est.)" for 835 files |
| Demo data has dates after today | Confirmed (36 remittance dates up to 30 Oct) | Dates shifted so none is after 16 Oct; statuses and rates unchanged |
| Privacy text says nothing is uploaded, but the Claude rewrite sends figures out | Confirmed | Page now says exactly what is sent and when; fonts disclosed |
| CARC 198 and 50 grouped under misleading names | Confirmed | Groups renamed "Authorization Issue" and "Coverage / Medical Necessity" |
| Failed import leaves old data without saying so | Confirmed | Error message now says the earlier data is still shown |
| Only the first reason code is used | Already known | Documented as a limit in the BRD and FRD |
| AI check can pass a true number on the wrong group | Already known | Documented; the automatic summary stays the source of truth |
| No test suite | Not true | The reviewer saw only the HTML. 52 logic and 43 browser checks exist and are in this repository |
| Page title after the body begins | Hosting wrapper, low priority | Not changed |

Added tests: two remittances in one file, service date priority, missing service date, unsupported status, raw status kept, no future-dated demo records, and checks that the headline numbers match a separate recalculation.

Scorecard from the review (before fixes): data correctness 4/10, QA evidence 3/10, portfolio potential 8/10.

## 12 October 2026

- Reads raw 835 files; verified code wording; honest "Other / Unmapped" bucket.
- Summary with optional Claude rewrite and guards; CSV export; keyboard support; trend covers every month; 9.3% denial rate in demo data.

## First build

First version: 450 synthetic records only, wording written from memory, no summary, no export, mouse only, 38% denial rate. All of these issues were found in review and fixed on 12 October.
