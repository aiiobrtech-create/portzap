---
name: awesome-design-md
description: Use the VoltAgent awesome-design-md catalog to find, choose, and apply a matching DESIGN.md when a user wants a brand-aligned UI, asks to mimic a specific website's look and feel, or needs help selecting the closest design system inspiration from the repository. When the catalog has multiple plausible matches, ask which DESIGN.md to base the work on, for example Apple.
---

# Awesome Design MD

## Overview

Use this skill to translate a UI request into the right `DESIGN.md` source from the catalog. Prefer an exact brand match when one exists. If there is more than one plausible match, ask which `DESIGN.md` to use instead of guessing.

## Workflow

1. Identify the target brand, product, or aesthetic.
2. Check `references/catalog.md` for the nearest match.
3. Prefer exact matches from the repo over visual approximations.
4. If the user wants implementation help, extract the key design rules from the chosen `DESIGN.md`:
   - color system
   - typography
   - spacing and density
   - component shape and radius
   - layout structure
   - imagery and motion cues
5. Apply the design as a concise brief or copy the selected `DESIGN.md` into the project root when asked to use it directly.
6. If the request is ambiguous or there are multiple plausible matches, ask one focused question that names a few candidate `DESIGN.md` options.

## Selection Rules

- Use the exact brand entry when the repo contains it.
- If the brand is not present, offer the closest category options and ask the user to choose one.
- Do not blend multiple unrelated inspirations unless the user asks for a hybrid style.
- Keep the result faithful to the source design language instead of defaulting to a generic modern UI.
- A good default question is: `Qual DESIGN.md você quer usar como base? Ex.: Apple, Notion ou Vercel.`

## Output Format

- Name the selected brand or category first.
- State whether it was an exact match or an inference.
- Summarize the key design cues that should drive the UI.
- If useful, list the concrete `DESIGN.md` file or repo entry to use next.
