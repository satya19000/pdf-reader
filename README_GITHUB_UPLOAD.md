# PDF Reader Project - GitHub Upload Instructions

This folder is cleaned and ready for GitHub upload.

## Do not upload these folders
The original ZIP contained system folders that are not required for GitHub:
- `.git/`
- `.local/`
- `node_modules/`
- build/cache files

These were removed from this ready ZIP.

## Upload to GitHub from browser
1. Open GitHub.
2. Create a new repository.
3. Click **Add file → Upload files**.
4. Drag and drop all files/folders from this ZIP after extracting it.
5. Click **Commit changes**.

## Upload using Git commands
```bash
git init
git add .
git commit -m "Initial PDF Reader project upload"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

## Run locally
This project uses pnpm.

```bash
npm install -g pnpm
pnpm install
pnpm run typecheck
pnpm run build
```

Mobile app is inside:

```bash
artifacts/mobile
```

API server is inside:

```bash
artifacts/api-server
```
