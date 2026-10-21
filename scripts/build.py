"""Build app/index.html (the single-file page) and src/pure.js (logic used by tests) from src/template.html."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
t = (root / "src/template.html").read_text()
data = (root / "data/claims_data.json").read_text().replace("</", "<\\/")
sample = json.dumps((root / "data/sample_835.txt").read_text()).replace("</", "<\\/")
(root / "app/index.html").write_text(t.replace("__CLAIMS_JSON__", data).replace("__SAMPLE_835__", sample))
a = t.index("// <PURE>") + len("// <PURE>"); b = t.index("// </PURE>")
exports = "\nmodule.exports={parse835,catOf,monthKeys,monthlyRates,buildFacts,factLines,claudeTextIsGrounded,claudeTextHasAdvice,toCSV,csvCell,esc,CODES,CARC_CATEGORY};\n"
(root / "src/pure.js").write_text(t[a:b] + exports)
print("built app/index.html and src/pure.js")
