# Homebase identity

Homebase is the product. Rhythm and LiftCycle are peer capabilities within it.
Keep the existing top navigation and mobile layouts; new modules should inherit
the shell rather than add a separate brand or typeface.

## Assets

All SVG assets are vector geometry with transparent backgrounds. The logo is a
circle and one continuous, rounded progression line redrawn from the approved
reference. Do not add imagery or a background from the original reference.

| Asset | Use |
| --- | --- |
| `public/brand/mark.svg` | Default teal-to-lavender mark on dark surfaces |
| `public/brand/mark-mono.svg` | Lavender mark for small or single-color dark usage |
| `public/brand/mark-light.svg` | Solid teal mark on light surfaces |
| `public/brand/logo-dark.svg` | Horizontal mark and lowercase Noto Sans Medium wordmark, outlined |
| `public/brand/logo-light.svg` | Horizontal logo with dark wordmark and teal mark for light surfaces |
| `public/favicon.svg` | Simplified lavender mark at browser-tab sizes |
| `public/icons/app.svg` | Standard application icon |
| `public/icons/maskable.svg` | Opaque maskable icon with the mark inside the central safe circle |
| `public/apple-touch-icon.svg` | Apple home-screen icon source |

Use `HomebaseBrand` in the shell. Its default mark is 40 px (34 px on mobile)
and its live wordmark uses weight 500. Use the compact prop for an icon-only
placement, with an accessible name on the containing control. The logo assets
contain no external fonts; outlined wordmarks remain portable. Leave breathing
room of at least one stroke width. The favicon uses a slightly thicker stroke
and a single color to stay clear at 16 px.

## Typography and tokens

`src/tokens.css` is the source of truth for the font family, weights, brand and
semantic colors, surfaces, text hierarchy, borders, radii, spacing, and focus.
`src/style.css` retains training layout rules, `src/homebase.css` contains the
shell/Rhythm layouts, and `src/identity.css` applies shared component treatments.

Use only 400 (body/data), 500 (brand/navigation/emphasis), and 600 (titles and
actions). Noto Sans uses the Latin variable WOFF2 from Fontsource's
`@fontsource-variable/noto-sans` 5.3.0, embedded in the CSS bundle with
`font-display: swap` and system sans-serif fallbacks. The license is in
`public/fonts/OFL.txt`.
Use tabular numerals for times, workout values, and progress. Preserve readable
field sizes on phones and avoid browser number spinners consuming logging space.

Primary colors: teal `#007991`, lavender `#E2D6FF`, canvas `#13162A`.
Teal fills actions; lavender identifies the product and selected navigation.
Mint means completion/success; red means destructive/error; amber means warning.
Do not turn semantic states into branding accents. Use the solid teal variant
on light backgrounds because pale lavender loses contrast there.

The manifest opens `/#/rhythm` in standalone mode. No service worker or new
offline caching strategy is introduced; existing persistence/authentication
behavior remains in the store. Existing local-storage keys, schema, and cloud
configuration remain compatible.

## Verification for this identity release

- Production typecheck/build and 17 existing behavioral tests pass.
- Browser checks cover desktop, 390 px mobile, and 320 px narrow layout;
  Rhythm goals, module navigation, saved workout reload/edit, and progress.
- Auth form rendering and production cloud configuration are checked. A fresh
  live account login and cross-device cloud write were not performed.
- Primary button contrast is 5.07:1; muted text on raised surfaces is 7.23:1;
  selected navigation text is 7.85:1. Input border/field contrast is 4.43:1.
- Icons are validated for dimensions and maskable safe area. Physical iOS
  installation/home-screen caching remains a device-level check.
