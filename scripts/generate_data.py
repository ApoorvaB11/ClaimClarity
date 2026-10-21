"""
ClaimClarity - Synthetic remittance data + sample EDI 835 generator
----------------------------------------------------------------------
All records are SYNTHETIC. No real members, providers or payers.

Only CARC/RARC codes whose wording was verified against the published X12
lists (x12.org, read 2026-10-12) are used. Category assignment is the
author's illustrative mapping, not an industry standard.

Realism rules:
- remittance dates cover Jan-Oct 2026 evenly; service date = remittance - lag
- each specialty bills only plausible procedures at plausible places of service
- denial rate sits around 8-11% with a rising Authorization Issue share
- partially paid claims only carry reasons that can apply to part of a claim
- Duplicate and Timely Filing appear only as whole-claim denials
- every code pairing respects the X12 rule that 125 needs a remark code
"""

import json
import random
from datetime import date, timedelta

random.seed(42)
N_CLAIMS = 600
WINDOW_START = date(2026, 1, 1)
WINDOW_END = date(2026, 10, 31)

PAYERS = ["Alder Health Plan", "Birchwood Care", "Cedar Point Benefits",
          "Delmar Health", "Elmridge Insurance"]

# CPT -> (author's service label, typical charge range)
CPT = {
    "99213": ("Office visit, established patient", (120, 220)),
    "99214": ("Office visit, established patient, longer", (180, 320)),
    "99204": ("Office visit, new patient", (250, 450)),
    "80053": ("Blood chemistry panel", (40, 90)),
    "85025": ("Complete blood count", (25, 60)),
    "93000": ("Electrocardiogram", (50, 120)),
    "71046": ("Chest X-ray, 2 views", (80, 200)),
    "36415": ("Blood draw", (10, 30)),
    "20610": ("Joint injection or aspiration", (150, 350)),
    "97110": ("Therapeutic exercise", (60, 130)),
    "J1100": ("Dexamethasone injection", (15, 45)),
    "45378": ("Colonoscopy, diagnostic", (1200, 2400)),
    "77067": ("Screening mammogram", (250, 450)),
    "90834": ("Psychotherapy, 45 minutes", (150, 250)),
    "99223": ("Initial hospital care", (400, 700)),
}

# specialty -> (weight, {cpt: weight}, {pos: weight})
POS = {"11": "11 - Office", "21": "21 - Inpatient Hospital", "22": "22 - Outpatient Hospital",
       "02": "02 - Telehealth", "81": "81 - Independent Lab"}
SPECIALTIES = {
    "Internal Medicine": (18, {"99213": 5, "99214": 4, "99204": 1, "93000": 1, "36415": 1}, {"11": 8, "02": 2}),
    "Family Practice": (20, {"99213": 6, "99214": 3, "99204": 1, "36415": 1}, {"11": 8, "02": 2}),
    "Cardiology": (9, {"99214": 4, "93000": 4, "99204": 1, "99223": 1}, {"11": 6, "22": 2, "21": 1}),
    "Orthopedics": (10, {"99213": 3, "99214": 2, "20610": 4, "J1100": 1}, {"11": 7, "22": 2}),
    "Radiology": (8, {"71046": 4, "77067": 4}, {"22": 6, "11": 3}),
    "Behavioral Health": (9, {"90834": 8}, {"11": 4, "02": 6}),
    "Physical Therapy": (8, {"97110": 8}, {"11": 10}),
    "Lab Services": (9, {"80053": 4, "85025": 4, "36415": 3}, {"81": 10}),
    "Gastroenterology": (5, {"45378": 6, "99213": 1}, {"22": 7, "11": 1}),
}

AUTH_CPTS = {"45378", "71046", "20610", "99223", "97110", "J1100", "77067"}
PREVENTIVE_CPTS = {"36415", "93000", "85025", "80053", "77067", "45378"}

# CARC -> category (author's illustrative mapping; also used by the page)
CARC_CATEGORY = {
    "197": "Authorization Issue", "198": "Authorization Issue", "15": "Authorization Issue",
    "18": "Duplicate Claim",
    "50": "Coverage / Medical Necessity", "49": "Coverage / Medical Necessity",
    "11": "Coding/Billing Error", "16": "Coding/Billing Error", "4": "Coding/Billing Error",
    "125": "Coding/Billing Error",
    "29": "Timely Filing",
}


def wchoice(d):
    return random.choices(list(d.keys()), weights=list(d.values()), k=1)[0]


def pick_status(m):  # m = month index 0..9
    denied = 0.08 + 0.005 * m
    partial = 0.08
    r = random.random()
    if r < denied:
        return "Denied"
    if r < denied + partial:
        return "Partially Paid / Adjusted"
    return "Paid in Full"


