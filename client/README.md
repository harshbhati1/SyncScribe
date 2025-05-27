# TwinMind Client

## Shared Summary & Client-Side Routing Fix

To ensure that shared summary links (and all client-side routes) work on static hosting (Render, Netlify, Vercel):

- A `_redirects` file is present in `public/` with the following content:
  ```
  /*    /index.html   200
  ```
- The `postbuild` script in `package.json` copies this file to the `build/` directory after every build.
- This ensures that all routes are served by `index.html`, allowing React Router to handle client-side navigation (including `/summary/shared/:shareId`).
- If you use Render, you can also set a redirect rule in the dashboard: `/*` → `/index.html`.

**This fix is required for shared summary links and all deep links to work in production!**

## Client-Side Routing with _redirects (Static Hosting)

To support client-side routing (e.g., for shared summary links) on static hosts like Render, Netlify, or Vercel:

- The `_redirects` file in `public/` ensures all routes are served by `index.html`.
- The `postbuild` script in `package.json` copies this file to `build/` after every build.
- **Do not commit `build/` or `build/_redirects` to git.** The `build/` directory is generated and should remain in `.gitignore`.
- On deployment, ensure your static host uses the `build/` directory and that `_redirects` is present in the deployed output.

---

(Other README content below...) 