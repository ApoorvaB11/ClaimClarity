# ClaimClarity: Business Requirements (BRD)
_Last updated 20 October 2026 · Apoorva Bhardwaj_

## 1. The problem

When a health plan pays or rejects a medical claim, it sends the provider a remittance file (an "835") full of numeric codes that most people cannot read without a code book.

Here is what a business reader sees in a raw file: `CAS*CO*197*2000`. It means the claim was adjusted by 2,000 because a required authorization was missing, but nothing on the page says so. Analysts, managers and operations teams who need to understand *why* claims are being rejected end up looking codes up one by one, or waiting for someone technical to summarize the file.

The result: patterns such as "authorization problems are rising every month" stay hidden inside thousands of lines of codes.

**ClaimClarity's goal** is to turn that file into a plain-English picture a non-technical person can read in a minute.

## 2. Who it is for

The main user is someone on a claims operations or analytics team who must explain payment outcomes to others but does not want to read raw EDI.

| User | The job they are trying to do | What ClaimClarity gives them |
| --- | --- | --- |
| Claims operations analyst (primary) | "Why was this claim paid less than billed?" | Plain-English reason beside the official X12 wording, one click from the claim row |
| Claims operations manager | "Are rejections rising, and for what reason?" | Monthly denial rate and a reason mix, with a short written summary |
| Provider relations team | "What evidence can I bring to a provider conversation?" | Filter by payer or category, then export the list as a CSV |
| Data or BI analyst | "I need one consistent way to group reasons." | A reusable code-to-category mapping and the CSV export |
| Compliance reviewer | "Does this tool make coverage decisions?" | A clear on-screen statement that it only reports, plus blocked advice wording |
| Hiring manager (portfolio) | "Can this person think like a product owner in healthcare?" | A working demo, this BRD, and honest notes on what was and wasn't tested |

**Value in one line:** a consistent, readable view of why claims were adjusted, without manual lookups or hand-built reports. This value has been reasoned out for a hypothetical claims team and not yet confirmed with real users.

## 3. What it does, and what it deliberately does not do

ClaimClarity reports on decisions that were already made. It never makes, questions or advises on them.

**It does**

- Read a standard 835 remittance file in the browser (nothing is uploaded), or use 600 built-in synthetic claims.
- Translate 14 verified reason and remark codes into plain English beside the official wording.
- Group every claim into one of five reason categories, with an "Other / Unmapped" bucket so nothing is dropped.
- Show claim count, billed and paid amounts, denial rate, and a month-by-month trend.
- Let users search, filter, open a claim, and export the filtered list to CSV.
- Write a short summary of the pattern, with an optional rewrite by Claude that is checked for invented numbers and advice wording.

**It does not**

- Decide whether a claim should be approved, denied or appealed, or advise on appeals or resubmission.
- Use real patient or payer data. The demo is synthetic, and the reader is meant for test or de-identified files.
- Read claim submission files (837), calculate HEDIS measures, post payments, or save or write back anything.

**Product decision:** the scope is narrow on purpose. The author's real experience is in data and reporting on payer claims, not in deciding claims. The tool stays inside that line.

## 4. What the product must do (business requirements)

Priority uses Must, Should or Could. Every requirement is built in the published version.

| ID | In plain words | Why it matters | Priority | Status |
| --- | --- | --- | --- | --- |
| BR-01 | Turn reason and remark codes into plain English next to the official wording | Core value: removes manual lookups | Must | Built; 14 codes verified |
| BR-02 | Put every coded claim into exactly one of five categories; unknown codes go to "Other / Unmapped" | Completeness: nothing silently dropped. Validity (is the category a fair summary of the claim?) is a separate question, checked only by human review | Must | Built |
| BR-03 | Show the split of paid, partly paid and denied claims | Instant overview | Must | Built |
| BR-04 | Show claim count, billed, paid, denial rate and days to remit | The numbers a manager asks for first | Must | Built |
| BR-05 | Show denial rate for every month in the data | Spot trends, including the latest month | Should | Built |
| BR-06 | Search and filter by status, category, payer and service date | Find the claims behind a pattern | Must | Built |
| BR-07 | Open any claim to see amounts, dates and the code translation | Answer "why this claim?" | Must | Built |
| BR-08 | State clearly that the tool does not decide or advise | Keeps scope honest and compliance comfortable | Must | Built |
| BR-09 | Use synthetic data only in the demo | No patient data risk | Must | Built |
| BR-10 | Summarize patterns in writing; optionally let Claude rewrite it using only the displayed figures | Faster reading, with guard rails | Could | Built |
| BR-11 | Read a raw 835 file | Works on a team's own test data | Could | Built; also checked against a dental-style synthetic sample |
| BR-12 | Export the filtered list as CSV | Share evidence outside the tool | Could | Built; download needs the viewer's confirmation |
| BR-13 | Work by keyboard and with a screen reader | Usable by more people | Should | Built; screen reader not yet tested |

## 5. How we know it works

