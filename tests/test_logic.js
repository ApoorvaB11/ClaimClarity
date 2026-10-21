const fs = require('fs');
const dir = require('path').join(__dirname, '..') + '/';
const P = require(dir + 'src/pure.js');
const sample = fs.readFileSync(dir + 'data/sample_835.txt', 'utf8');
const demo = JSON.parse(fs.readFileSync(dir + 'data/claims_data.json', 'utf8'));
let fails = 0;
const ok = (name, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')); };

// --- 835 parser on the sample
const r = P.parse835(sample);
ok('sample parses 9 claims', r.records.length === 9, r.records.length);
ok('payer read', r.payer === 'ALDER HEALTH PLAN', r.payer);
const by = id => r.records.find(c => c.claim_id === id);
ok('PCN1001 paid in full (CO-45 only)', by('PCN1001').status === 'Paid in Full' && by('PCN1001').carc_code === null);
ok('PCN1002 paid in full (CO-45 + PR-2)', by('PCN1002').status === 'Paid in Full' && by('PCN1002').patient_responsibility === 30);
ok('PCN1003 denied, 197, Authorization Issue', by('PCN1003').status === 'Denied' && by('PCN1003').carc_code === '197' && by('PCN1003').denial_category === 'Authorization Issue');
ok('PCN1004 denied dup with M86', by('PCN1004').carc_code === '18' && by('PCN1004').rarc_code === 'M86' && by('PCN1004').denial_category === 'Duplicate Claim');
ok('PCN1005 denied 125 + MA63', by('PCN1005').carc_code === '125' && by('PCN1005').rarc_code === 'MA63');
ok('PCN1006 partial, CARC 4 (skips CO-45)', by('PCN1006').status === 'Partially Paid / Adjusted' && by('PCN1006').carc_code === '4' && by('PCN1006').denial_category === 'Coding/Billing Error');
ok('PCN1007 timely filing', by('PCN1007').denial_category === 'Timely Filing');
ok('PCN1008 coverage', by('PCN1008').denial_category === 'Coverage / Medical Necessity');
ok('PCN1009 unmapped CARC 109', by('PCN1009').denial_category === 'Other / Unmapped');
ok('dates iso', by('PCN1001').service_date === '2026-09-14' && by('PCN1001').remittance_date === '2026-10-12');
ok('member + cpt', by('PCN1003').member_id === 'MBR-510003' && by('PCN1003').cpt_code === '45378' && by('PCN1003').cpt_description === 'Colonoscopy, diagnostic');
ok('paid amounts', by('PCN1006').paid_amount === 110 && by('PCN1006').allowed_amount === 110 && by('PCN1006').billed_amount === 300);
ok('no warnings', r.warnings.length === 0, r.warnings.join('|'));

// --- error handling
for (const [name, txt, re] of [
  ['not X12', 'hello world', /X12/],
  ['no ST*835', sample.replace('ST*835*0001~', 'ST*837*0001~'), /835/],
  ['no CLP', sample.split('\n').filter(l => !l.startsWith('CLP') && !l.startsWith('CAS')).join('\n'), /No claims/],
]) { try { P.parse835(txt); ok('rejects ' + name, false); } catch (e) { ok('rejects ' + name, re.test(e.message), e.message); } }
const rev = P.parse835(sample.replace('CLP*PCN1001*1*', 'CLP*PCN1001*22*'));
ok('reversal skipped with warning', rev.records.length === 8 && rev.warnings.length === 1, rev.warnings.join('|'));
const nl = P.parse835(sample.replace(/\n/g, '\r\n'));
ok('CRLF input ok', nl.records.length === 9);
const oneLine = P.parse835(sample.replace(/\n/g, ''));
ok('single-line input ok', oneLine.records.length === 9);


// --- real-structure 835 (all-fields dental sample)
const real = P.parse835(fs.readFileSync(dir + 'tests/fixtures/dental_style_835.txt', 'utf8'));
ok('real: 1 claim, payer read', real.records.length === 1 && real.payer === 'SAMPLE DENTAL PLAN');
ok('real: remittance date from BPR16', real.records[0].remittance_date === '2026-03-31');
ok('real: member falls back to NM1*IL', real.records[0].member_id === 'SUB000111', real.records[0].member_id);
ok('real: multi-triplet CAS reads 197 first, skips CO-45', real.records[0].carc_code === '197');
ok('real: decimal CLP fields ok', real.records[0].billed_amount === 384);
ok('real: unknown dental code flagged not crashed', /not in this tool/.test(real.records[0].cpt_description));
ok('real: warns about several service lines', real.warnings.some(w => /several service lines/.test(w)), real.warnings.join('|'));


// --- audit fixtures (independent review, 2026-10-17)
const realTxt = fs.readFileSync(dir + 'tests/fixtures/dental_style_835.txt', 'utf8');
ok('audit: 472 service date beats 232 statement start', P.parse835(realTxt).records[0].service_date === '2026-03-24', P.parse835(realTxt).records[0].service_date);
const noDtm = P.parse835(realTxt.replace(/DTM\*232\*\d+~/, '').replace(/DTM\*472\*\d+~/g, ''));
ok('audit: missing service date stays blank, not copied from remit date', noDtm.records[0].service_date === '' && noDtm.warnings.some(w => /no service date/.test(w)), noDtm.records[0].service_date);
const body = sample.slice(sample.indexOf('ST*835'), sample.indexOf('SE*'));
const seLine = sample.slice(sample.indexOf('SE*')).split('\n')[0];
const two = sample.replace(seLine, seLine + '\n' + body.replace('ALDER HEALTH PLAN', 'OTHER PLAN').replace(/PCN100/g, 'PCNB00').replace('20261012', '20260801') + seLine);
const tr = P.parse835(two);
ok('audit: two transaction sets keep their own payer and date', tr.records.filter(c => c.payer === 'ALDER HEALTH PLAN' && c.remittance_date === '2026-10-12').length === 9 && tr.records.filter(c => c.payer === 'OTHER PLAN' && c.remittance_date === '2026-08-01').length === 9, [...new Set(tr.records.map(c => c.payer + '|' + c.remittance_date))].join(','));
const un = P.parse835(sample.replace('CLP*PCN1001*1*', 'CLP*PCN1001*25*'));
ok('audit: unsupported CLP status is skipped with a warning', un.records.length === 8 && un.warnings.some(w => /unsupported status code\(s\) 25/.test(w)), un.warnings.join('|'));
ok('audit: raw CLP status is kept', by('PCN1003').clp_status === '4' && by('PCN1003').allowed_estimated === true);
ok('audit: demo has no future-dated records', demo.every(c => c.remittance_date <= '2026-10-17' && c.service_date <= '2026-10-17'));

// --- demo data consistency
demo.forEach(c => { c.denial_category = P.catOf(c); });
const mism = demo.filter(c => c.carc_code && P.CARC_CATEGORY[c.carc_code] === undefined);
ok('every demo CARC is in the mapping', mism.length === 0, mism.length);
const unk = demo.filter(c => (c.carc_code && !P.CODES.carc[c.carc_code]) || (c.rarc_code && !P.CODES.rarc[c.rarc_code]));
ok('every demo code has verified wording', unk.length === 0, unk.length);
ok('125 always has a remark when denied', demo.filter(c => c.carc_code === '125' && c.status === 'Denied').every(c => c.rarc_code));
ok('paid-in-full has no codes', demo.filter(c => c.status === 'Paid in Full').every(c => !c.carc_code && !c.denial_category));
ok('denied has zero paid', demo.filter(c => c.status === 'Denied').every(c => c.paid_amount === 0));
ok('Duplicate/Timely only on denied', demo.filter(c => ['Duplicate Claim', 'Timely Filing'].includes(c.denial_category)).every(c => c.status === 'Denied'));
ok('remit months Jan..Oct', JSON.stringify(P.monthKeys(demo)) === JSON.stringify(['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']), P.monthKeys(demo).join(','));
const mr = P.monthlyRates(demo, P.monthKeys(demo));
ok('monthly totals sum to all claims (nothing dropped)', mr.reduce((s, m) => s + m.total, 0) === demo.length, mr.reduce((s, m) => s + m.total, 0));
ok('monthly denied sums to all denied', mr.reduce((s, m) => s + m.denied, 0) === demo.filter(c => c.status === 'Denied').length);

// --- facts + grounding
const f = P.buildFacts(demo, P.monthKeys(demo));
const lines = P.factLines(f).join('\n');
console.log(lines);
ok('facts total matches', f.total === demo.length);
ok('grounded text passes', P.claudeTextIsGrounded('Of ' + demo.length + ' claims, ' + f.denied + ' were denied.', lines));
ok('invented number fails', !P.claudeTextIsGrounded('Denials rose 47% last quarter.', lines));

ok('advice wording detected', P.claudeTextHasAdvice('Providers should appeal these.') && P.claudeTextHasAdvice('Consider resubmitting.') && !P.claudeTextHasAdvice('Of 600 claims, 56 were denied.'));
// --- CSV
const evil = [{ claim_id: '=HYPERLINK("x")', member_id: '+1', payer: 'A,B', provider_specialty: 'x', place_of_service: 'y', service_date: '2026-01-01', remittance_date: '2026-01-02', cpt_code: '99213', cpt_description: 'd', billed_amount: 1, allowed_amount: 1, paid_amount: 1, patient_responsibility: 0, status: 'Denied', denial_category: 'Timely Filing', carc_code: '29', rarc_code: null }];
const csv = P.toCSV(evil).split('\n');
ok('csv header 21 cols', csv[0].split(',').length === 21);
ok('csv formula neutralised', csv[1].startsWith('"\'=HYPERLINK(""x"")"') || csv[1].startsWith("'=HYPERLINK"), csv[1].slice(0, 40));
ok('csv comma quoted', csv[1].includes('"A,B"'));
ok('csv full export row count', P.toCSV(demo).split('\n').length === demo.length + 1);
ok('esc works', P.esc('<img src=x onerror=1>"') === '&lt;img src=x onerror=1&gt;&quot;');
console.log(fails ? ('\n' + fails + ' FAILED') : '\nALL PASSED');
process.exit(fails ? 1 : 0);
