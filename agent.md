# Agent Context: Home Dashboard

## Project Overview
This is a Home Dashboard application built with Next.js, used for internal management and display of various services (Church, Home Assistant, etc.).

## Tech Stack
- **Framework**: Next.js
- **Styling**: Tailwind CSS / Vanilla CSS
- **Database**: Prisma (SQL)
- **Deployment**: Docker / Portainer

## Key Features
- Admin Dashboard for managing bookmarks and users.
- Integration with Planning Center Online (PCO).
- Mobile-responsive UI.
- Theme customization.

## Git Repository
- **Remote**: https://github.com/mtcdtech/home-dashboard

## Versioning Policy
- Auto-increment the version number in `package.json` with **every change**.
- Use Semantic Versioning logic (MAJOR.MINOR.PATCH) to determine which digit increments based on the size of the change:
  - **Major (1st digit):** For massive, breaking changes or full rewrites.
  - **Minor (2nd digit):** For new features or significant additions.
  - **Patch (3rd digit):** For small bug fixes, UI tweaks, or minor updates.

## Versioning
- Version numbers must auto-increment with every change.
- Use logic to determine if this is the first (major), second (minor), or third (patch) digit that increments based on the size of the change.
- Ensure the version number prints on every single page at the bottom and is readable (e.g. white text in dark mode).