def denied_category(cpt, m):
    weights = {"Coding/Billing Error": 30, "Coverage / Medical Necessity": 20, "Duplicate Claim": 15,
               "Timely Filing": 12}
    if cpt in AUTH_CPTS:
        weights["Authorization Issue"] = 40 + 14 * m   # 40 -> ~166
    return wchoice(weights)


def carc_for(category, cpt, status):
    if category == "Authorization Issue":
        return wchoice({"198": 15}) if status != "Denied" else wchoice({"197": 60, "15": 25, "198": 15})
    if category == "Duplicate Claim":
        return "18"
    if category == "Coverage / Medical Necessity":
        if cpt in PREVENTIVE_CPTS:
            return wchoice({"50": 5, "49": 5})
        return "50"
    if category == "Timely Filing":
        return "29"
    # Coding / Billing
    if status == "Partially Paid / Adjusted":
        return wchoice({"4": 6, "11": 4})
    return wchoice({"11": 30, "16": 30, "4": 15, "125": 25})


def rarc_for(carc, status):
    if status != "Denied":
        return None
    if carc == "125":
        return wchoice({"M51": 1, "MA63": 1})
    if carc == "11":
        return "MA63" if random.random() < 0.6 else None
    if carc == "16":
        return "M51" if random.random() < 0.4 else None
    if carc == "18":
        return "M86" if random.random() < 0.6 else None
    return None


def make_claim(i):
    remit = WINDOW_START + timedelta(days=random.randint(0, (WINDOW_END - WINDOW_START).days))
    m = remit.month - 1
    lag = random.randint(7, 40)
    service = remit - timedelta(days=lag)

    spec = wchoice({k: v[0] for k, v in SPECIALTIES.items()})
    _, cpts, pos_w = SPECIALTIES[spec]
    cpt = wchoice(cpts)
    pos_code = wchoice(pos_w)
    if cpt == "99223":
        pos_code = "21"
    label, (lo, hi) = CPT[cpt]
    billed = round(random.uniform(lo, hi), 2)

    rec = {
        "claim_id": f"CLM-{i:06d}",
        "member_id": f"MBR-{random.randint(100000, 999999)}",
        "payer": random.choice(PAYERS),
        "provider_specialty": spec,
        "place_of_service": POS[pos_code],
        "service_date": service.isoformat(),
        "remittance_date": remit.isoformat(),
        "cpt_code": cpt,
        "cpt_description": label,
        "billed_amount": billed,
        "status": pick_status(m),
        "carc_code": None, "rarc_code": None, "denial_category": None,
        "allowed_amount": None, "paid_amount": None, "patient_responsibility": None,
    }

    if rec["status"] == "Paid in Full":
        allowed = round(billed * random.uniform(0.5, 0.85), 2)
        pt = round(allowed * random.choice([0, 0, 0.1, 0.2]), 2)
        rec.update(allowed_amount=allowed, paid_amount=round(allowed - pt, 2), patient_responsibility=pt)
    elif rec["status"] == "Partially Paid / Adjusted":
        cat = wchoice({"Coding/Billing Error": 50, "Coverage / Medical Necessity": 25,
                       "Authorization Issue": 25 if cpt in AUTH_CPTS else 0})
        carc = carc_for(cat, cpt, "Partially Paid / Adjusted")
        allowed = round(billed * random.uniform(0.3, 0.6), 2)
        paid = round(allowed * random.uniform(0.6, 0.9), 2)
        rec.update(carc_code=carc, denial_category=CARC_CATEGORY[carc], allowed_amount=allowed,
                   paid_amount=paid, patient_responsibility=round(allowed - paid, 2))
    else:
        cat = denied_category(cpt, m)
        carc = carc_for(cat, cpt, "Denied")
        rec.update(carc_code=carc, rarc_code=rarc_for(carc, "Denied"),
                   denial_category=CARC_CATEGORY[carc], allowed_amount=0.0, paid_amount=0.0,
                   patient_responsibility=0.0)
    return rec


def money(x):
    return f"{x:.2f}".rstrip("0").rstrip(".") if x else "0"


