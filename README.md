# ClaimClarity

**Turns a health plan's remittance file (EDI 835) into a plain-English report of why claims were paid less, adjusted or denied.**

**[Open the live demo →](https://apoorvab11.github.io/ClaimClarity/)** · No install or sign-in · Runs entirely in your browser

---

## The problem

When a health plan pays or rejects a medical claim, it sends the provider a remittance file (an "835") full of numeric codes. A line such as `CAS*CO*197*2000` means the claim was cut by $2,000 because a required pre-approval was missing, but nothing on the page says so.

Analysts, managers and operations teams who need to know *why* claims are being rejected end up looking codes up one at a time, or waiting for someone technical to summarise the file. Patterns like "authorisation problems are rising every month" stay hidden inside thousands of lines.

ClaimClarity turns that file into a picture a non-technical person can read in a minute.

## Who it's for

| User | Their question | What ClaimClarity gives them |
| --- | --- | --- |
| Claims operations analyst | "Why was this claim paid less than billed?" | The reason in plain English beside the official X12 wording, one click from the claim |
| Claims operations manager | "Are rejections rising, and for what reason?" | Monthly denial rate, reason mix and a short written summary |
| Provider relations team | "What evidence can I bring to a provider conversation?" | Filter by payer or reason, then export the list as CSV |
| Data / BI analyst | "I need one consistent way to group reasons." | A reusable code-to-category mapping and CSV export |
| Compliance reviewer | "Does this tool make coverage decisions?" | A clear on-screen statement that it only reports |

## What it does

- Reads a standard 835 file in the browser (nothing is uploaded), or uses 600 built-in synthetic claims
- Translates 14 verified reason and remark codes (CARC/RARC) into plain English, next to the official X12 wording
- Groups every claim into one of five reason categories, with an "Other / Unmapped" bucket so nothing is silently dropped
- Shows claim count, billed and paid amounts, denial rate, average days to remit, and a month-by-month trend
- Lets you search, filter by status, category or payer, open any claim, and export the filtered list to CSV
- Writes a short summary of the pattern using only figures computed from the data

## What it deliberately does not do

ClaimClarity **reports on decisions that were already made**. It never makes, questions or advises on them.

- It does not decide whether a claim should be approved, denied or appealed, or advise on appeals or resubmission
- It does not use real patient or payer data. The demo is synthetic; the file reader is meant for test or de-identified files only
- It does not read claim submissions (837), calculate quality measures, post payments, or save anything

This scope is narrow on purpose: it stays inside data and reporting on payer claims, which is where the author's real experience lies.

## Try it

1. Open the [live demo](https://apoorvab11.github.io/ClaimClarity/). It loads 600 synthetic claims.
2. Click a bar under **Reason categories** to filter the ledger to that reason.
3. Click any claim row to see its codes translated.
4. Click **Load sample 835 file** to see the reader work on a raw remittance file.

## Product documents

- [Business Requirements Document (BRD)](docs/BRD.md): problem, users, scope, 13 business requirements and the evidence for each
- [Functional Requirements Document (FRD)](docs/FRD.md): data specification, 20 functional requirements, code reference, 835 reading rules, calculations and test results

## Honest limits

- The five categories and the rule that ignores routine adjustments (CO-45, PR-1, PR-2, PR-3) are the author's own choices, not an industry standard
- Only 14 codes are translated; anything else shows as "Other / Unmapped"
- Only the first service line and first reason code of each claim are used
- Tested on hand-built and real-structure sample files, not yet on real de-identified payer files
- Screen reader use and colour contrast have not been formally tested
- The business case has not yet been validated with real claims analysts

See section 6 of the BRD for planned next steps.

## How it's built

One self-contained page (`index.html`): plain JavaScript and inline SVG charts, no libraries, no server and no database. The X12 code wording was taken from the published lists on [x12.org](https://x12.org/codes/claim-adjustment-reason-codes), read on 12 October 2026.

The FRD describes the version published on Claude, which includes an optional AI rewrite of the summary. That feature is not available in the GitHub version, and the CSV export here downloads directly.

## About

A portfolio project by **Apoorva Bhardwaj**, healthcare data analyst for US payer programs, applying product management to claims operations data. The product direction, domain rules and requirements are hers; the code was written with AI assistance (Claude).

*All data in the demo is synthetic. No PHI.*
