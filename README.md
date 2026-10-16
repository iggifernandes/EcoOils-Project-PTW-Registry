# EcoOils Mentari – PTW Registry (v1.1)

Paper PTW stays the legal document. This registry **records** it, flags problems, and gives you one live picture of every permit.

## What changed in v1.1
- **Applicant company** replaces the word "Contractor" everywhere (forms, Excel, dashboard).
- **Department** and **Location** are searchable dropdowns. Anything not on the list can still be typed. Admin edits the lists in *Settings & log → Dropdown lists* (one entry per line). The starter lists are placeholders – replace them with your real ones.
- **JHA and Work Method Statement are always ticked** and cannot be unticked, on the web form, in the Excel template (yellow locked cells), by the server, and even through a correction request.
- **Valid from** drives the rest: Date (Day 1) = valid from, Valid to = valid from + 6 days (7 days in total). A shorter end date is allowed, a longer one is not.
- *Planned, not built yet:* applicant names drawn automatically from the list of PTW-trained persons.

## Who can do what
| Access code | Can | Cannot |
|---|---|---|
| **Admin** (you only) | See everything, approve corrections, edit/void with a logged reason, settings, purge test data | – |
| **Contractor** (GSB / WEN / KKS / PBS – one code each, held by their PTW Receiver) | Submit PTW (Day 1), Revalidation (Days 2-7), Closure, Excel upload, request a correction | **Read anything back.** They only see a receipt for what they just submitted |
| **Entry** (assistant team) | Submit for any contractor (web or Excel) | Read anything back |

Submitted records are **immutable**. A mistake goes through *Request correction* (contractor/entry) → you approve → the registry changes the value and keeps the old value in the Corrections tab and Log. You can also fix a field directly from the permit drawer (reason required, logged) or void a whole entry.

## One-time setup (about 15 minutes)
1. Create a **new Google Sheet** (name it e.g. *EcoOils Mentari PTW Registry*) under the account you want to own the data.
2. **Extensions → Apps Script.** Delete the sample code, paste all of `Code.gs`, save.
3. In Apps Script: **Project Settings → tick "Show appsscript.json"**, open it and set `"timeZone": "Asia/Jakarta"`.
4. Select function **`setup`** → Run → approve permissions. It creates the tabs and generates the access codes.
5. **Executions / View → Logs**: copy the codes (run `showCodes` any time to see them again). Admin code = yours alone.
6. **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → Deploy → copy the **Web app URL**.
7. Open `index.html`, replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with that URL.
8. Upload `index.html` and the `templates` folder to your GitHub repository (GitHub Pages). Do **not** put access codes in the repository.
9. Open the page → log in with the Admin code.

### Updating an existing deployment (v1.0 → v1.1)
1. Apps Script → open `Code.gs`, select everything, paste the new `Code.gs`, **Save**. Your data and access codes are kept.
2. **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy.** The URL stays the same.
3. GitHub: upload the new `index.html` and the whole new `templates` folder (replace the old ones).
4. Hard-refresh the page (Ctrl+F5). Hand contractors the NEW Excel templates; the old ones still work except they lack the JHA/WMS pre-tick, so uploads from them will be refused until JHA/WMS are ticked.

## Trial run with the assistant team (test mode is ON by default)
1. Give the assistants the **Entry** code. They enter dummy permits (web form and the `ENTRY` Excel template).
2. Everything they enter is marked **TEST** (yellow banner on every screen).
3. Check the Overview, flags, matrix and corrections flow. Try deliberate mistakes: duplicate number, Day 8, JC = Area Owner, missing checklist, no signatory.
4. When satisfied: **Settings & log → Remove test data** (type `PURGE`) → untick *Test mode* → Save. Real data is never touched by the purge.
5. Hand each contractor receiver their own code and their own template (`templates/PTW_Registry_Template_GSB.xlsx` etc.).

## What the registry flags automatically
Validity over 7 days · Day 8+ refused · checklist not ticked for Hot / WAH / CSE / Electrical / HV / Lifting / Isolation / Excavation · Job Coordinator same person as Area Owner or Authoriser · RAM High · Day shift over 8 h · extension over 4 h or without Area Owner approval · date not matching day number · date outside validity · missing signatory on a revalidation · revalidation after closure · closed after validity ended · **missing revalidation for a previous day · permit expired but not closed · no revalidation recorded today · possible overlap of live permits at the same location**.

## Security – honest notes
- Access codes are shared secrets. Anyone with a contractor code can *submit* as that contractor (never read). If a code leaks, run `rotateAllCodes` in Apps Script – every old code stops immediately.
- 30 wrong codes in 10 minutes locks login for everyone for 10 minutes (brute-force guard).
- Excel sheet protection is a convenience (password in `make_templates.py`). The real enforcement is on upload: every row is re-validated by the server and nothing is saved if any row fails.
- Data lives only in your Google Sheet. Keep the Sheet itself private to you.

## Files
`index.html` web app (EN / Bahasa) · `Code.gs` backend · `templates/` locked Excel templates (GSB, WEN, KKS, PBS, ENTRY) · `make_templates.py` regenerates templates from the backend schema.
