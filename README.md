# Ultrasound Online Review & Reporting — v0.2.0

React + Vite application connected to Supabase for the first functional case-submission workflow.

## What's implemented in v0.2.0

- Supabase database read/write for ultrasound cases.
- Actual upload of report/document files and multiple ultrasound images to a private Supabase Storage bucket.
- Separate upload-from-device and direct camera-capture controls for both attachment groups.
- File list with remove-before-submit controls and 50 MB per-file validation.
- Persistent case list loaded from Supabase after refresh/reopening.
- Case details view with signed links to private stored files.
- Sonologist review queue with Approve and Request Changes actions.
- Admin All Cases list.

## Critical test-mode security warning

This release intentionally uses temporary anonymous Supabase policies so the workflow can be exercised before login/password and role management are built. Anyone who can access the public website can read, add, update and delete records/files while these policies remain enabled.

**Use dummy/test patient names, fake lab numbers and non-clinical sample files only. Never upload real patient records, reports, images or identifiable information.** These policies must be replaced by authenticated role-based Row Level Security and private storage policies before any real clinical use.

## Supabase setup (required before the new app version works)

1. Open Supabase Dashboard → SQL Editor → New query.
2. Open `supabase/schema.sql` from this project and copy the complete SQL.
3. Paste it into SQL Editor and click Run.
4. Confirm the `ultrasound_cases` table exists under Table Editor.
5. Confirm the private Storage bucket `ultrasound-files` exists under Storage.
6. Keep the existing Netlify environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (Supabase Publishable key)
7. Redeploy the new GitHub commit in Netlify. Vite environment variables are read at build time.

If Supabase reports a SQL error, stop and resolve it before uploading files. Do not create broad policies manually in addition to this script.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## GitHub update

Replace the existing repository files with this project's files, preserving folder paths, then commit and push to `main`. Netlify should build the new commit automatically if auto-publishing is enabled.

## Current scope / not yet implemented

- User login, password management, admin-created accounts and real role-based access.
- Production-grade RLS, audit trail and per-user case ownership.
- Full report authoring, digital signature, final PDF generation and print dispatch.
- ZIP backup/restore including attachments and verified archive deletion.
- Assignment of cases to specific sonologists.

The current role selector is a development preview only, not authentication or access control.


## Version 0.2.2 changes
- Added Approved By and approval timestamp to case lists and case details.
- Sonologist enters their display name when approving or requesting changes (temporary test mode; real identity will come from authentication later).
- Uploads now run in a small parallel pool, with a visible attachment progress indicator.
- Case list refresh happens in the background after a successful save.
- Re-run `supabase/schema.sql` once to add the new approval metadata columns; the migration uses `ADD COLUMN IF NOT EXISTS` and preserves existing cases.


## Version 0.2.2 – Sonographer edit/delete controls
- Sonographer can edit cases in any status, including approved cases. Editing preserves the current status and approval metadata.
- Sonographer can delete cases only before approval.
- Delete removes the case attachments from the private Storage bucket and then deletes the database row.
- A database trigger blocks deletion of approved cases, even if a delete request bypasses the UI.
- Edit audit fields `edited_by` and `edited_at` are recorded (test-mode identity until real login is implemented).

Run the updated `supabase/schema.sql` in Supabase SQL Editor before deploying this version. The migration only adds columns and a trigger; it does not delete existing cases.
