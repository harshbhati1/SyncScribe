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

---

(Other README content below...) 