Success is judged on whether a reader can understand a claim and the overall pattern faster, without being misled. These targets describe a real deployment; the demo has no usage data, so none has been measured in use.

| Goal | How it would be judged |
| --- | --- |
| Understand one claim fast | The reason, in plain words and official wording, is one click from the claim row |
| Consistent reporting | Every coded claim lands in exactly one category; unknown codes go to "Other / Unmapped" |
| See patterns without rebuilding reports | Monthly denial rate, reason mix and a written summary appear on load, under any filter |
| Work on a team's own data | A raw 835 file loads in the browser and the same views apply |
| Stay a reporting tool | No screen or generated text recommends approval, appeal or resubmission |

**What has been checked:**

- 52 automated logic checks pass: 835 reading, status and reason rules, grouping, monthly totals, CSV safety, and the guards on the Claude rewrite.
- 61 browser checks pass: filters (including service date), 835 help tip, summary dropdown, keyboard use, file and paste loading, bad input, markup hidden in a file, and phone-width layout.
- Code wording was quoted from the official X12 code lists on 2026-10-12.
- A dental-style synthetic 835 with many segment types loads without errors. An independent review on 17 October 2026 raised 14 points. Six were confirmed by running the code and fixed: service date priority, payments mixed together when a file holds two remittances, unsupported claim statuses, demo dates after today, an estimated "allowed" amount, and privacy wording about the optional Claude rewrite. Two code-group names were also made more accurate ("Authorization Issue" and "Coverage / Medical Necessity").

## 6. Honest limits and what comes next

**Limits**

- The five categories and the rule that ignores routine adjustments (CO-45, PR-1, PR-2, PR-3) are the author's own choices, not an industry standard.
- Only 14 codes are translated. Anything else shows as "Other / Unmapped". Two of the 14 (CARC 15 and 125) are retired on x12.org; they are kept for older files and labelled "Retired code" with their stop date. Nine codes were removed because their official wording could not be fully confirmed.
- When a claim has several service lines, only the first procedure code is shown.
- For 835 files the "allowed" amount is only an estimate (paid plus patient share), and only the first reason code of each claim is used for grouping. Not yet done: a screen reader test, a colour contrast audit, and testing with several real de-identified 835 files.
- The business case is reasoned for a hypothetical claims team and has not been validated with real users.

**Next steps**

1. Confirm the removed codes against the official X12 list and add those that check out.
2. Test with two or three more de-identified 835 files and fix anything the reader mishandles.
3. Show every service line of a claim, not just the first.
4. Run a screen reader test and a contrast check.
5. Talk to two or three claims analysts and replace the targets above with measured results.
6. Publish the code, tests and a README on GitHub.

## 7. Requirement-by-requirement evidence

Built does not mean proven. This table separates what a test or an independent check has confirmed from what has only been built. Checked on 20 October 2026 against the published page.

| ID | Evidence | Verdict |
| --- | --- | --- |
| BR-01 | Tests check the plain-English and official wording show for coded claims, and unknown codes are handled. Wording was quoted from the X12 lists on 2026-10-12 | Confirmed for 14 codes; 2 labelled retired |
| BR-02 | Tests confirm every code in the demo maps to one category and unknown codes go to Other / Unmapped. Only the first reason code is used, so a claim with several reasons shows one. Whether that is a fair summary has had no domain review | Complete, validity not reviewed |
| BR-03 | The summary text agrees with an independent count (494 paid, 50 partly paid, 56 denied). The chart itself is not separately tested | Confirmed for the figures |
| BR-04 | Billed $163,420.63, paid $90,820.18, denial rate 9.3% and 23.3 average days match a separate recalculation from the raw data | Confirmed |
| BR-05 | Monthly totals add up to all 600 claims and the month list is complete. October now has 78 claims because dates after today were shifted back, so its rate rests on a bigger share of the data | Confirmed, with that caveat |
| BR-06 | Filter tests cover category, search, status, payer, service date range (54 claims in March 2026, matching a separate count) and zero results | Confirmed |
| BR-07 | Opening a claim by mouse or keyboard shows the translation. Esc closes it and focus returns | Confirmed |
| BR-08 | The on-screen statement is tested. Generated text is blocked if it contains advice wording, but advice phrased in other words could still pass | Mostly confirmed |
| BR-09 | The demo is generated, with no real names or members | Confirmed by design |
| BR-10 | Tests reject invented numbers and advice wording. They cannot detect a true number attached to the wrong group | Partly confirmed |
| BR-11 | One hand-built and one dental-style synthetic sample load. Two remittances in one file, a differing service date, a missing date and an unsupported status each have a test. No real payer file has been tried | Partly confirmed |
| BR-12 | The export row count and spreadsheet-formula protection are tested. The live download prompt has not been tried | Partly confirmed |
| BR-13 | Keyboard use and phone width are tested. Screen reader use and colour contrast have not been | Partly confirmed |

**Still needed to call this credible:** a domain review of the category rules, two or three real de-identified 835 files, a screen reader test, and a short test with real claims analysts.
