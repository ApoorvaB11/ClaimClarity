
const CODES = {
  carc: {
    "4":   {o:"The procedure code is inconsistent with the modifier used.", p:"The procedure code does not fit the modifier used."},
    "11":  {o:"The diagnosis is inconsistent with the procedure.", p:"The diagnosis on the claim does not fit the procedure billed."},
    "15":  {o:"The authorization number is missing, invalid, or does not apply to the billed services or provider.", p:"The authorization number is missing, invalid, or does not match the billed service or provider."},
    "16":  {o:"Claim/service lacks information or has submission/billing error(s).", p:"The claim is missing information or has a billing error."},
    "18":  {o:"Exact duplicate claim/service (Use only with Group Code OA except where state workers' compensation regulations requires CO)", p:"The payer already has this exact claim or service."},
    "29":  {o:"The time limit for filing has expired.", p:"The claim reached the payer after its filing deadline."},
    "49":  {o:"This is a non-covered service because it is a routine/preventive exam or a diagnostic/screening procedure done in conjunction with a routine/preventive exam.", p:"A routine or preventive exam, or a screening or diagnostic test done with one, is not covered."},
    "50":  {o:"These are non-covered services because this is not deemed a 'medical necessity' by the payer.", p:"The payer did not consider the service medically necessary."},
    "125": {o:"Submission/billing error(s). At least one Remark Code must be provided", p:"A submission or billing error. The remark code gives the specifics."},
    "197": {o:"Precertification/authorization/notification/pre-treatment absent.", p:"The required pre-approval was not on file."},
    "198": {o:"Precertification/notification/authorization/pre-treatment exceeded.", p:"The service went beyond what the pre-approval allowed."}
  },
  rarc: {
    "M51":  {o:"Missing/incomplete/invalid procedure code(s).", p:"A procedure code is missing, incomplete or invalid."},
    "M86":  {o:"Service denied because payment already made for same/similar procedure within set time frame.", p:"The payer already paid for the same or a similar procedure within its set time frame."},
    "MA63": {o:"Missing/incomplete/invalid principal diagnosis.", p:"The principal diagnosis is missing, incomplete or invalid."}
  }
};
const CARC_CATEGORY = {
  "197":"Authorization Issue","198":"Authorization Issue","15":"Authorization Issue",
  "18":"Duplicate Claim","50":"Coverage / Medical Necessity","49":"Coverage / Medical Necessity",
  "11":"Coding/Billing Error","16":"Coding/Billing Error","4":"Coding/Billing Error","125":"Coding/Billing Error",
  "29":"Timely Filing"
};
const CATEGORIES = ["Authorization Issue","Duplicate Claim","Coverage / Medical Necessity","Coding/Billing Error","Timely Filing","Other / Unmapped"];
const CPT_LABELS = {
  "99213":"Office visit, established patient","99214":"Office visit, established patient, longer","99204":"Office visit, new patient",
  "80053":"Blood chemistry panel","85025":"Complete blood count","93000":"Electrocardiogram","71046":"Chest X-ray, 2 views",
  "36415":"Blood draw","20610":"Joint injection or aspiration","97110":"Therapeutic exercise","J1100":"Dexamethasone injection",
  "45378":"Colonoscopy, diagnostic","77067":"Screening mammogram","90834":"Psychotherapy, 45 minutes","99223":"Initial hospital care"
};
const NOT_IN_SET = "Code not in this tool's reference set";

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function catOf(c){ if(!c.carc_code) return null; return CARC_CATEGORY[c.carc_code] || "Other / Unmapped"; }
function isoDate(s){ return /^\d{8}$/.test(s||'') ? s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8) : ''; }
function daysBetween(a,b){ const x=Date.parse(a), y=Date.parse(b); return (isFinite(x)&&isFinite(y)) ? Math.round((y-x)/86400000) : null; }
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function monthLabel(ym){ const [y,m]=ym.split('-'); return MONTH_NAMES[+m-1]+' '+y.slice(2); }
function monthKeys(list){
  const ms = list.map(c=>c.remittance_date.slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)).sort();
  if(!ms.length) return [];
  const out=[]; let [y,m]=ms[0].split('-').map(Number); const [ey,em]=ms[ms.length-1].split('-').map(Number);
  while(y<ey || (y===ey && m<=em)){ out.push(y+'-'+String(m).padStart(2,'0')); m++; if(m>12){m=1;y++;} if(out.length>60) break; }
  return out;
}
function monthlyRates(list, months){
  const t={}; months.forEach(m=>t[m]={total:0,denied:0});
  list.forEach(c=>{ const m=c.remittance_date.slice(0,7); if(t[m]){ t[m].total++; if(c.status==='Denied') t[m].denied++; } });
  return months.map(m=>({month:m,total:t[m].total,denied:t[m].denied,rate:t[m].total? t[m].denied/t[m].total*100 : null}));
}

