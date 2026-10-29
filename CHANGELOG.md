# Changelog
## Code.gs 1.7 / page 1.4.4
- Location is now two parts: main area plus the exact location (e.g. Extraction Plant – Elevation, RVDF). Both are required; saved as "Main – Detail" in the existing Location column.
- Removed "Site-wide"; added "Block 6B" and a single "Other specific location" option.
- New Settings list "Location details" (Main | Detail) for the suggestions. Existing sheets upgrade automatically.

## Code.gs v1.6 / page v1.4.3
- Applicant company (Admin and Entry team): GSB, WEN, KKS, PBS, EcoOils (Project), EcoOils (Operations), or Other with a blank box for the company name (stored as OTHER: <NAME>)
- Contractors logged in with their own code stay locked to their own company
- ENTRY Excel template lists the two EcoOils options and accepts "Other: <company name>"
## v1.4.2 (page)
- "Day 1 · PTW" tab replaced by a red "+ Log new PTW" button
- Registry list has a Revalidate button on live and expired permits; it opens the Revalidation form with the PTW number and applicant company already filled
## Code.gs v1.5
- Day 1 extension can no longer be more than 4 hours after the Day 1 end time: submission and admin edits are refused (previously only flagged)
- Version line moved to line 1 of Code.gs
## v1.4.1
- Signatories in order: Job Coordinator, Permit Authoriser, Area Owner (Day 1 form and permit detail view)
## v1.4
- Compact layout: title, role and log out share one slim row under the standard header; content uses the full screen width
## v1.3
- Standard EcoOils header: Mentari logo left (same size as every app); right column = version only, EN/ID/MS toggle, then a small "v1.3 · date" line. Front end only.
## v1.2
- Version label top right, directly above the EN/ID/MS language toggle
- Malay (MS) added as a third language; EN, ID and MS all supported
- Minimal Shell-style look: Jost light uppercase title, Shell red/yellow accents, layout fits phone to large monitor
- Access codes are emailed to the owner (showCodes, rotateAllCodes, "Forgot access code?" on login); codes are never written to the execution log
## v1.1
- "Applicant company" label; searchable Department dropdown; Location dropdown (with other)
- JHA and Work Method Statement always ticked (locked)
- Valid-from auto-fills issue date and valid-to (+6 days, 7 calendar days)
- Version label shown bottom-right
## v1.0
- Initial PTW registry: web app, Apps Script backend, locked Excel templates