def build_sample_835():
    """Small hand-built X12 5010 835 with a few claims. Fake names, fake ids."""
    claims = [
        # pcn, clp02, svc date, cpt, charge, paid, ptresp, [(grp, carc, amt)], member, rarc
        ("PCN1001", 1, "20260914", "99213", 180, 120, 0, [("CO", "45", 60)], "MBR-510001", None),
        ("PCN1002", 1, "20260915", "99214", 220, 140, 30, [("CO", "45", 50), ("PR", "2", 30)], "MBR-510002", None),
        ("PCN1003", 4, "20260916", "45378", 1800, 0, 0, [("CO", "197", 1800)], "MBR-510003", None),
        ("PCN1004", 4, "20260917", "99213", 210, 0, 0, [("CO", "18", 210)], "MBR-510004", "M86"),
        ("PCN1005", 4, "20260918", "93000", 95, 0, 0, [("CO", "125", 95)], "MBR-510005", "MA63"),
        ("PCN1006", 1, "20260919", "99214", 300, 110, 0, [("CO", "45", 90), ("CO", "4", 100)], "MBR-510006", None),
        ("PCN1007", 4, "20260920", "97110", 120, 0, 0, [("CO", "29", 120)], "MBR-510007", None),
        ("PCN1008", 4, "20260921", "20610", 310, 0, 0, [("CO", "50", 310)], "MBR-510008", None),
        ("PCN1009", 4, "20260922", "99213", 175, 0, 0, [("CO", "109", 175)], "MBR-510009", None),
    ]
    total_paid = sum(c[5] for c in claims)
    isa = ("ISA*00*          *00*          *ZZ*" + "ALDERHEALTH".ljust(15) + "*ZZ*" +
           "DEMOCLINIC".ljust(15) + "*261012*1200*^*00501*000000001*0*T*:~")
    assert len(isa) == 106, len(isa)
    segs = [isa,
            "GS*HP*ALDERHEALTH*DEMOCLINIC*20261012*1200*1*X*005010X221A1~",
            "ST*835*0001~",
            f"BPR*I*{total_paid}*C*ACH*CCP*01*999999999*DA*1234567*1512345678**01*999988880*DA*987654321*20261012~",
            "TRN*1*12345*1512345678~",
            "N1*PR*ALDER HEALTH PLAN~",
            "N1*PE*DEMO CLINIC*XX*1234567893~",
            "LX*1~"]
    for pcn, st, sd, cpt, charge, paid, pt, adjs, mem, rarc in claims:
        segs.append(f"CLP*{pcn}*{st}*{charge}*{paid}*{pt}*12*PAYER{pcn[3:]}*11*1~")
        for g, c, a in adjs:
            segs.append(f"CAS*{g}*{c}*{a}~")
        segs.append(f"NM1*QC*1*SAMPLE*PATIENT****MI*{mem}~")
        segs.append(f"DTM*232*{sd}~")
        segs.append(f"SVC*HC:{cpt}*{charge}*{paid}**1~")
        segs.append(f"DTM*472*{sd}~")
        if rarc:
            segs.append(f"LQ*HE*{rarc}~")
    segs += [f"SE*{len(segs) - 2}*0001~", "GE*1*1~", "IEA*1*000000001~"]
    return "\n".join(segs)


def main():
    claims = [make_claim(i + 1) for i in range(N_CLAIMS)]
    # No future-dated records: the data is "as of" AS_OF. Shift any later pair of dates
    # back together so the lag between service and remittance is preserved.
    AS_OF = date(2026, 10, 16)
    for k, c in enumerate(claims):
        r = date.fromisoformat(c["remittance_date"])
        if r > AS_OF:
            new_r = AS_OF - timedelta(days=k % 12)
            d = r - new_r
            c["remittance_date"] = new_r.isoformat()
            c["service_date"] = (date.fromisoformat(c["service_date"]) - d).isoformat()
    with open("claims_data.json", "w") as f:
        json.dump(claims, f, separators=(",", ":"))
    with open("sample_835.txt", "w") as f:
        f.write(build_sample_835())

    from collections import Counter
    st = Counter(c["status"] for c in claims)
    print("claims", len(claims), dict(st))
    print("denial rate %.1f%%" % (100 * st["Denied"] / len(claims)))
    print("categories", dict(Counter(c["denial_category"] for c in claims if c["denial_category"])))
    by_m = Counter(c["remittance_date"][:7] for c in claims)
    den_m = Counter(c["remittance_date"][:7] for c in claims if c["status"] == "Denied")
    for m in sorted(by_m):
        print(m, by_m[m], den_m[m], "%.0f%%" % (100 * den_m[m] / by_m[m]))
    print("service range", min(c["service_date"] for c in claims), max(c["service_date"] for c in claims))
    print("carcs used", sorted(set(c["carc_code"] for c in claims if c["carc_code"])))
    print("rarcs used", sorted(set(c["rarc_code"] for c in claims if c["rarc_code"])))


if __name__ == "__main__":
    main()
