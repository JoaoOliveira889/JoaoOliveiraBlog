# Joao Oliveira — Blog (Hugo)

Live Site: [joaooliveira.net](https://joaooliveira.net)

This repository contains the source code, configuration, and technical content for my personal blog. It is built using the Hugo static site generator and the Hextra theme, focusing on high performance, clean typography, and technical documentation style.

## Overview

This repository contains the source code and content for my blog. Posts are organized under `content/blog/` (by year and month), and the site is generated statically with Hugo.

## Tech stack

- **Hugo** (static site generator)
- **Hextra** (theme via Hugo Modules)

## Project structure

- `content/`
  - `blog/` — posts and the section page (`_index.md`)
  - `projects.md` — projects page (cards linking to GitHub)
- `assets/` — custom CSS/JS (when applicable)
- `data/`
  - `icons.yaml` — custom icons (e.g., Dev.to)
- `hugo.yaml` — main site configuration

## Run locally

Prerequisites:

- Hugo installed (Extended is recommended when using themes that pipeline assets)

Command:

```bash
hugo server --buildDrafts --disableFastRender
```

## Create a new post

Example (adjust the path/slug as you prefer):

```bash
hugo new blog/2026/01/my-post.md
```

Then edit the generated file under content/blog/... and run the local server to preview.

## License

This is a personal repository. While the code structure is open for reference, the content (articles and images) belongs to João Oliveira. If you reuse any part of the structure, please provide attribution.