const SUPPORTED_CLP = new Set(['1','2','3','4','19','20','21']);
function parse835(raw){
  const text = String(raw||'').replace(/^﻿/,'').replace(/^\s+/,'');
  const warnings = [];
  if(text.length > 2000000) throw new Error('File is larger than 2 MB. Use a smaller sample.');
  if(text.slice(0,3) !== 'ISA' || text.length < 106) throw new Error('This does not look like an X12 file. It should start with an ISA segment.');
  const el = text[3], sub = text[104], term = text[105];
  const segs = text.split(term).map(s=>s.replace(/^\s+|\s+$/g,'')).filter(Boolean).map(s=>s.split(el));
  if(!segs.some(s=>s[0]==='ST' && s[1]==='835')) throw new Error('No ST*835 segment found. This tool reads 835 remittance files only.');
  const num = x => { const n=parseFloat(x); return isFinite(n)? n : 0; };
  let payer='', bprDate='', cur=null; const claims=[]; const payers=[];
  for(const s of segs){
    const id=s[0];
    if(id==='ST'){ payer=''; bprDate=''; cur=null; }
    else if(id==='N1' && s[1]==='PR'){ payer = s[2]||''; if(payer && payers.indexOf(payer)<0) payers.push(payer); }
    else if(id==='BPR'){ bprDate = s[16]||''; }
    else if(id==='CLP'){
      cur = {pcn:s[1]||'', st:s[2]||'', charge:num(s[3]), paid:num(s[4]), pt:num(s[5]), fac:s[8]||'', cas:[], member:'', ilMember:'', svcCount:0, payer:payer, bpr:bprDate, sd:'', sd2:'', cpt:'', rarcs:[]};
      claims.push(cur);
    } else if(cur){
      if(id==='CAS'){ for(let i=2;i+1<s.length;i+=3){ if(s[i]) cur.cas.push({g:s[1], c:s[i], a:num(s[i+1])}); } }
      else if(id==='NM1' && s[1]==='QC'){ cur.member = s[9]||''; }
      else if(id==='NM1' && s[1]==='IL' && !cur.ilMember){ cur.ilMember = s[9]||''; }
      else if(id==='DTM' && s[1]==='232' && !cur.sd){ cur.sd = s[2]||''; }
      else if(id==='DTM' && s[1]==='472' && !cur.sd2){ cur.sd2 = s[2]||''; }
      else if(id==='SVC' && (cur.svcCount++, !cur.cpt)){ const comp=(s[1]||'').split(sub); cur.cpt = (comp.length>1 ? comp[1] : comp[0]) || ''; }
      else if(id==='LQ' && s[1]==='HE' && s[2]){ cur.rarcs.push(s[2]); }
      else if(id==='MOA'){ for(let i=3;i<=7;i++){ if(s[i]) cur.rarcs.push(s[i]); } }
    }
  }
  if(!claims.length) throw new Error('No claims (CLP segments) were found in this file.');
  if(claims.length > 5000){ warnings.push('Only the first 5,000 claims were read.'); claims.length = 5000; }
  const isRoutine = a => (a.g==='CO' && a.c==='45') || (a.g==='PR' && (a.c==='1'||a.c==='2'||a.c==='3'));
  const records=[]; let skipped=0; const unsupported={}; let noService=0;
  claims.forEach((c,i)=>{
    if(c.st==='22'){ skipped++; return; }
    if(!SUPPORTED_CLP.has(c.st)){ unsupported[c.st||'(blank)']=(unsupported[c.st||'(blank)']||0)+1; return; }
    const adj = c.cas.filter(a=>!isRoutine(a));
    const status = c.st==='4' ? 'Denied' : (adj.length ? 'Partially Paid / Adjusted' : 'Paid in Full');
    const carc = adj.length ? adj[0].c : null;
    const rarc = status==='Denied' || adj.length ? (c.rarcs[0]||null) : null;
    const remit = isoDate(c.bpr);
    const svcDate = isoDate(c.sd2||c.sd); if(!svcDate) noService++;
    const rec = {
      claim_id: c.pcn || ('CLP-'+(i+1)), member_id: c.member || c.ilMember || '—', payer: c.payer || 'Unknown payer',
      provider_specialty: 'Not in 835', place_of_service: c.fac ? 'Facility type '+c.fac : 'Not in 835',
      service_date: svcDate, remittance_date: remit, clp_status: c.st,
      cpt_code: c.cpt, cpt_description: CPT_LABELS[c.cpt] || (c.cpt ? NOT_IN_SET : ''),
      billed_amount: c.charge, status: status, carc_code: carc, rarc_code: rarc, denial_category: null,
      allowed_amount: status==='Denied' ? 0 : +(c.paid + c.pt).toFixed(2), allowed_estimated: true, paid_amount: c.paid, patient_responsibility: c.pt
    };
    rec.denial_category = catOf(rec);
    records.push(rec);
  });
  const multi = claims.filter(c=>c.svcCount>1).length;
  if(multi) warnings.push(multi+' claim(s) have several service lines; only the first procedure code is shown for each.');
  const un = Object.keys(unsupported);
  if(un.length) warnings.push(un.reduce((n,k)=>n+unsupported[k],0)+' claim(s) with unsupported status code(s) '+un.join(', ')+' were not counted.');
  if(noService) warnings.push(noService+' claim(s) have no service date and are left out of days-to-remit.');
  if(skipped) warnings.push(skipped+' reversal claim(s) (status 22) were skipped.');
  if(!records.some(r=>r.remittance_date)) warnings.push('No payment date (BPR16) found; monthly trend will be empty.');
  return {records, warnings, payer: payers.length>1 ? payers.length+' payers' : (payers[0]||'')};
}

