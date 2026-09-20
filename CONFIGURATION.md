# Configuration

This repository intentionally contains placeholders instead of live credentials. Before deployment:

1. Configure `LIFF_ID`, `GAS_BASE_URL`, and `ADMIN_KEY` in `js/app.js` and `js/api.js`.
2. Configure `SHEET_ID`, `ADMIN_KEY`, LINE credentials, and `FRONTEND_URL` in `Gs/Code.gs`.
3. Deploy the files under `Gs/` as a Google Apps Script Web App.
4. Never commit access tokens, channel secrets, admin keys, `.env` files, or private spreadsheet identifiers. Rotate any credential that was previously stored in the source archive.
