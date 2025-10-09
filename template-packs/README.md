# Template Packs

Ang direktoryong ito ang canonical source ng scaffolding assets na binabasa ng `project_generator.templates.TemplateRegistry`. Nakaayos ang mga pack ayon sa domain (frontend, backend, database, devex, CI/CD, policy) at bawat isa ay maaaring maglaman ng `template.manifest.json` para i-advertise ang mga variant at engine support.

## High-level Overview

| Sub-folder | Nilalaman | Halagang Punto |
| --- | --- | --- |
| `backend/` | Opinionated server templates para sa Django, FastAPI, NestJS, Go, at fallback na `none/`. | Bawat framework ay may `base/` skeleton (Dockerfile, dependencies, README) at manifest para sa variant metadata. |
| `frontend/` | SPA at mobile shells (Next.js, Nuxt, Angular, Expo). | Mga page/component scaffolds na ginagamit ng `TemplateEngine.generate_page_template`. |
| `database/` | Infra bootstrap para sa Postgres, MongoDB, Firebase, o placeholder `none`. | Kadalasang may docker compose snippets at seed scripts. |
| `devex/` | Developer experience kit: `devcontainer` setup, docker-compose, VS Code snippets, Makefile. | Pwedeng i-symlink sa generated project root para sa consistent tooling. |
| `cicd/` | GitHub workflow recipes (`ci-test.yml`, `ci-lint.yml`, `ci-security.yml`, `ci-deploy.yml`) at shared `gates_config.yaml`. | Hinahalo sa `.github/workflows` ng bagong proyekto. |
| `policy-dsl/` | YAML definitions gaya ng `client-generator-policies.yaml` na ginagamit ng policy engine. | Kapaki-pakinabang kapag nagpapatupad ng gating rules kasama ang `.cursor` assets. |
| `README-NO-INSTALL.md` | Quick note kung paano kopyahin ang DevEx tooling nang hindi nag-i-install ng buong template pack. | Reference lamang; hindi binabasa ng generator. |

## Pagdaragdag ng Bagong Pack

1. Gumawa ng folder sa ilalim ng naaangkop na domain (`frontend/<tech>`, `backend/<framework>`, atbp.).
2. Maglagay ng `template.manifest.json` para ilarawan ang pangalan, variants, at optional na template engines:
   ```json
   {
     "name": "FastAPI Starter",
     "variants": ["base"],
     "engines": ["jinja2"]
   }
   ```
3. Ilagay ang aktuwal na assets sa loob ng mga variant subdirectories (hal. `base/`). Kapag walang manifest, susubukan ng registry na hulaan ang variants base sa mga subfolder.
4. Kapag may DevEx o CI asset na gumagamit ng variable placeholders, tiyaking tugma ang syntax sa `TemplateEngine` (kasalukuyang naka-hardcode para sa Next.js, Nuxt, Angular, Expo, FastAPI, Django, NestJS, Go).

## Konsumo ng Generator

- **Discovery** – Tinutukoy ng `TemplateRegistry.list_all()` ang path ng pack at ibinabalik ang metadata sa generator.
- **Copying** – Si `ProjectGenerator._generate_frontend/_generate_backend/_setup_database` ang kumokopya ng mga file mula sa tinukoy na variant papunta sa output project.
- **Compliance & Policy** – Ang `policy-dsl` ay kasamang kino-copy kapag hindi naka-enable ang `--no-cursor-assets`. Maaari ding gumamit ng `--rules-manifest` upang pumili ng eksaktong policy files.

## Customization Tips

- Huwag maglagay ng binary o build artifacts sa loob ng packs; inaasahan ng generator na idempotent ang copy operations.
- Maaari kang magdagdag ng mga `.jinja` o iba pang templated files, ngunit kailangan mo ring i-extend ang `TemplateEngine` kung may bagong syntax.
- Kapag nagbago ang folder structure, i-update ang anumang automation scripts na umaasa sa relative paths (hal. smoke tests o DevEx scripts).