function buildFacts(list, months){
  const total=list.length; if(!total) return null;
  const denied=list.filter(c=>c.status==='Denied'), partial=list.filter(c=>c.status==='Partially Paid / Adjusted');
  const coded=list.filter(c=>c.denial_category);
  const cc={}; coded.forEach(c=>{ cc[c.denial_category]=(cc[c.denial_category]||0)+1; });
  const top=Object.entries(cc).sort((a,b)=>b[1]-a[1])[0] || null;
  const billed=list.reduce((s,c)=>s+c.billed_amount,0);
  const deniedBilled=denied.reduce((s,c)=>s+c.billed_amount,0);
  const rates=monthlyRates(list, months).filter(r=>r.rate!==null);
  const pm={}; list.forEach(c=>{ pm[c.payer]=pm[c.payer]||{t:0,d:0}; pm[c.payer].t++; if(c.status==='Denied') pm[c.payer].d++; });
  const pay=Object.entries(pm).filter(([k,v])=>v.t>=10).map(([k,v])=>({name:k,rate:v.d/v.t*100,t:v.t})).sort((a,b)=>b.rate-a.rate)[0]||null;
  return {total, denied:denied.length, partial:partial.length, rate:denied.length/total*100, top:top&&{name:top[0],n:top[1],pct:top[1]/coded.length*100}, coded:coded.length,
          billed, deniedBilled, first:rates[0]||null, last:rates[rates.length-1]||null, peak:rates.slice().sort((a,b)=>b.rate-a.rate)[0]||null, multi:rates.length>1, pay};
}
function fmt1(n){ return n.toFixed(1); }
function money0(n){ return '$'+Math.round(n).toLocaleString('en-US'); }
function factLines(f){
  if(!f) return [];
  const L=[];
  L.push(`${f.total} claims in view: ${f.denied} denied (${fmt1(f.rate)}%) and ${f.partial} partially paid or adjusted.`);
  if(f.top) L.push(`The most common reason group is ${f.top.name}, with ${f.top.n} of ${f.coded} coded claims (${fmt1(f.top.pct)}%).`);
  if(f.multi){
    L.push(`The monthly denial rate was ${fmt1(f.first.rate)}% in ${monthLabel(f.first.month)} and ${fmt1(f.last.rate)}% in ${monthLabel(f.last.month)}; the highest month was ${monthLabel(f.peak.month)} at ${fmt1(f.peak.rate)}%.`);
  }
  L.push(`Denied claims account for ${money0(f.deniedBilled)} of ${money0(f.billed)} billed.`);
  if(f.pay) L.push(`Among payers with at least 10 claims, ${f.pay.name} has the highest denial rate at ${fmt1(f.pay.rate)}% (${f.pay.t} claims).`);
  return L;
}
function numbersIn(s){ return (String(s).match(/\d[\d,]*\.?\d*/g)||[]).map(x=>x.replace(/,/g,'').replace(/\.$/,'')); }
function claudeTextIsGrounded(answer, facts){
  const allowed = new Set(numbersIn(facts));
  return numbersIn(answer).every(n=>allowed.has(n));
}
function claudeTextHasAdvice(answer){ return /\b(appeal|resubmi\w*|should|recommend\w*|advis\w*|suggest\w*|must|need to|consider)\b/i.test(answer); }
function csvCell(v, isText){
  let s = v==null ? '' : String(v);
  if(isText && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
}
function describeCode(kind, code){
  if(!code) return {plain:'', official:''};
  const e = CODES[kind][code];
  return e ? {plain:e.p, official:e.o} : {plain:NOT_IN_SET, official:''};
}
function toCSV(list){
  const head = ['claim_id','member_id','payer','provider_specialty','place_of_service','service_date','remittance_date','cpt_code','service','billed','allowed','paid','patient_responsibility','status','category','carc','carc_plain_english','carc_x12_wording','rarc','rarc_plain_english','rarc_x12_wording'];
  const rows = list.map(c=>{
    const a=describeCode('carc',c.carc_code), b=describeCode('rarc',c.rarc_code);
    return [csvCell(c.claim_id,1),csvCell(c.member_id,1),csvCell(c.payer,1),csvCell(c.provider_specialty,1),csvCell(c.place_of_service,1),csvCell(c.service_date),csvCell(c.remittance_date),csvCell(c.cpt_code,1),csvCell(c.cpt_description,1),
      csvCell(c.billed_amount),csvCell(c.allowed_amount),csvCell(c.paid_amount),csvCell(c.patient_responsibility),csvCell(c.status,1),csvCell(c.denial_category,1),
      csvCell(c.carc_code,1),csvCell(a.plain,1),csvCell(a.official,1),csvCell(c.rarc_code,1),csvCell(b.plain,1),csvCell(b.official,1)].join(',');
  });
  return [head.join(',')].concat(rows).join('\n');
}

module.exports={parse835,catOf,monthKeys,monthlyRates,buildFacts,factLines,claudeTextIsGrounded,claudeTextHasAdvice,toCSV,csvCell,esc,CODES,CARC_CATEGORY};
