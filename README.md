# Ultrasound Online Review & Reporting

Initial GitHub-ready starter for the workflow and screens shared so far.

## Included in this starter

- Admin workspace:
  - Ultrasound user account creation UI
  - All Cases navigation placeholder
  - Archive & Storage screen with monthly backup/import/delete UI
- Sonographer workspace:
  - My Cases
  - Date filters: Today + Yesterday, Today only, Select date range, All cases
  - Add Case modal with patient name, lab number, report/document and ultrasound images
  - File selection and direct camera capture inputs for **both** report/document and ultrasound images
  - Multiple ultrasound image selection
- Sonologist workspace:
  - Review Queue
  - Cases awaiting final review
- Supabase client configuration through environment variables
- Starter SQL schema for profiles and ultrasound cases
- Render static-site deployment configuration

## Important status

This is a **starter implementation / UI prototype**, not a production-ready medical reporting system.
The detailed case review screen, final report authoring/signature, PDF generation, role-based access policies, audit trail, retention rules, and tested backup/restore workflow still need to be specified and implemented. No real patient data should be entered until authentication, database policies, storage policies, and backups have been configured and tested.

## Run locally

1. Install Node.js (LTS).
2. Extract this ZIP.
3. Open a terminal in this folder.
4. Run:

   ```bash
   npm install
   cp .env.example .env
   npm run dev
   ```

5. Open the local URL printed by Vite.

On Windows PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env
```

The UI can be explored without Supabase credentials. Data is held in browser memory for this prototype and will reset on refresh.

## Connect Supabase

1. Create a Supabase project.
2. In Project Settings → API, copy the Project URL and anon/public key.
3. Add them to `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Run `supabase/schema.sql` in Supabase SQL Editor.
5. Configure authentication and Storage policies before using real patient records.

Never put a Supabase service-role key in frontend code or in a `VITE_` variable.

## GitHub

Create an empty GitHub repository, then from this folder:

```bash
git init
git add .
git commit -m "Initial ultrasound review app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

## Render

1. In Render, choose **New → Static Site** and connect the GitHub repository.
2. Build command: `npm install && npm run build`
3. Publish directory: `dist`
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.

`render.yaml` is included as a starting blueprint. Review its settings in Render before deployment.

## Current workflow assumption

Sonographer creates and submits a case. Sonologist receives it in the Review Queue. The exact actions and screen after opening a queued case have not yet been provided, so approval/sign-off is not implemented beyond the queue placeholder.
