# GitHub Upload Instructions

This folder contains only the required project files for the PDF Reader app.
Removed non-essential folders: `.git`, `.local`, `.expo`, `.replit-artifact`, and `mockup-sandbox`.

## Browser upload method
Upload all files/folders from this extracted folder to your GitHub repository.
This reduced folder has fewer than 100 files, so GitHub browser upload should accept it.

## Recommended command method
Open PowerShell in this folder and run:

```bash
git init
git add .
git commit -m "Initial upload"
git branch -M main
git remote add origin https://github.com/satya19000/pdf-reader.git
git push -u origin main
```
