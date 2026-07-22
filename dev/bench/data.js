window.BENCHMARK_DATA = {
  "lastUpdate": 1784752888440,
  "repoUrl": "https://github.com/generaltranslation/gt",
  "entries": {
    "Middleware Benchmarks": [
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "3047e10e48a96416dcf4e3e1df8118652d30db7b",
          "message": "[ci] release (#1056)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-next@6.13.1\n\n### Patch Changes\n\n- [#1055](https://github.com/generaltranslation/gt/pull/1055)\n[`8f114ec`](https://github.com/generaltranslation/gt/commit/8f114eccffad67c8d7f54d32502d50ce509faf67)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: bump\npatch\n\n## @generaltranslation/gt-next-lint@11.0.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8f114ec`](https://github.com/generaltranslation/gt/commit/8f114eccffad67c8d7f54d32502d50ce509faf67)]:\n    -   gt-next@6.13.1\n\n## gt-next-middleware-e2e@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8f114ec`](https://github.com/generaltranslation/gt/commit/8f114eccffad67c8d7f54d32502d50ce509faf67)]:\n    -   gt-next@6.13.1\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-02-28T00:04:40Z",
          "url": "https://github.com/generaltranslation/gt/commit/3047e10e48a96416dcf4e3e1df8118652d30db7b"
        },
        "date": 1772237514284,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.043370529881169274,
            "range": "±0.0191",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2539664464195048,
            "range": "±0.0674",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4492701060197664,
            "range": "±0.0715",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.43514151652173894,
            "range": "±0.0460",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 232.19999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 258.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 372.19999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 148,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 19.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 29.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 139.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 587,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.700000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 133.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.1\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "6ed3c165e5b8746d76efd23d3dc3d0e34f8cda5f",
          "message": "[ci] release (#1072)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.7.0\n\n### Minor Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n## gtx-cli@2.7.0\n\n### Minor Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)]:\n    -   gt@2.7.0\n\n## @generaltranslation/compiler@1.1.24\n\n### Patch Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n## locadex@1.0.110\n\n### Patch Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n- Updated dependencies\n\\[[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)]:\n    -   gt@2.7.0\n\n## gt-next@6.13.4\n\n### Patch Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n- Updated dependencies\n\\[[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)]:\n    -   @generaltranslation/compiler@1.1.24\n    -   gt-react@10.11.3\n\n## @generaltranslation/gt-next-lint@11.0.4\n\n### Patch Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n- Updated dependencies\n\\[[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)]:\n    -   gt-next@6.13.4\n\n## gt-react@10.11.3\n\n### Patch Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n- Updated dependencies\n\\[[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)]:\n    -   @generaltranslation/react-core@1.5.3\n\n## @generaltranslation/react-core@1.5.3\n\n### Patch Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n## @generaltranslation/react-core-linter@0.1.3\n\n### Patch Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n## gt-tanstack-start@0.1.10\n\n### Patch Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n- Updated dependencies\n\\[[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)]:\n    -   @generaltranslation/react-core@1.5.3\n    -   gt-react@10.11.3\n\n## next-ssg@0.1.1\n\n### Patch Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n## gt-next-middleware-e2e@0.1.4\n\n### Patch Changes\n\n- [#1069](https://github.com/generaltranslation/gt/pull/1069)\n[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add new\ngt package\n\n- Updated dependencies\n\\[[`ff38c7c`](https://github.com/generaltranslation/gt/commit/ff38c7c72886882ddb8851fc8173e1ba863d0078)]:\n    -   gt-next@6.13.4\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-05T21:39:36Z",
          "url": "https://github.com/generaltranslation/gt/commit/6ed3c165e5b8746d76efd23d3dc3d0e34f8cda5f"
        },
        "date": 1772747238373,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.041616533416562566,
            "range": "±0.0177",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24626693648449258,
            "range": "±0.0639",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.43652048080278955,
            "range": "±0.06",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4254478350340167,
            "range": "±0.0439",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 230.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 257.8999999999942,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 371.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 146,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.699999999982538,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 137.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 596,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.200000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.60000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 132.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.4\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "c0b6094e0629dae481104f84f7c09253bb3ce5a8",
          "message": "[ci] release (#1083)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.7.1\n\n### Patch Changes\n\n- [#1085](https://github.com/generaltranslation/gt/pull/1085)\n[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)\nThanks [@brian-lou](https://github.com/brian-lou)! - feat: Auth wizard\nsupports both types of key creation\n\n- [#1082](https://github.com/generaltranslation/gt/pull/1082)\n[`3cb3bbd`](https://github.com/generaltranslation/gt/commit/3cb3bbd13046e6c1f6f9d4b5286669b96b4a85b2)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Bumping\nCLI timeouts\n\n- [#1076](https://github.com/generaltranslation/gt/pull/1076)\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply\nstyle guide to error messages and warnings: remove \"Please\", simplify\nverbose phrasing, fix `in-line` → `inline`.\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:\n    -   generaltranslation@8.1.14\n\n## @generaltranslation/compiler@1.1.25\n\n### Patch Changes\n\n- [#1076](https://github.com/generaltranslation/gt/pull/1076)\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply\nstyle guide to error messages and warnings: remove \"Please\", simplify\nverbose phrasing, fix `in-line` → `inline`.\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:\n    -   generaltranslation@8.1.14\n\n## generaltranslation@8.1.14\n\n### Patch Changes\n\n- [#1085](https://github.com/generaltranslation/gt/pull/1085)\n[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)\nThanks [@brian-lou](https://github.com/brian-lou)! - feat: Auth wizard\nsupports both types of key creation\n\n## gtx-cli@2.7.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76),\n[`3cb3bbd`](https://github.com/generaltranslation/gt/commit/3cb3bbd13046e6c1f6f9d4b5286669b96b4a85b2),\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)]:\n    -   gt@2.7.1\n\n## gt-i18n@0.4.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:\n    -   generaltranslation@8.1.14\n    -   @generaltranslation/supported-locales@2.0.47\n\n## locadex@1.0.111\n\n### Patch Changes\n\n- [#1076](https://github.com/generaltranslation/gt/pull/1076)\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply\nstyle guide to error messages and warnings: remove \"Please\", simplify\nverbose phrasing, fix `in-line` → `inline`.\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76),\n[`3cb3bbd`](https://github.com/generaltranslation/gt/commit/3cb3bbd13046e6c1f6f9d4b5286669b96b4a85b2),\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)]:\n    -   gt@2.7.1\n\n## gt-next@6.13.5\n\n### Patch Changes\n\n- [#1076](https://github.com/generaltranslation/gt/pull/1076)\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply\nstyle guide to error messages and warnings: remove \"Please\", simplify\nverbose phrasing, fix `in-line` → `inline`.\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76),\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)]:\n    -   generaltranslation@8.1.14\n    -   @generaltranslation/compiler@1.1.25\n    -   gt-i18n@0.4.2\n    -   gt-react@10.11.4\n    -   @generaltranslation/supported-locales@2.0.47\n\n## @generaltranslation/gt-next-lint@11.0.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)]:\n    -   gt-next@6.13.5\n\n## gt-node@0.2.8\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:\n    -   generaltranslation@8.1.14\n    -   gt-i18n@0.4.2\n\n## gt-react@10.11.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76),\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)]:\n    -   generaltranslation@8.1.14\n    -   @generaltranslation/react-core@1.5.4\n    -   @generaltranslation/supported-locales@2.0.47\n\n## @generaltranslation/react-core@1.5.4\n\n### Patch Changes\n\n- [#1076](https://github.com/generaltranslation/gt/pull/1076)\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply\nstyle guide to error messages and warnings: remove \"Please\", simplify\nverbose phrasing, fix `in-line` → `inline`.\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:\n    -   generaltranslation@8.1.14\n    -   gt-i18n@0.4.2\n    -   @generaltranslation/supported-locales@2.0.47\n\n## gt-sanity@1.1.21\n\n### Patch Changes\n\n- [#1076](https://github.com/generaltranslation/gt/pull/1076)\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Apply\nstyle guide to error messages and warnings: remove \"Please\", simplify\nverbose phrasing, fix `in-line` → `inline`.\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:\n    -   generaltranslation@8.1.14\n\n## @generaltranslation/supported-locales@2.0.47\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76)]:\n    -   generaltranslation@8.1.14\n\n## gt-tanstack-start@0.1.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`dad7824`](https://github.com/generaltranslation/gt/commit/dad78246d164b201d4fc14c89213cc04f21c8b76),\n[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)]:\n    -   generaltranslation@8.1.14\n    -   @generaltranslation/react-core@1.5.4\n    -   gt-i18n@0.4.2\n    -   gt-react@10.11.4\n\n## gt-next-middleware-e2e@0.1.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`19ae4eb`](https://github.com/generaltranslation/gt/commit/19ae4eb0baf7e6f15d19f9fad384621d38d73d57)]:\n    -   gt-next@6.13.5\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-07T05:41:37Z",
          "url": "https://github.com/generaltranslation/gt/commit/c0b6094e0629dae481104f84f7c09253bb3ce5a8"
        },
        "date": 1772862604731,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.041347119986769064,
            "range": "±0.0213",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2547376775343866,
            "range": "±0.0711",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4519349177958455,
            "range": "±0.0861",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4371167298951043,
            "range": "±0.0599",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 239.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 277.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 380.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 158,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 149.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.699999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.699999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 133.19999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.5\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "fb656e2252036e540222e1329b0b1d8d8cd5c7a9",
          "message": "[ci] release (#1091)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-i18n@0.5.0\n\n### Minor Changes\n\n- [#1090](https://github.com/generaltranslation/gt/pull/1090)\n[`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add\nlocale utilities\n\n## gt-node@0.3.0\n\n### Minor Changes\n\n- [#1090](https://github.com/generaltranslation/gt/pull/1090)\n[`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add\nlocale utilities\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0)]:\n    -   gt-i18n@0.5.0\n\n## gt-next@6.13.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0)]:\n    -   gt-i18n@0.5.0\n    -   gt-react@10.11.5\n\n## @generaltranslation/gt-next-lint@11.0.6\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.13.6\n\n## gt-react@10.11.5\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   @generaltranslation/react-core@1.5.5\n\n## @generaltranslation/react-core@1.5.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0)]:\n    -   gt-i18n@0.5.0\n\n## gt-tanstack-start@0.1.12\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`7846d06`](https://github.com/generaltranslation/gt/commit/7846d0672ba357081793706fdf55313b4f5428e0)]:\n    -   gt-i18n@0.5.0\n    -   @generaltranslation/react-core@1.5.5\n    -   gt-react@10.11.5\n\n## gt-next-middleware-e2e@0.1.6\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.13.6\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-09T20:29:07Z",
          "url": "https://github.com/generaltranslation/gt/commit/fb656e2252036e540222e1329b0b1d8d8cd5c7a9"
        },
        "date": 1773088615286,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04159607852924109,
            "range": "±0.0166",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2545324402035642,
            "range": "±0.0706",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.446577460714288,
            "range": "±0.0627",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.43929755136084087,
            "range": "±0.055",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 240.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 251.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 370,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 152,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 29.100000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 142.90000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 583,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 133.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.6\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "65dda776df168170b10d1e0a0fcb0716c4927cea",
          "message": "[ci] release (#1097)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.8.2\n\n### Patch Changes\n\n- [#1098](https://github.com/generaltranslation/gt/pull/1098)\n[`612ace4`](https://github.com/generaltranslation/gt/commit/612ace4bb30aaa3406b949931c8ffdb3f43ebd9f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: upload\nsupporting composite json\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n    -   @generaltranslation/python-extractor@0.1.1\n\n## @generaltranslation/compiler@1.1.26\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n\n## generaltranslation@8.1.15\n\n### Patch Changes\n\n- [#1096](https://github.com/generaltranslation/gt/pull/1096)\n[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: remove\nrequired branchId field for enqueue\n\n## gtx-cli@2.8.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`612ace4`](https://github.com/generaltranslation/gt/commit/612ace4bb30aaa3406b949931c8ffdb3f43ebd9f)]:\n    -   gt@2.8.2\n\n## gt-i18n@0.5.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n    -   @generaltranslation/supported-locales@2.0.48\n\n## locadex@1.0.114\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`612ace4`](https://github.com/generaltranslation/gt/commit/612ace4bb30aaa3406b949931c8ffdb3f43ebd9f)]:\n    -   gt@2.8.2\n\n## gt-next@6.13.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n    -   @generaltranslation/compiler@1.1.26\n    -   gt-i18n@0.5.1\n    -   gt-react@10.11.6\n    -   @generaltranslation/supported-locales@2.0.48\n\n## @generaltranslation/gt-next-lint@11.0.7\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.13.7\n\n## gt-node@0.3.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n    -   gt-i18n@0.5.1\n\n## @generaltranslation/python-extractor@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n\n## gt-react@10.11.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n    -   @generaltranslation/react-core@1.5.6\n    -   @generaltranslation/supported-locales@2.0.48\n\n## @generaltranslation/react-core@1.5.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n    -   gt-i18n@0.5.1\n    -   @generaltranslation/supported-locales@2.0.48\n\n## gt-sanity@1.1.22\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n\n## @generaltranslation/supported-locales@2.0.48\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n\n## gt-tanstack-start@0.1.13\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1793010`](https://github.com/generaltranslation/gt/commit/1793010ea33ceceba307832195433ff3b7f1143e)]:\n    -   generaltranslation@8.1.15\n    -   gt-i18n@0.5.1\n    -   gt-react@10.11.6\n    -   @generaltranslation/react-core@1.5.6\n\n## gt-next-middleware-e2e@0.1.7\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.13.7\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-10T18:44:06Z",
          "url": "https://github.com/generaltranslation/gt/commit/65dda776df168170b10d1e0a0fcb0716c4927cea"
        },
        "date": 1773168747000,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.042637595719279296,
            "range": "±0.0243",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2511050170682799,
            "range": "±0.0664",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4448197635555508,
            "range": "±0.0667",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.43219205012965034,
            "range": "±0.0433",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 236.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 253.90000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 369.6000000000349,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 149,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 140.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 585,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 12.299999999988358,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21.899999999965075,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 132.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.7\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Ernest McCarter",
            "username": "ErnestM1234",
            "email": "ernest@generaltranslation.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "437a3898f1daa0a40ac033c2cc1bb94b4a0fd86b",
          "message": "fix(cli): remove tw from init menu (#1101)",
          "timestamp": "2026-03-10T21:21:59Z",
          "url": "https://github.com/generaltranslation/gt/commit/437a3898f1daa0a40ac033c2cc1bb94b4a0fd86b"
        },
        "date": 1773178197052,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03142645276852477,
            "range": "±0.014",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.20882483131524152,
            "range": "±0.0632",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.3835662507668695,
            "range": "±0.0664",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.38547670184901034,
            "range": "±0.0795",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 230.69999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 269.3999999999942,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 374,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 149,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 139.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 592,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.300000000017462,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.800000000017462,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 137.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.8\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "5c47b5ae32c882937ac23238d50c71259096e580",
          "message": "[ci] release (#1114)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-i18n@0.6.0\n\n### Minor Changes\n\n- [#1113](https://github.com/generaltranslation/gt/pull/1113)\n[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add\nstring translation function t()\n\n## gt-react@10.12.0\n\n### Minor Changes\n\n- [#1113](https://github.com/generaltranslation/gt/pull/1113)\n[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add\nstring translation function t()\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:\n    -   gt-i18n@0.6.0\n    -   @generaltranslation/react-core@1.5.8\n\n## gt@2.10.4\n\n### Patch Changes\n\n- [#1113](https://github.com/generaltranslation/gt/pull/1113)\n[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add\nstring translation function t()\n\n## gtx-cli@2.10.4\n\n### Patch Changes\n\n- [#1113](https://github.com/generaltranslation/gt/pull/1113)\n[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add\nstring translation function t()\n\n- Updated dependencies\n\\[[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:\n    -   gt@2.10.4\n\n## locadex@1.0.120\n\n### Patch Changes\n\n- [#1113](https://github.com/generaltranslation/gt/pull/1113)\n[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add\nstring translation function t()\n\n- Updated dependencies\n\\[[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:\n    -   gt@2.10.4\n\n## gt-next@6.13.9\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:\n    -   gt-react@10.12.0\n    -   gt-i18n@0.6.0\n\n## @generaltranslation/gt-next-lint@11.0.9\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.13.9\n\n## gt-node@0.3.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:\n    -   gt-i18n@0.6.0\n\n## @generaltranslation/react-core@1.5.8\n\n### Patch Changes\n\n- [#1113](https://github.com/generaltranslation/gt/pull/1113)\n[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add\nstring translation function t()\n\n- Updated dependencies\n\\[[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:\n    -   gt-i18n@0.6.0\n\n## gt-tanstack-start@0.1.15\n\n### Patch Changes\n\n- [#1113](https://github.com/generaltranslation/gt/pull/1113)\n[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add\nstring translation function t()\n\n- Updated dependencies\n\\[[`7e2bbc5`](https://github.com/generaltranslation/gt/commit/7e2bbc575d9d2bcc358bfa11c880a7bf4aac8636)]:\n    -   gt-react@10.12.0\n    -   gt-i18n@0.6.0\n    -   @generaltranslation/react-core@1.5.8\n\n## gt-next-middleware-e2e@0.1.9\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.13.9\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-17T04:13:30Z",
          "url": "https://github.com/generaltranslation/gt/commit/5c47b5ae32c882937ac23238d50c71259096e580"
        },
        "date": 1773721281445,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03924061105007038,
            "range": "±0.0145",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.248338247765637,
            "range": "±0.0616",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4431899636846789,
            "range": "±0.0605",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4327269515571056,
            "range": "±0.0451",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 220.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 230.30000000004657,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 348.4000000000233,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 177,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.399999999906868,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 67.69999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 168.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 584,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.699999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 133,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.9\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "240e209af8f2c29a6589bd1f61adf5e167e0e60c",
          "message": "[ci] release (#1119)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.10.6\n\n### Patch Changes\n\n- [#1062](https://github.com/generaltranslation/gt/pull/1062)\n[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nrename static to derive, and deprecate static\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   generaltranslation@8.1.17\n    -   @generaltranslation/python-extractor@0.1.3\n\n## @generaltranslation/compiler@1.1.28\n\n### Patch Changes\n\n- [#1062](https://github.com/generaltranslation/gt/pull/1062)\n[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nrename static to derive, and deprecate static\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   generaltranslation@8.1.17\n\n## generaltranslation@8.1.17\n\n### Patch Changes\n\n- [#1062](https://github.com/generaltranslation/gt/pull/1062)\n[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nrename static to derive, and deprecate static\n\n## gtx-cli@2.10.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   gt@2.10.6\n\n## gt-i18n@0.6.1\n\n### Patch Changes\n\n- [#1062](https://github.com/generaltranslation/gt/pull/1062)\n[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nrename static to derive, and deprecate static\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   generaltranslation@8.1.17\n    -   @generaltranslation/supported-locales@2.0.50\n\n## locadex@1.0.122\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   gt@2.10.6\n\n## gt-next@6.13.10\n\n### Patch Changes\n\n- [#1062](https://github.com/generaltranslation/gt/pull/1062)\n[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nrename static to derive, and deprecate static\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   @generaltranslation/compiler@1.1.28\n    -   gt-react@10.12.1\n    -   generaltranslation@8.1.17\n    -   gt-i18n@0.6.1\n    -   @generaltranslation/supported-locales@2.0.50\n\n## @generaltranslation/gt-next-lint@11.0.10\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   gt-next@6.13.10\n\n## gt-node@0.3.4\n\n### Patch Changes\n\n- [#1062](https://github.com/generaltranslation/gt/pull/1062)\n[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nrename static to derive, and deprecate static\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   generaltranslation@8.1.17\n    -   gt-i18n@0.6.1\n\n## @generaltranslation/python-extractor@0.1.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   generaltranslation@8.1.17\n\n## gt-react@10.12.1\n\n### Patch Changes\n\n- [#1062](https://github.com/generaltranslation/gt/pull/1062)\n[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nrename static to derive, and deprecate static\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   @generaltranslation/react-core@1.5.9\n    -   generaltranslation@8.1.17\n    -   gt-i18n@0.6.1\n    -   @generaltranslation/supported-locales@2.0.50\n\n## @generaltranslation/react-core@1.5.9\n\n### Patch Changes\n\n- [#1062](https://github.com/generaltranslation/gt/pull/1062)\n[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nrename static to derive, and deprecate static\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   generaltranslation@8.1.17\n    -   gt-i18n@0.6.1\n    -   @generaltranslation/supported-locales@2.0.50\n\n## @generaltranslation/react-core-linter@0.1.4\n\n### Patch Changes\n\n- [#1062](https://github.com/generaltranslation/gt/pull/1062)\n[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nrename static to derive, and deprecate static\n\n## gt-sanity@1.1.24\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   generaltranslation@8.1.17\n\n## @generaltranslation/supported-locales@2.0.50\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   generaltranslation@8.1.17\n\n## gt-tanstack-start@0.1.16\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   @generaltranslation/react-core@1.5.9\n    -   gt-react@10.12.1\n    -   generaltranslation@8.1.17\n    -   gt-i18n@0.6.1\n\n## gt-next-middleware-e2e@0.1.10\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2274e23`](https://github.com/generaltranslation/gt/commit/2274e23d448c8a96d661d30e5c7fc737814c1fb0)]:\n    -   gt-next@6.13.10\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-18T04:54:15Z",
          "url": "https://github.com/generaltranslation/gt/commit/240e209af8f2c29a6589bd1f61adf5e167e0e60c"
        },
        "date": 1773810199929,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.041545886165351126,
            "range": "±0.0165",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2527238120262781,
            "range": "±0.0681",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4550070691537707,
            "range": "±0.0854",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.43428316406250367,
            "range": "±0.0479",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 235.39999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 268.3999999999651,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 373.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 145,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 16.900000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 25.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 136.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 595,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.100000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 23.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 132.30000000004657,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.10\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "caf22f6d051c35fcabeb7c4401d3eef7ff0405fe",
          "message": "[ci] release (#1120)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-react@10.13.0\n\n### Minor Changes\n\n- [#1118](https://github.com/generaltranslation/gt/pull/1118)\n[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add t\nmacro\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:\n    -   gt-i18n@0.6.2\n    -   @generaltranslation/react-core@1.5.10\n\n## gt@2.10.7\n\n### Patch Changes\n\n- [#1118](https://github.com/generaltranslation/gt/pull/1118)\n[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add t\nmacro\n\n## @generaltranslation/compiler@1.1.29\n\n### Patch Changes\n\n- [#1118](https://github.com/generaltranslation/gt/pull/1118)\n[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add t\nmacro\n\n## gtx-cli@2.10.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:\n    -   gt@2.10.7\n\n## gt-i18n@0.6.2\n\n### Patch Changes\n\n- [#1118](https://github.com/generaltranslation/gt/pull/1118)\n[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: add t\nmacro\n\n## locadex@1.0.123\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:\n    -   gt@2.10.7\n\n## gt-next@6.13.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:\n    -   gt-react@10.13.0\n    -   @generaltranslation/compiler@1.1.29\n    -   gt-i18n@0.6.2\n\n## @generaltranslation/gt-next-lint@11.0.11\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.13.11\n\n## gt-node@0.3.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:\n    -   gt-i18n@0.6.2\n\n## @generaltranslation/react-core@1.5.10\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:\n    -   gt-i18n@0.6.2\n\n## gt-tanstack-start@0.1.17\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`de6a2d1`](https://github.com/generaltranslation/gt/commit/de6a2d1caa150383c70844b3ee6b9b2e66f77769)]:\n    -   gt-react@10.13.0\n    -   gt-i18n@0.6.2\n    -   @generaltranslation/react-core@1.5.10\n\n## gt-next-middleware-e2e@0.1.11\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.13.11\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-18T06:14:26Z",
          "url": "https://github.com/generaltranslation/gt/commit/caf22f6d051c35fcabeb7c4401d3eef7ff0405fe"
        },
        "date": 1773814931483,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.038956107440591775,
            "range": "±0.0142",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24547071575846635,
            "range": "±0.0612",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4390574635645296,
            "range": "±0.0638",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4291558156089295,
            "range": "±0.0495",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 232.20000000018626,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 263.60000000009313,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 372.20000000018626,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 148,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.699999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.0999999998603,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 139.19999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 586,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.800000000046566,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 130.10000000009313,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.13.11\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "5547cb436b7703b42dab5548137af5059ca3fd37",
          "message": "[ci] release (#1126)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.11.0\n\n### Minor Changes\n\n- [#1122](https://github.com/generaltranslation/gt/pull/1122)\n[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding\nCDN publishing for all file types\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   generaltranslation@8.1.18\n    -   @generaltranslation/python-extractor@0.1.4\n\n## gt-i18n@0.7.0\n\n### Minor Changes\n\n- [#1121](https://github.com/generaltranslation/gt/pull/1121)\n[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5)\nThanks [@pie575](https://github.com/pie575)! - Added a versionId hook\nfor users to better access what Version their GT translations are on\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   generaltranslation@8.1.18\n    -   @generaltranslation/supported-locales@2.0.51\n\n## gt-next@6.14.0\n\n### Minor Changes\n\n- [#1121](https://github.com/generaltranslation/gt/pull/1121)\n[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5)\nThanks [@pie575](https://github.com/pie575)! - Added a versionId hook\nfor users to better access what Version their GT translations are on\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5),\n[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   gt-react@10.14.0\n    -   gt-i18n@0.7.0\n    -   generaltranslation@8.1.18\n    -   @generaltranslation/compiler@1.1.30\n    -   @generaltranslation/supported-locales@2.0.51\n\n## gt-node@0.4.0\n\n### Minor Changes\n\n- [#1121](https://github.com/generaltranslation/gt/pull/1121)\n[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5)\nThanks [@pie575](https://github.com/pie575)! - Added a versionId hook\nfor users to better access what Version their GT translations are on\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5),\n[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   gt-i18n@0.7.0\n    -   generaltranslation@8.1.18\n\n## gt-react@10.14.0\n\n### Minor Changes\n\n- [#1121](https://github.com/generaltranslation/gt/pull/1121)\n[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5)\nThanks [@pie575](https://github.com/pie575)! - Added a versionId hook\nfor users to better access what Version their GT translations are on\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5),\n[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   @generaltranslation/react-core@1.6.0\n    -   gt-i18n@0.7.0\n    -   generaltranslation@8.1.18\n    -   @generaltranslation/supported-locales@2.0.51\n\n## @generaltranslation/react-core@1.6.0\n\n### Minor Changes\n\n- [#1121](https://github.com/generaltranslation/gt/pull/1121)\n[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5)\nThanks [@pie575](https://github.com/pie575)! - Added a versionId hook\nfor users to better access what Version their GT translations are on\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5),\n[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   gt-i18n@0.7.0\n    -   generaltranslation@8.1.18\n    -   @generaltranslation/supported-locales@2.0.51\n\n## gt-tanstack-start@0.2.0\n\n### Minor Changes\n\n- [#1121](https://github.com/generaltranslation/gt/pull/1121)\n[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5)\nThanks [@pie575](https://github.com/pie575)! - Added a versionId hook\nfor users to better access what Version their GT translations are on\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5),\n[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   @generaltranslation/react-core@1.6.0\n    -   gt-react@10.14.0\n    -   gt-i18n@0.7.0\n    -   generaltranslation@8.1.18\n\n## @generaltranslation/compiler@1.1.30\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   generaltranslation@8.1.18\n\n## generaltranslation@8.1.18\n\n### Patch Changes\n\n- [#1122](https://github.com/generaltranslation/gt/pull/1122)\n[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding\nCDN publishing for all file types\n\n## gtx-cli@2.11.0\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   gt@2.11.0\n\n## locadex@1.0.125\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   gt@2.11.0\n\n## @generaltranslation/gt-next-lint@12.0.0\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5)]:\n    -   gt-next@6.14.0\n\n## @generaltranslation/python-extractor@0.1.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   generaltranslation@8.1.18\n\n## gt-sanity@1.1.25\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   generaltranslation@8.1.18\n\n## @generaltranslation/supported-locales@2.0.51\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6d516a7`](https://github.com/generaltranslation/gt/commit/6d516a784f1192f7758689fcf4557e8a19de740a)]:\n    -   generaltranslation@8.1.18\n\n## gt-next-middleware-e2e@0.1.12\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b6a58de`](https://github.com/generaltranslation/gt/commit/b6a58de76998b28ce3247aa1a7005fffaeb210a5)]:\n    -   gt-next@6.14.0\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-19T00:26:38Z",
          "url": "https://github.com/generaltranslation/gt/commit/5547cb436b7703b42dab5548137af5059ca3fd37"
        },
        "date": 1773880503819,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.035517968532461065,
            "range": "±0.0317",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2114474955602532,
            "range": "±0.0659",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.40297670507654965,
            "range": "±0.0781",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4034844895161339,
            "range": "±0.0829",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 231.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 266.6000000000349,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 379.4000000000233,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 149,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 19,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 30.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 138.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 587,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.199999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 127.89999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.0\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "0488ba28e8c31af187a1daeb06008578d3688e43",
          "message": "[ci] release (#1130)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-react@10.15.0\n\n### Minor Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   @generaltranslation/supported-locales@2.0.52\n    -   @generaltranslation/react-core@1.6.1\n    -   generaltranslation@8.1.19\n    -   gt-i18n@0.7.1\n\n## gt@2.11.1\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281),\n[`84c1443`](https://github.com/generaltranslation/gt/commit/84c1443bda85ccbd8d8dbf56ede341de974db522)]:\n    -   @generaltranslation/python-extractor@0.1.5\n    -   generaltranslation@8.1.19\n\n## @generaltranslation/compiler@1.1.31\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   generaltranslation@8.1.19\n\n## generaltranslation@8.1.19\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n## gtx-cli@2.11.1\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   gt@2.11.1\n\n## gt-i18n@0.7.1\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   @generaltranslation/supported-locales@2.0.52\n    -   generaltranslation@8.1.19\n\n## locadex@1.0.126\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   gt@2.11.1\n\n## gt-next@6.14.1\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   gt-react@10.15.0\n    -   @generaltranslation/supported-locales@2.0.52\n    -   @generaltranslation/compiler@1.1.31\n    -   generaltranslation@8.1.19\n    -   gt-i18n@0.7.1\n\n## @generaltranslation/gt-next-lint@12.0.1\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   gt-next@6.14.1\n\n## gt-node@0.4.1\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   generaltranslation@8.1.19\n    -   gt-i18n@0.7.1\n\n## @generaltranslation/python-extractor@0.1.5\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- [#1127](https://github.com/generaltranslation/gt/pull/1127)\n[`84c1443`](https://github.com/generaltranslation/gt/commit/84c1443bda85ccbd8d8dbf56ede341de974db522)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add\nsupport for `derive()` as the primary function name (replacing\n`declare_static()`). `declare_static()` remains supported for backwards\ncompatibility.\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   generaltranslation@8.1.19\n\n## @generaltranslation/react-core@1.6.1\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   @generaltranslation/supported-locales@2.0.52\n    -   generaltranslation@8.1.19\n    -   gt-i18n@0.7.1\n\n## gt-sanity@1.1.26\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   generaltranslation@8.1.19\n\n## @generaltranslation/supported-locales@2.0.52\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   generaltranslation@8.1.19\n\n## gt-tanstack-start@0.2.1\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   gt-react@10.15.0\n    -   @generaltranslation/react-core@1.6.1\n    -   generaltranslation@8.1.19\n    -   gt-i18n@0.7.1\n\n## gt-next-middleware-e2e@0.1.13\n\n### Patch Changes\n\n- [#1129](https://github.com/generaltranslation/gt/pull/1129)\n[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat:\nderivation support for the t macro\n\n- Updated dependencies\n\\[[`aabe764`](https://github.com/generaltranslation/gt/commit/aabe76422bfbba80ed3453667f82f01b1a195281)]:\n    -   gt-next@6.14.1\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-19T02:29:26Z",
          "url": "https://github.com/generaltranslation/gt/commit/0488ba28e8c31af187a1daeb06008578d3688e43"
        },
        "date": 1773887879012,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04013333341359745,
            "range": "±0.0151",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.25189086347606693,
            "range": "±0.0554",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.45189267299006364,
            "range": "±0.0826",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.435947196163913,
            "range": "±0.0518",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 235.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 271.4000000000233,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 375.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 150,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 141.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 586,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 130.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.1\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "906c8e8cdb407782d0b6a13541f1dac3c4673049",
          "message": "[ci] release (#1131)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.11.2\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- [#1132](https://github.com/generaltranslation/gt/pull/1132)\n[`a83a130`](https://github.com/generaltranslation/gt/commit/a83a130944193ec4b9784fb7687808936e175d19)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Make\nCDN unpublish behavior opt-in\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   generaltranslation@8.1.20\n    -   gt-remark@1.0.6\n    -   @generaltranslation/python-extractor@0.1.6\n\n## @generaltranslation/compiler@1.1.32\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   generaltranslation@8.1.20\n\n## generaltranslation@8.1.20\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n## gtx-cli@2.11.2\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8),\n[`a83a130`](https://github.com/generaltranslation/gt/commit/a83a130944193ec4b9784fb7687808936e175d19)]:\n    -   gt@2.11.2\n\n## gt-i18n@0.7.2\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   generaltranslation@8.1.20\n    -   @generaltranslation/supported-locales@2.0.53\n\n## locadex@1.0.127\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8),\n[`a83a130`](https://github.com/generaltranslation/gt/commit/a83a130944193ec4b9784fb7687808936e175d19)]:\n    -   gt@2.11.2\n\n## @generaltranslation/mcp@1.0.6\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n## gt-next@6.14.2\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   @generaltranslation/compiler@1.1.32\n    -   generaltranslation@8.1.20\n    -   gt-i18n@0.7.2\n    -   @generaltranslation/next-internal@0.1.1\n    -   gt-react@10.15.1\n    -   @generaltranslation/supported-locales@2.0.53\n\n## @generaltranslation/next-internal@0.1.1\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n## @generaltranslation/gt-next-lint@12.0.2\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   gt-next@6.14.2\n\n## gt-node@0.4.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   generaltranslation@8.1.20\n    -   gt-i18n@0.7.2\n\n## @generaltranslation/python-extractor@0.1.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   generaltranslation@8.1.20\n\n## gt-react@10.15.1\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   generaltranslation@8.1.20\n    -   gt-i18n@0.7.2\n    -   @generaltranslation/react-core@1.6.2\n    -   @generaltranslation/supported-locales@2.0.53\n\n## @generaltranslation/react-core@1.6.2\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   generaltranslation@8.1.20\n    -   gt-i18n@0.7.2\n    -   @generaltranslation/supported-locales@2.0.53\n\n## @generaltranslation/react-core-linter@0.1.5\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n## gt-remark@1.0.6\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n## gt-sanity@1.1.27\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   generaltranslation@8.1.20\n\n## @generaltranslation/supported-locales@2.0.53\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   generaltranslation@8.1.20\n\n## gt-tanstack-start@0.2.2\n\n### Patch Changes\n\n- [#1125](https://github.com/generaltranslation/gt/pull/1125)\n[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix logo\nURLs in README files (updated to `/brand/gt-logo-*.svg`)\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   generaltranslation@8.1.20\n    -   gt-i18n@0.7.2\n    -   @generaltranslation/react-core@1.6.2\n    -   gt-react@10.15.1\n\n## gt-next-middleware-e2e@0.1.14\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c3f8a78`](https://github.com/generaltranslation/gt/commit/c3f8a782f692fd69998a44b8116a3adfab6ea7c8)]:\n    -   gt-next@6.14.2\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-19T04:23:34Z",
          "url": "https://github.com/generaltranslation/gt/commit/906c8e8cdb407782d0b6a13541f1dac3c4673049"
        },
        "date": 1773894738492,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.040491842983237034,
            "range": "±0.0185",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2526547746336526,
            "range": "±0.067",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.44405998134990826,
            "range": "±0.0656",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4378948800350283,
            "range": "±0.0616",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 224.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 235.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 355.3999999999942,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 177,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 22.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 43.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 169.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 587,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.700000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 133.60000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.2\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "627e027bcfd86b676b3a975fa99c2db265bf2071",
          "message": "[ci] release (#1138)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-i18n@0.7.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`881edc4`](https://github.com/generaltranslation/gt/commit/881edc4ccb5c9685c137da98aa5123b0e645686c)]:\n    -   @generaltranslation/supported-locales@2.0.54\n\n## gt-next@6.14.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`881edc4`](https://github.com/generaltranslation/gt/commit/881edc4ccb5c9685c137da98aa5123b0e645686c)]:\n    -   @generaltranslation/supported-locales@2.0.54\n    -   gt-i18n@0.7.3\n    -   gt-react@10.15.2\n\n## @generaltranslation/gt-next-lint@12.0.3\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.14.3\n\n## gt-node@0.4.3\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-i18n@0.7.3\n\n## gt-react@10.15.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`881edc4`](https://github.com/generaltranslation/gt/commit/881edc4ccb5c9685c137da98aa5123b0e645686c)]:\n    -   @generaltranslation/supported-locales@2.0.54\n    -   gt-i18n@0.7.3\n    -   @generaltranslation/react-core@1.6.3\n\n## @generaltranslation/react-core@1.6.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`881edc4`](https://github.com/generaltranslation/gt/commit/881edc4ccb5c9685c137da98aa5123b0e645686c)]:\n    -   @generaltranslation/supported-locales@2.0.54\n    -   gt-i18n@0.7.3\n\n## @generaltranslation/supported-locales@2.0.54\n\n### Patch Changes\n\n- [#1136](https://github.com/generaltranslation/gt/pull/1136)\n[`881edc4`](https://github.com/generaltranslation/gt/commit/881edc4ccb5c9685c137da98aa5123b0e645686c)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding\nha, ig, yo\n\n## gt-tanstack-start@0.2.3\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-i18n@0.7.3\n    -   gt-react@10.15.2\n    -   @generaltranslation/react-core@1.6.3\n\n## gt-next-middleware-e2e@0.1.15\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.14.3\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-19T20:35:01Z",
          "url": "https://github.com/generaltranslation/gt/commit/627e027bcfd86b676b3a975fa99c2db265bf2071"
        },
        "date": 1773952966803,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04034695182764478,
            "range": "±0.0157",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24863434908006016,
            "range": "±0.0625",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4495917053009858,
            "range": "±0.0793",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4301461788478058,
            "range": "±0.0466",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 230.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 247.19999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 361.3999999999942,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 153,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 144.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 579,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 12,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 133.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.3\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "8e5f376cc18abf5f9ca23af53c7c21be0b645ee3",
          "message": "[ci] release (#1143)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.12.1\n\n### Patch Changes\n\n- [#1140](https://github.com/generaltranslation/gt/pull/1140)\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding\nstaged status to `gt-lock.json`, adding `useLatestAvailableVersion` flag\nto core download\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n    -   @generaltranslation/python-extractor@0.2.1\n\n## @generaltranslation/compiler@1.1.33\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n\n## generaltranslation@8.1.21\n\n### Patch Changes\n\n- [#1142](https://github.com/generaltranslation/gt/pull/1142)\n[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e)\nThanks [@brian-lou](https://github.com/brian-lou)! - Add new helper\nawaitJobs() function\n\n- [#1140](https://github.com/generaltranslation/gt/pull/1140)\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding\nstaged status to `gt-lock.json`, adding `useLatestAvailableVersion` flag\nto core download\n\n## gtx-cli@2.12.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   gt@2.12.1\n\n## gt-i18n@0.7.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n    -   @generaltranslation/supported-locales@2.0.55\n\n## locadex@1.0.130\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   gt@2.12.1\n\n## gt-next@6.14.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n    -   @generaltranslation/compiler@1.1.33\n    -   gt-i18n@0.7.4\n    -   gt-react@10.15.3\n    -   @generaltranslation/supported-locales@2.0.55\n\n## @generaltranslation/gt-next-lint@12.0.4\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.14.4\n\n## gt-node@0.4.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n    -   gt-i18n@0.7.4\n\n## @generaltranslation/python-extractor@0.2.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n\n## gt-react@10.15.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n    -   gt-i18n@0.7.4\n    -   @generaltranslation/react-core@1.6.4\n    -   @generaltranslation/supported-locales@2.0.55\n\n## @generaltranslation/react-core@1.6.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n    -   gt-i18n@0.7.4\n    -   @generaltranslation/supported-locales@2.0.55\n\n## gt-sanity@1.1.28\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n\n## @generaltranslation/supported-locales@2.0.55\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n\n## gt-tanstack-start@0.2.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d688831`](https://github.com/generaltranslation/gt/commit/d688831d124f9719357100a93e5a7c37729e751e),\n[`46e089c`](https://github.com/generaltranslation/gt/commit/46e089c63725acc2c478a4c1965bebd6f2d2cc0e)]:\n    -   generaltranslation@8.1.21\n    -   gt-i18n@0.7.4\n    -   gt-react@10.15.3\n    -   @generaltranslation/react-core@1.6.4\n\n## gt-next-middleware-e2e@0.1.16\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.14.4\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-20T23:51:53Z",
          "url": "https://github.com/generaltranslation/gt/commit/8e5f376cc18abf5f9ca23af53c7c21be0b645ee3"
        },
        "date": 1774051215471,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03845734894631655,
            "range": "±0.0142",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24667059842131392,
            "range": "±0.0616",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.44977252607913704,
            "range": "±0.0762",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.43084658914729135,
            "range": "±0.0425",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 234.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 263.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 371.0999999999767,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 148,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.400000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 139.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 583,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.199999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.199999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 129.69999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.4\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "afefcbbcae8119704348de368a1faf54f80b1e8e",
          "message": "[ci] release (#1144)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.13.0\n\n### Minor Changes\n\n- [#1141](https://github.com/generaltranslation/gt/pull/1141)\n[`4820643`](https://github.com/generaltranslation/gt/commit/4820643665d5aecacc34c52707c0c81bf4da18ca)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: auto\nderive for the t() function\n\n## @generaltranslation/compiler@1.1.34\n\n### Patch Changes\n\n- [#1141](https://github.com/generaltranslation/gt/pull/1141)\n[`4820643`](https://github.com/generaltranslation/gt/commit/4820643665d5aecacc34c52707c0c81bf4da18ca)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: auto\nderive for the t() function\n\n## gtx-cli@2.13.0\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`4820643`](https://github.com/generaltranslation/gt/commit/4820643665d5aecacc34c52707c0c81bf4da18ca)]:\n    -   gt@2.13.0\n\n## locadex@1.0.131\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`4820643`](https://github.com/generaltranslation/gt/commit/4820643665d5aecacc34c52707c0c81bf4da18ca)]:\n    -   gt@2.13.0\n\n## gt-next@6.14.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`4820643`](https://github.com/generaltranslation/gt/commit/4820643665d5aecacc34c52707c0c81bf4da18ca)]:\n    -   @generaltranslation/compiler@1.1.34\n\n## @generaltranslation/gt-next-lint@12.0.5\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.14.5\n\n## gt-next-middleware-e2e@0.1.17\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.14.5\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-21T02:19:39Z",
          "url": "https://github.com/generaltranslation/gt/commit/afefcbbcae8119704348de368a1faf54f80b1e8e"
        },
        "date": 1774060011970,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04034244101984816,
            "range": "±0.0168",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24978995904095816,
            "range": "±0.0634",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4441449236234472,
            "range": "±0.0655",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.435639577526132,
            "range": "±0.0535",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 233.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 260,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 372.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 146,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 138.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 596,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 129.30000000001746,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.5\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "f78cbf2bab4f8343815909998cc6928def37a003",
          "message": "[ci] release (#1146)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.13.1\n\n### Patch Changes\n\n- [#1145](https://github.com/generaltranslation/gt/pull/1145)\n[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add string\ndatatype formatting\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n    -   @generaltranslation/python-extractor@0.2.2\n\n## @generaltranslation/compiler@1.1.35\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n\n## generaltranslation@8.1.22\n\n### Patch Changes\n\n- [#1145](https://github.com/generaltranslation/gt/pull/1145)\n[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add string\ndatatype formatting\n\n## gtx-cli@2.13.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   gt@2.13.1\n\n## gt-i18n@0.7.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n    -   @generaltranslation/supported-locales@2.0.56\n\n## locadex@1.0.132\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   gt@2.13.1\n\n## gt-next@6.14.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n    -   @generaltranslation/compiler@1.1.35\n    -   gt-i18n@0.7.5\n    -   gt-react@10.15.4\n    -   @generaltranslation/supported-locales@2.0.56\n\n## @generaltranslation/gt-next-lint@12.0.6\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.14.6\n\n## gt-node@0.4.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n    -   gt-i18n@0.7.5\n\n## @generaltranslation/python-extractor@0.2.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n\n## gt-react@10.15.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n    -   gt-i18n@0.7.5\n    -   @generaltranslation/react-core@1.6.5\n    -   @generaltranslation/supported-locales@2.0.56\n\n## @generaltranslation/react-core@1.6.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n    -   gt-i18n@0.7.5\n    -   @generaltranslation/supported-locales@2.0.56\n\n## gt-sanity@1.1.29\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n\n## @generaltranslation/supported-locales@2.0.56\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n\n## gt-tanstack-start@0.2.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`16521f8`](https://github.com/generaltranslation/gt/commit/16521f83be814ca75be7956b00fc644e60f72e8e)]:\n    -   generaltranslation@8.1.22\n    -   gt-i18n@0.7.5\n    -   gt-react@10.15.4\n    -   @generaltranslation/react-core@1.6.5\n\n## gt-next-middleware-e2e@0.1.18\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.14.6\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-23T20:32:19Z",
          "url": "https://github.com/generaltranslation/gt/commit/f78cbf2bab4f8343815909998cc6928def37a003"
        },
        "date": 1774298438666,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03072447099668164,
            "range": "±0.0128",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2117441841659646,
            "range": "±0.0554",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.3951305521327029,
            "range": "±0.0763",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.3836670023006187,
            "range": "±0.0642",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 229.69999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 257,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 373.79999999993015,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 148,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 16.79999999993015,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.699999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 139.79999999993015,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 586,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.70000000006985,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.20000000006985,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 130,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.6\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "f5b3b96683e6163224a0cf4092ee724cd02e3fff",
          "message": "[ci] release (#1149)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.13.2\n\n### Patch Changes\n\n- [#1147](https://github.com/generaltranslation/gt/pull/1147)\n[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add\nsupport for multiple format types\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   generaltranslation@8.1.23\n    -   @generaltranslation/python-extractor@0.2.3\n\n## @generaltranslation/compiler@1.1.36\n\n### Patch Changes\n\n- [#1147](https://github.com/generaltranslation/gt/pull/1147)\n[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add\nsupport for multiple format types\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   generaltranslation@8.1.23\n\n## generaltranslation@8.1.23\n\n### Patch Changes\n\n- [#1147](https://github.com/generaltranslation/gt/pull/1147)\n[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add\nsupport for multiple format types\n\n## gtx-cli@2.13.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   gt@2.13.2\n\n## gt-i18n@0.7.6\n\n### Patch Changes\n\n- [#1147](https://github.com/generaltranslation/gt/pull/1147)\n[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add\nsupport for multiple format types\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   generaltranslation@8.1.23\n    -   @generaltranslation/supported-locales@2.0.57\n\n## locadex@1.0.133\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   gt@2.13.2\n\n## gt-next@6.14.7\n\n### Patch Changes\n\n- [#1147](https://github.com/generaltranslation/gt/pull/1147)\n[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add\nsupport for multiple format types\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   @generaltranslation/compiler@1.1.36\n    -   generaltranslation@8.1.23\n    -   gt-i18n@0.7.6\n    -   gt-react@10.15.5\n    -   @generaltranslation/supported-locales@2.0.57\n\n## @generaltranslation/gt-next-lint@12.0.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   gt-next@6.14.7\n\n## gt-node@0.4.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   generaltranslation@8.1.23\n    -   gt-i18n@0.7.6\n\n## @generaltranslation/python-extractor@0.2.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   generaltranslation@8.1.23\n\n## gt-react@10.15.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   @generaltranslation/react-core@1.6.6\n    -   generaltranslation@8.1.23\n    -   gt-i18n@0.7.6\n    -   @generaltranslation/supported-locales@2.0.57\n\n## @generaltranslation/react-core@1.6.6\n\n### Patch Changes\n\n- [#1147](https://github.com/generaltranslation/gt/pull/1147)\n[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: add\nsupport for multiple format types\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   generaltranslation@8.1.23\n    -   gt-i18n@0.7.6\n    -   @generaltranslation/supported-locales@2.0.57\n\n## gt-sanity@1.1.30\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   generaltranslation@8.1.23\n\n## @generaltranslation/supported-locales@2.0.57\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   generaltranslation@8.1.23\n\n## gt-tanstack-start@0.2.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   @generaltranslation/react-core@1.6.6\n    -   generaltranslation@8.1.23\n    -   gt-i18n@0.7.6\n    -   gt-react@10.15.5\n\n## gt-next-middleware-e2e@0.1.19\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`d7d9b99`](https://github.com/generaltranslation/gt/commit/d7d9b9952f3a96dde2b89f206d47c491d503727f)]:\n    -   gt-next@6.14.7\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-25T04:38:00Z",
          "url": "https://github.com/generaltranslation/gt/commit/f5b3b96683e6163224a0cf4092ee724cd02e3fff"
        },
        "date": 1774413989532,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03909324902267321,
            "range": "±0.0148",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24774228380386365,
            "range": "±0.0639",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.43740200000000656,
            "range": "±0.0643",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4339493581960068,
            "range": "±0.0574",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 228,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 238.79999999993015,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 358.29999999993015,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 145,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 16.900000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.699999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 137.29999999993015,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 584,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 22.29999999993015,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 131,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.7\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "b68bba888562c262c540426d4fe194722eb565ac",
          "message": "[ci] release (#1155)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-i18n@0.7.7\n\n### Patch Changes\n\n- [#1154](https://github.com/generaltranslation/gt/pull/1154)\n[`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Restore\n`GTFunctionType` return type to `string`\n\n## gt-next@6.14.8\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04)]:\n    -   gt-i18n@0.7.7\n    -   gt-react@10.15.6\n\n## @generaltranslation/gt-next-lint@12.0.8\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.14.8\n\n## gt-node@0.4.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04)]:\n    -   gt-i18n@0.7.7\n\n## gt-react@10.15.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04)]:\n    -   gt-i18n@0.7.7\n    -   @generaltranslation/react-core@1.6.7\n\n## @generaltranslation/react-core@1.6.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04)]:\n    -   gt-i18n@0.7.7\n\n## gt-tanstack-start@0.2.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`10a0f2e`](https://github.com/generaltranslation/gt/commit/10a0f2ef28003c2767129ba8ba88a61f8d6c3f04)]:\n    -   gt-i18n@0.7.7\n    -   gt-react@10.15.6\n    -   @generaltranslation/react-core@1.6.7\n\n## gt-next-middleware-e2e@0.1.20\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.14.8\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-03-26T23:03:23Z",
          "url": "https://github.com/generaltranslation/gt/commit/b68bba888562c262c540426d4fe194722eb565ac"
        },
        "date": 1774566686524,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04071174173587349,
            "range": "±0.0173",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2528027598584427,
            "range": "±0.0689",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.45283413574660497,
            "range": "±0.0792",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4350096034782647,
            "range": "±0.0513",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 235.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 246,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 384.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 151,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 19.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 34.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 142.10000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 585,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.699999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 131.89999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.14.8\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "0a4b73f0ec595300aea0cf53331cb9b8abb2bfd7",
          "message": "[ci] release (#1159)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.0\n\n### Minor Changes\n\n- [#1153](https://github.com/generaltranslation/gt/pull/1153)\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add\n`<RelativeTime>` component for localized relative time formatting\n    -   New `<RelativeTime>` component with two usage modes:\n- Auto-select unit from a Date:\n`<RelativeTime>{someDate}</RelativeTime>` → \"2 hours ago\"\n- Explicit value + unit: `<RelativeTime value={-1} unit=\"day\" />` →\n\"yesterday\"\n- Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds\n→ minutes → hours → days → weeks → months → years)\n- Core: `formatRelativeTimeFromDate()` standalone function and\n`GT.formatRelativeTimeFromDate()` class method\n    -   Week unit included in auto-selection thresholds (7-27 days)\n- CLI, compiler, and SWC plugin updated to recognize `RelativeTime` as a\nvariable component\n\n### Patch Changes\n\n- [#1160](https://github.com/generaltranslation/gt/pull/1160)\n[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding\ntranslation tagging\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n    -   @generaltranslation/python-extractor@0.2.4\n\n## @generaltranslation/compiler@1.2.0\n\n### Minor Changes\n\n- [#1153](https://github.com/generaltranslation/gt/pull/1153)\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add\n`<RelativeTime>` component for localized relative time formatting\n    -   New `<RelativeTime>` component with two usage modes:\n- Auto-select unit from a Date:\n`<RelativeTime>{someDate}</RelativeTime>` → \"2 hours ago\"\n- Explicit value + unit: `<RelativeTime value={-1} unit=\"day\" />` →\n\"yesterday\"\n- Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds\n→ minutes → hours → days → weeks → months → years)\n- Core: `formatRelativeTimeFromDate()` standalone function and\n`GT.formatRelativeTimeFromDate()` class method\n    -   Week unit included in auto-selection thresholds (7-27 days)\n- CLI, compiler, and SWC plugin updated to recognize `RelativeTime` as a\nvariable component\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n\n## generaltranslation@8.2.0\n\n### Minor Changes\n\n- [#1153](https://github.com/generaltranslation/gt/pull/1153)\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add\n`<RelativeTime>` component for localized relative time formatting\n    -   New `<RelativeTime>` component with two usage modes:\n- Auto-select unit from a Date:\n`<RelativeTime>{someDate}</RelativeTime>` → \"2 hours ago\"\n- Explicit value + unit: `<RelativeTime value={-1} unit=\"day\" />` →\n\"yesterday\"\n- Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds\n→ minutes → hours → days → weeks → months → years)\n- Core: `formatRelativeTimeFromDate()` standalone function and\n`GT.formatRelativeTimeFromDate()` class method\n    -   Week unit included in auto-selection thresholds (7-27 days)\n- CLI, compiler, and SWC plugin updated to recognize `RelativeTime` as a\nvariable component\n\n### Patch Changes\n\n- [#1160](https://github.com/generaltranslation/gt/pull/1160)\n[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Adding\ntranslation tagging\n\n## gt-next@6.15.0\n\n### Minor Changes\n\n- [#1153](https://github.com/generaltranslation/gt/pull/1153)\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add\n`<RelativeTime>` component for localized relative time formatting\n    -   New `<RelativeTime>` component with two usage modes:\n- Auto-select unit from a Date:\n`<RelativeTime>{someDate}</RelativeTime>` → \"2 hours ago\"\n- Explicit value + unit: `<RelativeTime value={-1} unit=\"day\" />` →\n\"yesterday\"\n- Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds\n→ minutes → hours → days → weeks → months → years)\n- Core: `formatRelativeTimeFromDate()` standalone function and\n`GT.formatRelativeTimeFromDate()` class method\n    -   Week unit included in auto-selection thresholds (7-27 days)\n- CLI, compiler, and SWC plugin updated to recognize `RelativeTime` as a\nvariable component\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n    -   gt-react@10.16.0\n    -   @generaltranslation/compiler@1.2.0\n    -   gt-i18n@0.7.8\n    -   @generaltranslation/supported-locales@2.0.58\n\n## gt-react@10.16.0\n\n### Minor Changes\n\n- [#1153](https://github.com/generaltranslation/gt/pull/1153)\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add\n`<RelativeTime>` component for localized relative time formatting\n    -   New `<RelativeTime>` component with two usage modes:\n- Auto-select unit from a Date:\n`<RelativeTime>{someDate}</RelativeTime>` → \"2 hours ago\"\n- Explicit value + unit: `<RelativeTime value={-1} unit=\"day\" />` →\n\"yesterday\"\n- Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds\n→ minutes → hours → days → weeks → months → years)\n- Core: `formatRelativeTimeFromDate()` standalone function and\n`GT.formatRelativeTimeFromDate()` class method\n    -   Week unit included in auto-selection thresholds (7-27 days)\n- CLI, compiler, and SWC plugin updated to recognize `RelativeTime` as a\nvariable component\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n    -   @generaltranslation/react-core@1.7.0\n    -   gt-i18n@0.7.8\n    -   @generaltranslation/supported-locales@2.0.58\n\n## @generaltranslation/react-core@1.7.0\n\n### Minor Changes\n\n- [#1153](https://github.com/generaltranslation/gt/pull/1153)\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add\n`<RelativeTime>` component for localized relative time formatting\n    -   New `<RelativeTime>` component with two usage modes:\n- Auto-select unit from a Date:\n`<RelativeTime>{someDate}</RelativeTime>` → \"2 hours ago\"\n- Explicit value + unit: `<RelativeTime value={-1} unit=\"day\" />` →\n\"yesterday\"\n- Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds\n→ minutes → hours → days → weeks → months → years)\n- Core: `formatRelativeTimeFromDate()` standalone function and\n`GT.formatRelativeTimeFromDate()` class method\n    -   Week unit included in auto-selection thresholds (7-27 days)\n- CLI, compiler, and SWC plugin updated to recognize `RelativeTime` as a\nvariable component\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n    -   gt-i18n@0.7.8\n    -   @generaltranslation/supported-locales@2.0.58\n\n## gt-tanstack-start@0.3.0\n\n### Minor Changes\n\n- [#1153](https://github.com/generaltranslation/gt/pull/1153)\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Add\n`<RelativeTime>` component for localized relative time formatting\n    -   New `<RelativeTime>` component with two usage modes:\n- Auto-select unit from a Date:\n`<RelativeTime>{someDate}</RelativeTime>` → \"2 hours ago\"\n- Explicit value + unit: `<RelativeTime value={-1} unit=\"day\" />` →\n\"yesterday\"\n- Core: `_selectRelativeTimeUnit()` auto-selects the best unit (seconds\n→ minutes → hours → days → weeks → months → years)\n- Core: `formatRelativeTimeFromDate()` standalone function and\n`GT.formatRelativeTimeFromDate()` class method\n    -   Week unit included in auto-selection thresholds (7-27 days)\n- CLI, compiler, and SWC plugin updated to recognize `RelativeTime` as a\nvariable component\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n    -   @generaltranslation/react-core@1.7.0\n    -   gt-react@10.16.0\n    -   gt-i18n@0.7.8\n\n## gtx-cli@2.14.0\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   gt@2.14.0\n\n## gt-i18n@0.7.8\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n    -   @generaltranslation/supported-locales@2.0.58\n\n## locadex@1.0.135\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   gt@2.14.0\n\n## @generaltranslation/gt-next-lint@13.0.0\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   gt-next@6.15.0\n\n## gt-node@0.4.8\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n    -   gt-i18n@0.7.8\n\n## @generaltranslation/python-extractor@0.2.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n\n## gt-sanity@1.1.31\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n\n## @generaltranslation/supported-locales@2.0.58\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9d2349c`](https://github.com/generaltranslation/gt/commit/9d2349cfc41862d9e3d8364659b678055b9fa290),\n[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   generaltranslation@8.2.0\n\n## gt-next-middleware-e2e@0.1.21\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`df6bea8`](https://github.com/generaltranslation/gt/commit/df6bea819a4274018d6d99c7d3e00e7c5372ccbc)]:\n    -   gt-next@6.15.0\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-01T03:47:46Z",
          "url": "https://github.com/generaltranslation/gt/commit/0a4b73f0ec595300aea0cf53331cb9b8abb2bfd7"
        },
        "date": 1775015780230,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.039190200172426734,
            "range": "±0.0145",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2434723188899716,
            "range": "±0.0575",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4474337515639017,
            "range": "±0.073",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.42980283762886806,
            "range": "±0.0366",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 229.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 239.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 359.3999999999942,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 146,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 16.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 25.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 138.60000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 592,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.300000000017462,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 131.60000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.0\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "a74065ba4e3389cebec86182700d171712e42c47",
          "message": "[ci] release (#1167)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.2\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   gt-remark@1.0.7\n    -   generaltranslation@8.2.1\n    -   @generaltranslation/python-extractor@0.2.5\n\n## @generaltranslation/compiler@1.2.1\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   generaltranslation@8.2.1\n\n## generaltranslation@8.2.1\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n## gtx-cli@2.14.2\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   gt@2.14.2\n\n## gt-i18n@0.7.9\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   generaltranslation@8.2.1\n    -   @generaltranslation/supported-locales@2.0.59\n\n## locadex@1.0.137\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   gt@2.14.2\n\n## @generaltranslation/mcp@1.0.7\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n## gt-next@6.15.1\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   gt-react@10.16.1\n    -   gt-i18n@0.7.9\n    -   generaltranslation@8.2.1\n    -   @generaltranslation/compiler@1.2.1\n    -   @generaltranslation/next-internal@0.1.2\n    -   @generaltranslation/supported-locales@2.0.59\n\n## @generaltranslation/next-internal@0.1.2\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n## @generaltranslation/gt-next-lint@13.0.1\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   gt-next@6.15.1\n\n## gt-node@0.4.9\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   gt-i18n@0.7.9\n    -   generaltranslation@8.2.1\n\n## @generaltranslation/python-extractor@0.2.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   generaltranslation@8.2.1\n\n## gt-react@10.16.1\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   gt-i18n@0.7.9\n    -   generaltranslation@8.2.1\n    -   @generaltranslation/react-core@1.7.1\n    -   @generaltranslation/supported-locales@2.0.59\n\n## @generaltranslation/react-core@1.7.1\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   gt-i18n@0.7.9\n    -   generaltranslation@8.2.1\n    -   @generaltranslation/supported-locales@2.0.59\n\n## @generaltranslation/react-core-linter@0.1.6\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n## gt-remark@1.0.7\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n## gt-sanity@2.0.1\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   generaltranslation@8.2.1\n\n## @generaltranslation/supported-locales@2.0.59\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   generaltranslation@8.2.1\n\n## gt-tanstack-start@0.3.1\n\n### Patch Changes\n\n- [#1161](https://github.com/generaltranslation/gt/pull/1161)\n[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Update\nlogo blocks in READMEs\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   gt-react@10.16.1\n    -   gt-i18n@0.7.9\n    -   generaltranslation@8.2.1\n    -   @generaltranslation/react-core@1.7.1\n\n## gt-next-middleware-e2e@0.1.22\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`eca3d8d`](https://github.com/generaltranslation/gt/commit/eca3d8d8298969258bb4ab576b698c48cfbc318f)]:\n    -   gt-next@6.15.1\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-02T20:41:52Z",
          "url": "https://github.com/generaltranslation/gt/commit/a74065ba4e3389cebec86182700d171712e42c47"
        },
        "date": 1775163031241,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.040324135403225825,
            "range": "±0.0169",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2502267158579309,
            "range": "±0.0603",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.44477220355555963,
            "range": "±0.0628",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.43240352117546577,
            "range": "±0.0439",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 233.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 252,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 380.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 156,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 148,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 588,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.400000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 134,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.1\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "24e4cdd3656f330fc05686c5094547d1eb264a2d",
          "message": "[ci] release (#1170)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## @generaltranslation/compiler@1.3.0\n\n### Minor Changes\n\n- [#1158](https://github.com/generaltranslation/gt/pull/1158)\n[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto\ninjection for jsx translation\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   generaltranslation@8.2.2\n\n## gt-react@10.17.0\n\n### Minor Changes\n\n- [#1158](https://github.com/generaltranslation/gt/pull/1158)\n[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto\ninjection for jsx translation\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   @generaltranslation/supported-locales@2.0.60\n    -   @generaltranslation/react-core@1.7.2\n    -   generaltranslation@8.2.2\n    -   gt-i18n@0.7.10\n\n## gt@2.14.4\n\n### Patch Changes\n\n- [#1158](https://github.com/generaltranslation/gt/pull/1158)\n[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto\ninjection for jsx translation\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   generaltranslation@8.2.2\n    -   @generaltranslation/python-extractor@0.2.6\n\n## generaltranslation@8.2.2\n\n### Patch Changes\n\n- [#1158](https://github.com/generaltranslation/gt/pull/1158)\n[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto\ninjection for jsx translation\n\n## gtx-cli@2.14.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   gt@2.14.4\n\n## gt-i18n@0.7.10\n\n### Patch Changes\n\n- [#1158](https://github.com/generaltranslation/gt/pull/1158)\n[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto\ninjection for jsx translation\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   @generaltranslation/supported-locales@2.0.60\n    -   generaltranslation@8.2.2\n\n## locadex@1.0.139\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   gt@2.14.4\n\n## gt-next@6.15.2\n\n### Patch Changes\n\n- [#1158](https://github.com/generaltranslation/gt/pull/1158)\n[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto\ninjection for jsx translation\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   gt-react@10.17.0\n    -   @generaltranslation/supported-locales@2.0.60\n    -   @generaltranslation/compiler@1.3.0\n    -   generaltranslation@8.2.2\n    -   gt-i18n@0.7.10\n\n## @generaltranslation/gt-next-lint@13.0.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   gt-next@6.15.2\n\n## gt-node@0.4.10\n\n### Patch Changes\n\n- [#1158](https://github.com/generaltranslation/gt/pull/1158)\n[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto\ninjection for jsx translation\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   generaltranslation@8.2.2\n    -   gt-i18n@0.7.10\n\n## @generaltranslation/python-extractor@0.2.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   generaltranslation@8.2.2\n\n## @generaltranslation/react-core@1.7.2\n\n### Patch Changes\n\n- [#1158](https://github.com/generaltranslation/gt/pull/1158)\n[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto\ninjection for jsx translation\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   @generaltranslation/supported-locales@2.0.60\n    -   generaltranslation@8.2.2\n    -   gt-i18n@0.7.10\n\n## gt-sanity@2.0.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   generaltranslation@8.2.2\n\n## @generaltranslation/supported-locales@2.0.60\n\n### Patch Changes\n\n- [#1158](https://github.com/generaltranslation/gt/pull/1158)\n[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto\ninjection for jsx translation\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   generaltranslation@8.2.2\n\n## gt-tanstack-start@0.3.2\n\n### Patch Changes\n\n- [#1158](https://github.com/generaltranslation/gt/pull/1158)\n[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add auto\ninjection for jsx translation\n\n- Updated dependencies\n\\[[`5b85ccd`](https://github.com/generaltranslation/gt/commit/5b85ccd80b93b91eae9c873b258a13b6a57443c8)]:\n    -   gt-react@10.17.0\n    -   @generaltranslation/react-core@1.7.2\n    -   generaltranslation@8.2.2\n    -   gt-i18n@0.7.10\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-04T01:53:58Z",
          "url": "https://github.com/generaltranslation/gt/commit/24e4cdd3656f330fc05686c5094547d1eb264a2d"
        },
        "date": 1775268285271,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.040967495370749576,
            "range": "±0.0234",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2636285893516053,
            "range": "±0.0773",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4622802412199642,
            "range": "±0.0814",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4496725863309253,
            "range": "±0.0592",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 243.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 285.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 401.0999999999767,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 162,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 152.89999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 592,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.700000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 22.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 149.89999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.15.2\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "4c7ab31f77783be6e0445e5ea36b78d3a3b28aa8",
          "message": "[ci] release (#1176)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-i18n@0.8.0\n\n### Minor Changes\n\n- [#1173](https://github.com/generaltranslation/gt/pull/1173)\n[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context\nderivation\n\n## gt-next@6.16.0\n\n### Minor Changes\n\n- [#1173](https://github.com/generaltranslation/gt/pull/1173)\n[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context\nderivation\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:\n    -   gt-i18n@0.8.0\n    -   gt-react@10.18.0\n    -   @generaltranslation/compiler@1.3.1\n\n## gt-node@0.5.0\n\n### Minor Changes\n\n- [#1173](https://github.com/generaltranslation/gt/pull/1173)\n[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context\nderivation\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:\n    -   gt-i18n@0.8.0\n\n## gt-react@10.18.0\n\n### Minor Changes\n\n- [#1173](https://github.com/generaltranslation/gt/pull/1173)\n[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context\nderivation\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:\n    -   gt-i18n@0.8.0\n    -   @generaltranslation/react-core@1.8.0\n\n## @generaltranslation/react-core@1.8.0\n\n### Minor Changes\n\n- [#1173](https://github.com/generaltranslation/gt/pull/1173)\n[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context\nderivation\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:\n    -   gt-i18n@0.8.0\n\n## gt-tanstack-start@0.4.0\n\n### Minor Changes\n\n- [#1173](https://github.com/generaltranslation/gt/pull/1173)\n[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context\nderivation\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:\n    -   gt-i18n@0.8.0\n    -   gt-react@10.18.0\n    -   @generaltranslation/react-core@1.8.0\n\n## gt@2.14.6\n\n### Patch Changes\n\n- [#1173](https://github.com/generaltranslation/gt/pull/1173)\n[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context\nderivation\n\n- Updated dependencies\n\\[[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:\n    -   @generaltranslation/python-extractor@0.2.7\n\n## @generaltranslation/compiler@1.3.1\n\n### Patch Changes\n\n- [#1173](https://github.com/generaltranslation/gt/pull/1173)\n[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context\nderivation\n\n## gtx-cli@2.14.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:\n    -   gt@2.14.6\n\n## locadex@1.0.141\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:\n    -   gt@2.14.6\n\n## @generaltranslation/gt-next-lint@14.0.0\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)]:\n    -   gt-next@6.16.0\n\n## @generaltranslation/python-extractor@0.2.7\n\n### Patch Changes\n\n- [#1173](https://github.com/generaltranslation/gt/pull/1173)\n[`6b0b56b`](https://github.com/generaltranslation/gt/commit/6b0b56b2253e389913fe67eb19f0ba6ebf2c7a53)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - add context\nderivation\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-07T03:15:50Z",
          "url": "https://github.com/generaltranslation/gt/commit/4c7ab31f77783be6e0445e5ea36b78d3a3b28aa8"
        },
        "date": 1775532235347,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04023258577405845,
            "range": "±0.0222",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2507030516290733,
            "range": "±0.0636",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4526880090497761,
            "range": "±0.0699",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.43889898684209816,
            "range": "±0.0484",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 238.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 276.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 387.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 160,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 19.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 150.10000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 587,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.200000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.900000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 134.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.0\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "d4f5092d5d41a576de2ff87c1aaf46e689d448ee",
          "message": "[ci] release (#1181)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## @generaltranslation/compiler@1.3.2\n\n### Patch Changes\n\n- [#1182](https://github.com/generaltranslation/gt/pull/1182)\n[`80fe63f`](https://github.com/generaltranslation/gt/commit/80fe63fa349f8ece0871ba455f16dae614327fdd)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: handle\nmember expressions without throwing errors\n\n## gtx-cli@2.14.7\n\n### Patch Changes\n\n- [#1179](https://github.com/generaltranslation/gt/pull/1179)\n[`8db46eb`](https://github.com/generaltranslation/gt/commit/8db46ebc61932c42d0ab08e4846ff625f71b3d35)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fixed\nsetup wizard to not prefix GT_API_KEY with framework-specific prefixes\n(VITE_, NEXT_PUBLIC_, etc.) since production API keys should never be\nexposed to the client bundle.\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.7\n\n## locadex@1.0.142\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.7\n\n## gt-next@6.16.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`80fe63f`](https://github.com/generaltranslation/gt/commit/80fe63fa349f8ece0871ba455f16dae614327fdd)]:\n    -   @generaltranslation/compiler@1.3.2\n\n## @generaltranslation/gt-next-lint@14.0.1\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.1\n\n## gt@2.14.7\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-07T21:30:52Z",
          "url": "https://github.com/generaltranslation/gt/commit/d4f5092d5d41a576de2ff87c1aaf46e689d448ee"
        },
        "date": 1775597915234,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.040008969195072165,
            "range": "±0.0141",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2557939294117658,
            "range": "±0.0655",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.44641812578055495,
            "range": "±0.0532",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4396433374340975,
            "range": "±0.0422",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 225.60000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 235.30000000004657,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 357,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 156,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 23.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 48.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 148.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 592,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.199999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 134.09999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.1\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "eb9901380c72d59ebd5f292fc3214a514f6f8efe",
          "message": "[ci] release (#1184)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.8\n\n### Patch Changes\n\n- [#1187](https://github.com/generaltranslation/gt/pull/1187)\n[`9281fe5`](https://github.com/generaltranslation/gt/commit/9281fe5d9c2f3e35b67ccedb9c444aebbb6a8bd1)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix(cli):\nextend autoderive gt msg\n\n- [#1185](https://github.com/generaltranslation/gt/pull/1185)\n[`121be24`](https://github.com/generaltranslation/gt/commit/121be24def7f9dc464b8589bf0be14d04ac3e6e1)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix:\nexploration of properties for Branch and Plural during multiplication\nstep\n\n- [#1186](https://github.com/generaltranslation/gt/pull/1186)\n[`7a3c7de`](https://github.com/generaltranslation/gt/commit/7a3c7de8e5d5103bd9fec893a677a13068f822e6)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Warn when\nMintlify docs.json contains unsupported $ref fields\n\n## @generaltranslation/compiler@1.3.3\n\n### Patch Changes\n\n- [#1188](https://github.com/generaltranslation/gt/pull/1188)\n[`a76a386`](https://github.com/generaltranslation/gt/commit/a76a38624a2defbfd8d0540ccb74bb264079f61a)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix(compiler):\nextend autoderive gt msg\n\n## gtx-cli@2.14.8\n\n### Patch Changes\n\n- [#1180](https://github.com/generaltranslation/gt/pull/1180)\n[`04c142e`](https://github.com/generaltranslation/gt/commit/04c142e0a45ba1a433c53bcb6dab08bb6e5658b1)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Changed\ndefault translation output directory for Vite projects from\n`./public/_gt` to `./src/_gt` in the setup wizard.\n\n- Updated dependencies\n\\[[`9281fe5`](https://github.com/generaltranslation/gt/commit/9281fe5d9c2f3e35b67ccedb9c444aebbb6a8bd1),\n[`121be24`](https://github.com/generaltranslation/gt/commit/121be24def7f9dc464b8589bf0be14d04ac3e6e1),\n[`7a3c7de`](https://github.com/generaltranslation/gt/commit/7a3c7de8e5d5103bd9fec893a677a13068f822e6)]:\n    -   gt@2.14.8\n\n## locadex@1.0.143\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9281fe5`](https://github.com/generaltranslation/gt/commit/9281fe5d9c2f3e35b67ccedb9c444aebbb6a8bd1),\n[`121be24`](https://github.com/generaltranslation/gt/commit/121be24def7f9dc464b8589bf0be14d04ac3e6e1),\n[`7a3c7de`](https://github.com/generaltranslation/gt/commit/7a3c7de8e5d5103bd9fec893a677a13068f822e6)]:\n    -   gt@2.14.8\n\n## gt-next@6.16.2\n\n### Patch Changes\n\n- [#1189](https://github.com/generaltranslation/gt/pull/1189)\n[`7efceb8`](https://github.com/generaltranslation/gt/commit/7efceb83796f975eed9354b1e706853dd4e06aef)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat(swc):\nsupport autoDerive flag in SWC plugin to allow bare variables and\nfunction calls in gt() template literals and concatenations\n\n- Updated dependencies\n\\[[`a76a386`](https://github.com/generaltranslation/gt/commit/a76a38624a2defbfd8d0540ccb74bb264079f61a)]:\n    -   @generaltranslation/compiler@1.3.3\n\n## @generaltranslation/gt-next-lint@14.0.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`7efceb8`](https://github.com/generaltranslation/gt/commit/7efceb83796f975eed9354b1e706853dd4e06aef)]:\n    -   gt-next@6.16.2\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-09T03:03:56Z",
          "url": "https://github.com/generaltranslation/gt/commit/eb9901380c72d59ebd5f292fc3214a514f6f8efe"
        },
        "date": 1775704281296,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.031472737269465804,
            "range": "±0.0145",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.20944536850921452,
            "range": "±0.0516",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.3836187277607384,
            "range": "±0.0632",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.38039686235741293,
            "range": "±0.0611",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 225.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 258.6000000000349,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 373.4000000000233,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 156,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.399999999965075,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 147.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 583,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.799999999988358,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.899999999965075,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 143.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.2\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "dc7b0c71f1bea6dbdb475332c70132d1056ca971",
          "message": "[ci] release (#1197)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.10\n\n### Patch Changes\n\n- [#1195](https://github.com/generaltranslation/gt/pull/1195)\n[`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nstandardize naming convention for \"autoderive\"\n\n## @generaltranslation/compiler@1.3.4\n\n### Patch Changes\n\n- [#1195](https://github.com/generaltranslation/gt/pull/1195)\n[`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nstandardize naming convention for \"autoderive\"\n\n## gtx-cli@2.14.10\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6)]:\n    -   gt@2.14.10\n\n## locadex@1.0.145\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6)]:\n    -   gt@2.14.10\n\n## gt-next@6.16.3\n\n### Patch Changes\n\n- [#1195](https://github.com/generaltranslation/gt/pull/1195)\n[`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - refactor:\nstandardize naming convention for \"autoderive\"\n\n- Updated dependencies\n\\[[`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6)]:\n    -   @generaltranslation/compiler@1.3.4\n\n## @generaltranslation/gt-next-lint@14.0.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2090de3`](https://github.com/generaltranslation/gt/commit/2090de3613b9684fd43adc3b83f677bc33c1d9a6)]:\n    -   gt-next@6.16.3\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-09T19:36:12Z",
          "url": "https://github.com/generaltranslation/gt/commit/dc7b0c71f1bea6dbdb475332c70132d1056ca971"
        },
        "date": 1775763844107,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04149151481204914,
            "range": "±0.0189",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.25779147061855623,
            "range": "±0.0708",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.46460304921076545,
            "range": "±0.0898",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4508286765765722,
            "range": "±0.0641",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 227.90000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 237.90000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 355.80000000004657,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 155,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 146.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 591,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.399999999965075,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 144.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.3\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "c44d0a320d199bf4a0ff72b9bf31930290e73902",
          "message": "[ci] release (#1204)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.11\n\n### Patch Changes\n\n- [#1196](https://github.com/generaltranslation/gt/pull/1196)\n[`cf8bee6`](https://github.com/generaltranslation/gt/commit/cf8bee67159eeafccf22ac06861905b0a672f64a)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Fix CLI\nsilently creating `gt.config.json` when running commands like `gt stage`\nin directories without a config file. Commands that require a config now\nexit with a clear error message pointing users to `gt init`. Config\ncreation is only handled by the init/setup wizard.\n\n- [#1199](https://github.com/generaltranslation/gt/pull/1199)\n[`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: enable\nautoderive for jsx\n\n- [#1201](https://github.com/generaltranslation/gt/pull/1201)\n[`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore:\ncustomize autoderive\n\n## @generaltranslation/compiler@1.3.5\n\n### Patch Changes\n\n- [#1199](https://github.com/generaltranslation/gt/pull/1199)\n[`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: enable\nautoderive for jsx\n\n- [#1201](https://github.com/generaltranslation/gt/pull/1201)\n[`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore:\ncustomize autoderive\n\n## gtx-cli@2.14.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cf8bee6`](https://github.com/generaltranslation/gt/commit/cf8bee67159eeafccf22ac06861905b0a672f64a),\n[`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f),\n[`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437)]:\n    -   gt@2.14.11\n\n## locadex@1.0.146\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cf8bee6`](https://github.com/generaltranslation/gt/commit/cf8bee67159eeafccf22ac06861905b0a672f64a),\n[`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f),\n[`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437)]:\n    -   gt@2.14.11\n\n## gt-next@6.16.4\n\n### Patch Changes\n\n- [#1199](https://github.com/generaltranslation/gt/pull/1199)\n[`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: enable\nautoderive for jsx\n\n- [#1200](https://github.com/generaltranslation/gt/pull/1200)\n[`223fc66`](https://github.com/generaltranslation/gt/commit/223fc66506e7ec1dc4d6261d9003e6c377d4f5e5)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: spread\nderivation\n\n- [#1201](https://github.com/generaltranslation/gt/pull/1201)\n[`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore:\ncustomize autoderive\n\n- Updated dependencies\n\\[[`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f),\n[`0a1aef8`](https://github.com/generaltranslation/gt/commit/0a1aef8da966c4c02557dc834f1bc7c6822e55be),\n[`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437)]:\n    -   @generaltranslation/compiler@1.3.5\n    -   gt-react@10.18.1\n\n## @generaltranslation/gt-next-lint@14.0.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`1828cd4`](https://github.com/generaltranslation/gt/commit/1828cd4eafb1f3ea868b437b914c844670d2c50f),\n[`223fc66`](https://github.com/generaltranslation/gt/commit/223fc66506e7ec1dc4d6261d9003e6c377d4f5e5),\n[`fbb9d26`](https://github.com/generaltranslation/gt/commit/fbb9d268dbee58142e305b9076e44000205d5437)]:\n    -   gt-next@6.16.4\n\n## gt-react@10.18.1\n\n### Patch Changes\n\n- [#1202](https://github.com/generaltranslation/gt/pull/1202)\n[`0a1aef8`](https://github.com/generaltranslation/gt/commit/0a1aef8da966c4c02557dc834f1bc7c6822e55be)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: update\nhtml langtag for i18n-context\n\n- Updated dependencies\n\\[[`0a1aef8`](https://github.com/generaltranslation/gt/commit/0a1aef8da966c4c02557dc834f1bc7c6822e55be)]:\n    -   @generaltranslation/react-core@1.8.1\n\n## @generaltranslation/react-core@1.8.1\n\n### Patch Changes\n\n- [#1202](https://github.com/generaltranslation/gt/pull/1202)\n[`0a1aef8`](https://github.com/generaltranslation/gt/commit/0a1aef8da966c4c02557dc834f1bc7c6822e55be)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: update\nhtml langtag for i18n-context\n\n## gt-tanstack-start@0.4.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`0a1aef8`](https://github.com/generaltranslation/gt/commit/0a1aef8da966c4c02557dc834f1bc7c6822e55be)]:\n    -   @generaltranslation/react-core@1.8.1\n    -   gt-react@10.18.1\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-10T04:12:07Z",
          "url": "https://github.com/generaltranslation/gt/commit/c44d0a320d199bf4a0ff72b9bf31930290e73902"
        },
        "date": 1775794799020,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04034946021626829,
            "range": "±0.0158",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.26024101716961734,
            "range": "±0.0702",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4622415221811422,
            "range": "±0.0798",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4492919200359444,
            "range": "±0.058",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 242.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 263.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 395.3999999999942,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 151,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 36.09999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 141.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 583,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.200000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 138.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.4\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "0063b2b7656f1cdd5e5cca5ee51a6c5ed96aa4fe",
          "message": "[ci] release (#1212)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-node@0.6.0\n\n### Minor Changes\n\n- [#1207](https://github.com/generaltranslation/gt/pull/1207)\n[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime\ntranslation\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   generaltranslation@8.2.3\n    -   gt-i18n@0.8.1\n\n## gt@2.14.13\n\n### Patch Changes\n\n- [#1207](https://github.com/generaltranslation/gt/pull/1207)\n[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime\ntranslation\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   generaltranslation@8.2.3\n    -   @generaltranslation/python-extractor@0.2.8\n\n## @generaltranslation/compiler@1.3.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   generaltranslation@8.2.3\n\n## generaltranslation@8.2.3\n\n### Patch Changes\n\n- [#1207](https://github.com/generaltranslation/gt/pull/1207)\n[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime\ntranslation\n\n## gtx-cli@2.14.13\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   gt@2.14.13\n\n## gt-i18n@0.8.1\n\n### Patch Changes\n\n- [#1207](https://github.com/generaltranslation/gt/pull/1207)\n[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime\ntranslation\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   generaltranslation@8.2.3\n    -   @generaltranslation/supported-locales@2.0.61\n\n## locadex@1.0.148\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   gt@2.14.13\n\n## gt-next@6.16.5\n\n### Patch Changes\n\n- [#1207](https://github.com/generaltranslation/gt/pull/1207)\n[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime\ntranslation\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   gt-react@10.18.2\n    -   generaltranslation@8.2.3\n    -   gt-i18n@0.8.1\n    -   @generaltranslation/compiler@1.3.6\n    -   @generaltranslation/supported-locales@2.0.61\n\n## @generaltranslation/gt-next-lint@14.0.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   gt-next@6.16.5\n\n## @generaltranslation/python-extractor@0.2.8\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   generaltranslation@8.2.3\n\n## gt-react@10.18.2\n\n### Patch Changes\n\n- [#1207](https://github.com/generaltranslation/gt/pull/1207)\n[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime\ntranslation\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   generaltranslation@8.2.3\n    -   gt-i18n@0.8.1\n    -   @generaltranslation/react-core@1.8.2\n    -   @generaltranslation/supported-locales@2.0.61\n\n## @generaltranslation/react-core@1.8.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   generaltranslation@8.2.3\n    -   gt-i18n@0.8.1\n    -   @generaltranslation/supported-locales@2.0.61\n\n## gt-sanity@2.0.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   generaltranslation@8.2.3\n\n## @generaltranslation/supported-locales@2.0.61\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   generaltranslation@8.2.3\n\n## gt-tanstack-start@0.4.2\n\n### Patch Changes\n\n- [#1207](https://github.com/generaltranslation/gt/pull/1207)\n[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - feat: runtime\ntranslation\n\n- Updated dependencies\n\\[[`792f96d`](https://github.com/generaltranslation/gt/commit/792f96d92386985f424bd40f678564b2371b8b47)]:\n    -   gt-react@10.18.2\n    -   generaltranslation@8.2.3\n    -   gt-i18n@0.8.1\n    -   @generaltranslation/react-core@1.8.2\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-14T17:12:28Z",
          "url": "https://github.com/generaltranslation/gt/commit/0063b2b7656f1cdd5e5cca5ee51a6c5ed96aa4fe"
        },
        "date": 1776187292506,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04323045210098554,
            "range": "±0.0191",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.26195004504976366,
            "range": "±0.0618",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.46995058779342425,
            "range": "±0.0891",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.45322585597825576,
            "range": "±0.0674",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 245.89999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 264.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 402.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 171,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 20.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 31.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 161,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 599,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.100000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 142.90000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.5\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "f5b59f20387f38fa597b478627544fbde1162a99",
          "message": "[ci] release (#1215)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.14\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n    -   @generaltranslation/python-extractor@0.2.9\n\n## @generaltranslation/compiler@1.3.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n\n## generaltranslation@8.2.4\n\n### Patch Changes\n\n- [#1214](https://github.com/generaltranslation/gt/pull/1214)\n[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: bundle\ndeps to support gt-tanstack-start\n\n## gtx-cli@2.14.14\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.14\n\n## gt-i18n@0.8.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n    -   @generaltranslation/supported-locales@2.0.62\n\n## locadex@1.0.149\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.14\n\n## gt-next@6.16.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n    -   @generaltranslation/compiler@1.3.7\n    -   gt-i18n@0.8.2\n    -   gt-react@10.18.3\n    -   @generaltranslation/supported-locales@2.0.62\n\n## @generaltranslation/gt-next-lint@14.0.6\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.6\n\n## gt-node@0.6.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n    -   gt-i18n@0.8.2\n\n## @generaltranslation/python-extractor@0.2.9\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n\n## gt-react@10.18.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n    -   gt-i18n@0.8.2\n    -   @generaltranslation/react-core@1.8.3\n    -   @generaltranslation/supported-locales@2.0.62\n\n## @generaltranslation/react-core@1.8.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n    -   gt-i18n@0.8.2\n    -   @generaltranslation/supported-locales@2.0.62\n\n## gt-sanity@2.0.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n\n## @generaltranslation/supported-locales@2.0.62\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n\n## gt-tanstack-start@0.4.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`151f516`](https://github.com/generaltranslation/gt/commit/151f51686e52e70176f659a5d297a074a17fe20f)]:\n    -   generaltranslation@8.2.4\n    -   gt-i18n@0.8.2\n    -   gt-react@10.18.3\n    -   @generaltranslation/react-core@1.8.3\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-15T00:30:28Z",
          "url": "https://github.com/generaltranslation/gt/commit/f5b59f20387f38fa597b478627544fbde1162a99"
        },
        "date": 1776213545042,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.040773763516269004,
            "range": "±0.0163",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24653656579595926,
            "range": "±0.0489",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.44163316681376663,
            "range": "±0.0509",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4361835963382721,
            "range": "±0.0484",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 252.30000000004657,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 261.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 395.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 166,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.400000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.900000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 157.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 584,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.600000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.100000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 146.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.6\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "b41323b6355bb515923c294243e83c830ff472ff",
          "message": "[ci] release (#1219)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-react@10.19.0\n\n### Minor Changes\n\n- [#1218](https://github.com/generaltranslation/gt/pull/1218)\n[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! -\nfeat(react/browser): dev hot reload\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   generaltranslation@8.2.5\n    -   gt-i18n@0.8.3\n    -   @generaltranslation/react-core@1.8.4\n    -   @generaltranslation/supported-locales@2.0.63\n\n## gt@2.14.16\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   generaltranslation@8.2.5\n    -   @generaltranslation/python-extractor@0.2.10\n\n## @generaltranslation/compiler@1.3.8\n\n### Patch Changes\n\n- [#1218](https://github.com/generaltranslation/gt/pull/1218)\n[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! -\nfeat(react/browser): dev hot reload\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   generaltranslation@8.2.5\n\n## generaltranslation@8.2.5\n\n### Patch Changes\n\n- [#1218](https://github.com/generaltranslation/gt/pull/1218)\n[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! -\nfeat(react/browser): dev hot reload\n\n## gtx-cli@2.14.16\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.16\n\n## gt-i18n@0.8.3\n\n### Patch Changes\n\n- [#1218](https://github.com/generaltranslation/gt/pull/1218)\n[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! -\nfeat(react/browser): dev hot reload\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   generaltranslation@8.2.5\n    -   @generaltranslation/supported-locales@2.0.63\n\n## locadex@1.0.151\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.16\n\n## gt-next@6.16.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   gt-react@10.19.0\n    -   @generaltranslation/compiler@1.3.8\n    -   generaltranslation@8.2.5\n    -   gt-i18n@0.8.3\n    -   @generaltranslation/supported-locales@2.0.63\n\n## @generaltranslation/gt-next-lint@14.0.7\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.7\n\n## gt-node@0.6.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   generaltranslation@8.2.5\n    -   gt-i18n@0.8.3\n\n## @generaltranslation/python-extractor@0.2.10\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   generaltranslation@8.2.5\n\n## @generaltranslation/react-core@1.8.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   generaltranslation@8.2.5\n    -   gt-i18n@0.8.3\n    -   @generaltranslation/supported-locales@2.0.63\n\n## gt-sanity@2.0.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   generaltranslation@8.2.5\n\n## @generaltranslation/supported-locales@2.0.63\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   generaltranslation@8.2.5\n\n## gt-tanstack-start@0.4.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`02ef6fc`](https://github.com/generaltranslation/gt/commit/02ef6fcbd979247b9157e768e5a07b3285aaa6ec)]:\n    -   gt-react@10.19.0\n    -   generaltranslation@8.2.5\n    -   gt-i18n@0.8.3\n    -   @generaltranslation/react-core@1.8.4\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-16T17:38:54Z",
          "url": "https://github.com/generaltranslation/gt/commit/b41323b6355bb515923c294243e83c830ff472ff"
        },
        "date": 1776361669085,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04198891803829395,
            "range": "±0.0171",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.25620228432376835,
            "range": "±0.0731",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4481627535842314,
            "range": "±0.0528",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.44423310301954755,
            "range": "±0.0552",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 255.90000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 272.0999999999767,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 399,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.100000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 155.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 591,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.200000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 147,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.7\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "e0f77a167e2056abbbdfc3903f7ca0aef23e8f1b",
          "message": "[ci] release (#1229)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-next@6.16.8\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-react@10.19.1\n\n## @generaltranslation/gt-next-lint@14.0.8\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.8\n\n## gt-react-native@10.19.1\n\n### Patch Changes\n\n- [#1228](https://github.com/generaltranslation/gt/pull/1228)\n[`b8a8ada`](https://github.com/generaltranslation/gt/commit/b8a8ada6fe6ad8bd48f6492de19036a5a69bff19)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore: migrate\ngt-react-native to monorepo\n\n## gt-tanstack-start@0.4.5\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-react@10.19.1\n\n## gt-react@10.19.1\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-22T20:14:41Z",
          "url": "https://github.com/generaltranslation/gt/commit/e0f77a167e2056abbbdfc3903f7ca0aef23e8f1b"
        },
        "date": 1776889378096,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04051892050243182,
            "range": "±0.0203",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2552091903061259,
            "range": "±0.0678",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4515694584837599,
            "range": "±0.0695",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.43942379789103236,
            "range": "±0.049",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 263.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 304.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 425.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 167,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.899999999965075,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 158.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 591,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.300000000046566,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 149.10000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.8\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "Ernest McCarter",
            "username": "ErnestM1234",
            "email": "ernest@generaltranslation.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "2e1869d464714427e018911c61bd06b2cf5bb900",
          "message": "chore(compiler): more robust string extraction (#1233)\n\n<!-- greptile_comment -->\n\n<h3>Greptile Summary</h3>\n\nThis PR replaces the narrow `validateExpressionIsStringLiteral` check\nwith a new `resolveStaticExpression` utility that recursively resolves\nbinary `+` concatenation, nested template literals, and primitive\nliterals (string, numeric, boolean, null) to a compile-time string. The\nchange broadens what `gt()`, `msg()`, and `t()` accept as their first\nargument while keeping `$id`/`$context` options strictly as string\nliterals. Test coverage is thorough across unit, integration, and E2E\nlayers.\n\n<details open><summary><h3>Confidence Score: 5/5</h3></summary>\n\nSafe to merge; the one finding is a minor edge-case gap (unary-negated\nnumerics) that does not break existing behavior.\n\nAll remaining findings are P2. The core logic is correct, derive\ninteraction is preserved, error messages are consistent, and the test\nsuite is comprehensive. No regressions or data-integrity issues were\nfound.\n\nresolveStaticExpression.ts — minor: unary-negated numeric literals (e.g.\n-5) are not resolved statically.\n</details>\n\n\n<details><summary><h3>Important Files Changed</h3></summary>\n\n\n\n\n| Filename | Overview |\n|----------|----------|\n|\npackages/compiler/src/transform/templates-and-concat/resolveStaticExpression.ts\n| New utility for compile-time static expression resolution; handles\nstring/template/binary-concat and primitive literals, but misses\nunary-negated numeric literals (e.g. -5) |\n|\npackages/compiler/src/transform/validation/validateTranslationFunctionCallback.ts\n| Swapped validateExpressionIsStringLiteral for resolveStaticExpression\nfor the first argument; options ($id, $context) still use the old strict\nstring-literal validator as intended |\n| packages/compiler/src/passes/__tests__/stringExtractionE2E.test.ts |\nNew E2E tests covering gt(), msg(), t(), and tagged-template extraction\nacross concatenation, nested templates, and dynamic/static mixing —\ncomprehensive and well-organized |\n|\npackages/compiler/src/transform/validation/__tests__/robustStringExtraction.test.ts\n| 841-line golden-standard test suite for validateUseGTCallback covering\nconcatenation, nested templates, mixed forms, primitives, edge cases,\nrejection of dynamic content, and derive interactions |\n\n</details>\n\n\n</details>\n\n\n<details><summary><h3>Flowchart</h3></summary>\n\n```mermaid\n%%{init: {'theme': 'neutral'}}%%\nflowchart TD\n    A[validateUseGTCallback] --> B{arg is Expression?}\n    B -- No --> ERR1[return error]\n    B -- Yes --> C[resolveStaticExpression]\n    C --> D{StringLiteral}\n    D -- Yes --> RET_STR[return value]\n    C --> E{NumericLiteral}\n    E -- Yes --> RET_NUM[return String of n]\n    C --> F{BooleanLiteral}\n    F -- Yes --> RET_BOOL[return true or false]\n    C --> G{NullLiteral}\n    G -- Yes --> RET_NULL[return null string]\n    C --> H{TemplateLiteral}\n    H -- Yes --> H1[iterate quasis + expressions]\n    H1 --> H2{cooked is null?}\n    H2 -- Yes --> ERR_TPL[return invalid escape error]\n    H2 -- No --> H3[recurse on each expression]\n    H3 --> H4{child error?}\n    H4 -- Yes --> PROP[propagate error]\n    H4 -- No --> H5[accumulate string]\n    C --> I{BinaryExpression +}\n    I -- Yes --> I1[resolve left]\n    I1 --> I2{left error?}\n    I2 -- Yes --> ERR_L[propagate error]\n    I2 -- No --> I3[resolve right]\n    I3 --> I4{right error?}\n    I4 -- Yes --> ERR_R[propagate error]\n    I4 -- No --> CONCAT[return left + right]\n    C --> Z[return static string error]\n    D -- No --> E\n    E -- No --> F\n    F -- No --> G\n    G -- No --> H\n    H -- No --> I\n    I -- No --> Z\n    RET_STR --> CONT[content defined]\n    RET_NUM --> CONT\n    RET_BOOL --> CONT\n    RET_NULL --> CONT\n    H5 --> CONT\n    CONCAT --> CONT\n    ERR_TPL --> CONT2{autoderive enabled?}\n    PROP --> CONT2\n    ERR_L --> CONT2\n    ERR_R --> CONT2\n    Z --> CONT2\n    CONT2 -- Yes --> SKIP[skip validation]\n    CONT2 -- No --> DRV[validateDerive]\n    DRV --> DRV2{derive errors?}\n    DRV2 -- Yes --> ERR2[return errors]\n    DRV2 -- No --> SKIP\n    CONT --> OPT[validate options]\n    SKIP --> OPT\n    OPT --> FINAL[return result]\n```\n</details>\n\n\n<!-- greptile_failed_comments -->\n<details open><summary><h3>Comments Outside Diff (1)</h3></summary>\n\n1.\n`packages/compiler/src/transform/validation/validateTranslationFunctionCallback.ts`,\nline 12-14\n([link](https://github.com/generaltranslation/gt/blob/673babde100bd46915719c7b8e184c2a7f422cc3/packages/compiler/src/transform/validation/validateTranslationFunctionCallback.ts#L12-L14))\n\n<a href=\"#\"><img alt=\"P2\"\nsrc=\"https://greptile-static-assets.s3.amazonaws.com/badges/p2.svg?v=7\"\nalign=\"top\"></a> **Stale JSDoc after refactor**\n\nThe doc comment still says \"first argument must be a string literal\",\nbut the implementation now accepts any statically-resolvable expression\n(concatenation, template literals, numeric/boolean/null literals, or\n`derive()` calls). Consider updating it to reflect the broadened\ncontract.\n\n   \n\n   <details><summary>Prompt To Fix With AI</summary>\n\n   `````markdown\n   This is a comment left during a code review.\nPath:\npackages/compiler/src/transform/validation/validateTranslationFunctionCallback.ts\n   Line: 12-14\n\n   Comment:\n   **Stale JSDoc after refactor**\n\nThe doc comment still says \"first argument must be a string literal\",\nbut the implementation now accepts any statically-resolvable expression\n(concatenation, template literals, numeric/boolean/null literals, or\n`derive()` calls). Consider updating it to reflect the broadened\ncontract.\n\n   \n\n   How can I resolve this? If you propose a fix, please make it concise.\n   `````\n   </details>\n</details>\n\n<!-- /greptile_failed_comments -->\n\n<details><summary>Prompt To Fix All With AI</summary>\n\n`````markdown\nThis is a comment left during a code review.\nPath: packages/compiler/src/transform/templates-and-concat/resolveStaticExpression.ts\nLine: 19-21\n\nComment:\n**Negative numeric literals silently fail static resolution**\n\nIn Babel's AST, source code like `-5` or `-3.14` is represented as a `UnaryExpression(operator: '-', argument: NumericLiteral)`, not as a `NumericLiteral` directly. The current handler only matches `isNumericLiteral`, so `gt(\\`Count: ${-5}\\`)` falls through to the \"Expression is not a static string\" error even though the value is fully deterministic at compile time. Users writing translation strings with negative numbers in template interpolations will get a confusing rejection.\n\n```suggestion\n  if (t.isNumericLiteral(expr)) {\n    return { errors: [], value: String(expr.value) };\n  }\n\n  if (\n    t.isUnaryExpression(expr) &&\n    expr.operator === '-' &&\n    t.isNumericLiteral(expr.argument)\n  ) {\n    return { errors: [], value: String(-expr.argument.value) };\n  }\n```\n\nHow can I resolve this? If you propose a fix, please make it concise.\n`````\n\n</details>\n\n<sub>Reviews (2): Last reviewed commit: [\"fix minor\nfeedback\"](https://github.com/generaltranslation/gt/commit/e74dca8f6dcf344f4e466f2f80ff189b97cff056)\n| [Re-trigger\nGreptile](https://app.greptile.com/api/retrigger?id=29358871)</sub>\n\n<!-- /greptile_comment -->",
          "timestamp": "2026-04-23T00:19:39Z",
          "url": "https://github.com/generaltranslation/gt/commit/2e1869d464714427e018911c61bd06b2cf5bb900"
        },
        "date": 1776904027927,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.042088244612794784,
            "range": "±0.0169",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2506506827067658,
            "range": "±0.06",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4474077334525967,
            "range": "±0.0531",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4390209078138785,
            "range": "±0.0413",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 245.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 254.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 387.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 161,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 16.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 24.600000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 152.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 595,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 13.400000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 22.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 151.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.9\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "ab44e40d2a68ce57f2840d56ea8f477530b6b471",
          "message": "[ci] release (#1235)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## @generaltranslation/compiler@1.3.9\n\n### Patch Changes\n\n- [#1233](https://github.com/generaltranslation/gt/pull/1233)\n[`2e1869d`](https://github.com/generaltranslation/gt/commit/2e1869d464714427e018911c61bd06b2cf5bb900)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: more\nrobust string extraction\n\n## gt-next@6.16.10\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`2e1869d`](https://github.com/generaltranslation/gt/commit/2e1869d464714427e018911c61bd06b2cf5bb900)]:\n    -   @generaltranslation/compiler@1.3.9\n\n## @generaltranslation/gt-next-lint@14.0.10\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.10\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-23T00:31:27Z",
          "url": "https://github.com/generaltranslation/gt/commit/ab44e40d2a68ce57f2840d56ea8f477530b6b471"
        },
        "date": 1776904755681,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04055819792342573,
            "range": "±0.0158",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.255652299591002,
            "range": "±0.0535",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.45734926234004014,
            "range": "±0.0737",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4436288120567361,
            "range": "±0.0498",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 247.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 288.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 421.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 165,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.900000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 156.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 579,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.299999999988358,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 150.09999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.10\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "32fa54bf72ec2ea965bf0b40c80954d738530530",
          "message": "[ci] release (#1237)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.18\n\n### Patch Changes\n\n- [#1243](https://github.com/generaltranslation/gt/pull/1243)\n[`a0e19f6`](https://github.com/generaltranslation/gt/commit/a0e19f64a17d1a439d2352a6bc3ca7390c4ed401)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! -\nHandling Mintlify $ref\n\n## @generaltranslation/compiler@1.3.10\n\n### Patch Changes\n\n- [#1236](https://github.com/generaltranslation/gt/pull/1236)\n[`3d6c60e`](https://github.com/generaltranslation/gt/commit/3d6c60e1595bc9409a2d21a153caa5f909154691)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: string\nextraction for concat with non-strings\n\n## gtx-cli@2.14.18\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`a0e19f6`](https://github.com/generaltranslation/gt/commit/a0e19f64a17d1a439d2352a6bc3ca7390c4ed401)]:\n    -   gt@2.14.18\n\n## locadex@1.0.153\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`a0e19f6`](https://github.com/generaltranslation/gt/commit/a0e19f64a17d1a439d2352a6bc3ca7390c4ed401)]:\n    -   gt@2.14.18\n\n## gt-next@6.16.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`3d6c60e`](https://github.com/generaltranslation/gt/commit/3d6c60e1595bc9409a2d21a153caa5f909154691)]:\n    -   @generaltranslation/compiler@1.3.10\n\n## @generaltranslation/gt-next-lint@14.0.11\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.11\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-24T16:59:38Z",
          "url": "https://github.com/generaltranslation/gt/commit/32fa54bf72ec2ea965bf0b40c80954d738530530"
        },
        "date": 1777050475356,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03297467561329473,
            "range": "±0.0146",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.20868901501877238,
            "range": "±0.0612",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.40711264930838276,
            "range": "±0.0852",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.39515236887835364,
            "range": "±0.0653",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 250.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 272.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 397.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 163,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.100000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 155.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.700000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 22.600000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 150.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.11\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "d867a845cf9276050d234835a91658d9c0e4d8c1",
          "message": "[ci] release (#1245)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.19\n\n### Patch Changes\n\n- [#1244](https://github.com/generaltranslation/gt/pull/1244)\n[`c4c8b9c`](https://github.com/generaltranslation/gt/commit/c4c8b9c0429ce10d98ebdfaabc1213bd85a572bf)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! -\nUpdating Mintlify $ref handling\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n    -   @generaltranslation/python-extractor@0.2.11\n\n## @generaltranslation/compiler@1.3.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n\n## generaltranslation@8.2.6\n\n### Patch Changes\n\n- [#1240](https://github.com/generaltranslation/gt/pull/1240)\n[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)\nThanks [@bgub](https://github.com/bgub)! - Replace crypto-js with\n@noble/hashes for SHA-256 hashing\n\n## gtx-cli@2.14.19\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c4c8b9c`](https://github.com/generaltranslation/gt/commit/c4c8b9c0429ce10d98ebdfaabc1213bd85a572bf)]:\n    -   gt@2.14.19\n\n## gt-i18n@0.8.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n    -   @generaltranslation/supported-locales@2.0.64\n\n## locadex@1.0.154\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c4c8b9c`](https://github.com/generaltranslation/gt/commit/c4c8b9c0429ce10d98ebdfaabc1213bd85a572bf)]:\n    -   gt@2.14.19\n\n## gt-next@6.16.12\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n    -   @generaltranslation/compiler@1.3.11\n    -   gt-i18n@0.8.4\n    -   gt-react@10.19.3\n    -   @generaltranslation/supported-locales@2.0.64\n\n## @generaltranslation/gt-next-lint@14.0.12\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.12\n\n## gt-node@0.6.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n    -   gt-i18n@0.8.4\n\n## @generaltranslation/python-extractor@0.2.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n\n## gt-react@10.19.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n    -   gt-i18n@0.8.4\n    -   @generaltranslation/react-core@1.8.5\n    -   @generaltranslation/supported-locales@2.0.64\n\n## @generaltranslation/react-core@1.8.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n    -   gt-i18n@0.8.4\n    -   @generaltranslation/supported-locales@2.0.64\n\n## gt-react-native@10.19.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n    -   @generaltranslation/react-core@1.8.5\n    -   @generaltranslation/supported-locales@2.0.64\n\n## gt-sanity@2.0.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n\n## @generaltranslation/supported-locales@2.0.64\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n\n## gt-tanstack-start@0.4.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`8b75420`](https://github.com/generaltranslation/gt/commit/8b7542091233fb2c87284a365cc9ab8ce70371d3)]:\n    -   generaltranslation@8.2.6\n    -   gt-i18n@0.8.4\n    -   gt-react@10.19.3\n    -   @generaltranslation/react-core@1.8.5\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-24T18:52:06Z",
          "url": "https://github.com/generaltranslation/gt/commit/d867a845cf9276050d234835a91658d9c0e4d8c1"
        },
        "date": 1777057260377,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04147090180792845,
            "range": "±0.0194",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2601779771071816,
            "range": "±0.0634",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4613675027675226,
            "range": "±0.0776",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.45225713833634795,
            "range": "±0.0649",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 174.89999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 193.09999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 299.3999999999651,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 132,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 29.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 122.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 592,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.600000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 32.90000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 114,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.12\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "8b3b6e5c542d926c2236c14725243333701f2a2a",
          "message": "[ci] release (#1247)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.20\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)]:\n    -   generaltranslation@8.2.7\n    -   @generaltranslation/python-extractor@0.2.12\n\n## @generaltranslation/compiler@1.3.12\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)]:\n    -   generaltranslation@8.2.7\n\n## generaltranslation@8.2.7\n\n### Patch Changes\n\n- [#1246](https://github.com/generaltranslation/gt/pull/1246)\n[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5)\nThanks [@bgub](https://github.com/bgub)! - Migrate build tooling from\nRollup to tsdown (Rolldown). No public API changes. Output filenames\nsimplified (e.g. `index.cjs.min.cjs` → `index.cjs`), minification\nremoved (consumers bundle with their own minifier).\n\n- [#1251](https://github.com/generaltranslation/gt/pull/1251)\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)\nThanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each\npackage's `package.json` to enable tree-shaking in consumer bundlers\n(webpack, esbuild, Rollup). Packages with no module-scope side effects\nare marked `\"sideEffects\": false`. Packages with intentional side-effect\nentry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server\nentries, `gt-react-native` TurboModule spec) list those files explicitly\nso they are preserved.\n\n## gtx-cli@2.14.20\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.20\n\n## gt-i18n@0.8.5\n\n### Patch Changes\n\n- [#1252](https://github.com/generaltranslation/gt/pull/1252)\n[`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - fix: pass\n`maxChars` (not `$maxChars`) to `hashSource` so it factors into the hash\n\n- [#1251](https://github.com/generaltranslation/gt/pull/1251)\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)\nThanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each\npackage's `package.json` to enable tree-shaking in consumer bundlers\n(webpack, esbuild, Rollup). Packages with no module-scope side effects\nare marked `\"sideEffects\": false`. Packages with intentional side-effect\nentry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server\nentries, `gt-react-native` TurboModule spec) list those files explicitly\nso they are preserved.\n\n- [#1249](https://github.com/generaltranslation/gt/pull/1249)\n[`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)\nThanks [@bgub](https://github.com/bgub)! - chore: migrate build from\nRollup to tsdown\n\n- Updated dependencies\n\\[[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7),\n[`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:\n    -   generaltranslation@8.2.7\n    -   @generaltranslation/supported-locales@2.0.65\n\n## locadex@1.0.155\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.20\n\n## gt-next@6.16.13\n\n### Patch Changes\n\n- [#1251](https://github.com/generaltranslation/gt/pull/1251)\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)\nThanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each\npackage's `package.json` to enable tree-shaking in consumer bundlers\n(webpack, esbuild, Rollup). Packages with no module-scope side effects\nare marked `\"sideEffects\": false`. Packages with intentional side-effect\nentry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server\nentries, `gt-react-native` TurboModule spec) list those files explicitly\nso they are preserved.\n\n- Updated dependencies\n\\[[`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8),\n[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7),\n[`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:\n    -   gt-i18n@0.8.5\n    -   generaltranslation@8.2.7\n    -   gt-react@10.19.4\n    -   @generaltranslation/supported-locales@2.0.65\n    -   @generaltranslation/compiler@1.3.12\n\n## @generaltranslation/gt-next-lint@14.0.13\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)]:\n    -   gt-next@6.16.13\n\n## gt-node@0.6.5\n\n### Patch Changes\n\n- [#1251](https://github.com/generaltranslation/gt/pull/1251)\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)\nThanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each\npackage's `package.json` to enable tree-shaking in consumer bundlers\n(webpack, esbuild, Rollup). Packages with no module-scope side effects\nare marked `\"sideEffects\": false`. Packages with intentional side-effect\nentry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server\nentries, `gt-react-native` TurboModule spec) list those files explicitly\nso they are preserved.\n\n- [#1249](https://github.com/generaltranslation/gt/pull/1249)\n[`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)\nThanks [@bgub](https://github.com/bgub)! - chore: migrate build from\nRollup to tsdown\n\n- Updated dependencies\n\\[[`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8),\n[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7),\n[`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:\n    -   gt-i18n@0.8.5\n    -   generaltranslation@8.2.7\n\n## @generaltranslation/python-extractor@0.2.12\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)]:\n    -   generaltranslation@8.2.7\n\n## gt-react@10.19.4\n\n### Patch Changes\n\n- [#1251](https://github.com/generaltranslation/gt/pull/1251)\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)\nThanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each\npackage's `package.json` to enable tree-shaking in consumer bundlers\n(webpack, esbuild, Rollup). Packages with no module-scope side effects\nare marked `\"sideEffects\": false`. Packages with intentional side-effect\nentry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server\nentries, `gt-react-native` TurboModule spec) list those files explicitly\nso they are preserved.\n\n- Updated dependencies\n\\[[`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8),\n[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7),\n[`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:\n    -   gt-i18n@0.8.5\n    -   generaltranslation@8.2.7\n    -   @generaltranslation/react-core@1.8.6\n    -   @generaltranslation/supported-locales@2.0.65\n\n## @generaltranslation/react-core@1.8.6\n\n### Patch Changes\n\n- [#1251](https://github.com/generaltranslation/gt/pull/1251)\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)\nThanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each\npackage's `package.json` to enable tree-shaking in consumer bundlers\n(webpack, esbuild, Rollup). Packages with no module-scope side effects\nare marked `\"sideEffects\": false`. Packages with intentional side-effect\nentry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server\nentries, `gt-react-native` TurboModule spec) list those files explicitly\nso they are preserved.\n\n- Updated dependencies\n\\[[`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8),\n[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7),\n[`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:\n    -   gt-i18n@0.8.5\n    -   generaltranslation@8.2.7\n    -   @generaltranslation/supported-locales@2.0.65\n\n## gt-react-native@10.19.4\n\n### Patch Changes\n\n- [#1251](https://github.com/generaltranslation/gt/pull/1251)\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)\nThanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each\npackage's `package.json` to enable tree-shaking in consumer bundlers\n(webpack, esbuild, Rollup). Packages with no module-scope side effects\nare marked `\"sideEffects\": false`. Packages with intentional side-effect\nentry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server\nentries, `gt-react-native` TurboModule spec) list those files explicitly\nso they are preserved.\n\n- Updated dependencies\n\\[[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7),\n[`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:\n    -   generaltranslation@8.2.7\n    -   @generaltranslation/react-core@1.8.6\n    -   @generaltranslation/supported-locales@2.0.65\n\n## gt-sanity@2.0.8\n\n### Patch Changes\n\n- [#1260](https://github.com/generaltranslation/gt/pull/1260)\n[`e29d660`](https://github.com/generaltranslation/gt/commit/e29d6605e5883b640232de3f78a35de70fffafac)\nThanks [@brian-lou](https://github.com/brian-lou)! - Add dedupeFields\noption\n\n- Updated dependencies\n\\[[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)]:\n    -   generaltranslation@8.2.7\n\n## @generaltranslation/supported-locales@2.0.65\n\n### Patch Changes\n\n- [#1249](https://github.com/generaltranslation/gt/pull/1249)\n[`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)\nThanks [@bgub](https://github.com/bgub)! - chore: migrate build from\nRollup to tsdown\n\n- Updated dependencies\n\\[[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)]:\n    -   generaltranslation@8.2.7\n\n## gt-tanstack-start@0.4.8\n\n### Patch Changes\n\n- [#1251](https://github.com/generaltranslation/gt/pull/1251)\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7)\nThanks [@bgub](https://github.com/bgub)! - Declare `sideEffects` in each\npackage's `package.json` to enable tree-shaking in consumer bundlers\n(webpack, esbuild, Rollup). Packages with no module-scope side effects\nare marked `\"sideEffects\": false`. Packages with intentional side-effect\nentry points (`gt-react/browser`, `gt-react/macros`, `gt-next` server\nentries, `gt-react-native` TurboModule spec) list those files explicitly\nso they are preserved.\n\n- Updated dependencies\n\\[[`47ad56b`](https://github.com/generaltranslation/gt/commit/47ad56bb23a70382ba98a900d968e9a48beee2b8),\n[`e3a8008`](https://github.com/generaltranslation/gt/commit/e3a8008ed0a3ab82d053f549265f9de7829e94c5),\n[`fc3c699`](https://github.com/generaltranslation/gt/commit/fc3c699d2c952710cc975e26629ac309063dcbc7),\n[`50d7628`](https://github.com/generaltranslation/gt/commit/50d7628e23b056e91abf8fa05f6577b74cb91569)]:\n    -   gt-i18n@0.8.5\n    -   generaltranslation@8.2.7\n    -   gt-react@10.19.4\n    -   @generaltranslation/react-core@1.8.6\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-25T20:48:59Z",
          "url": "https://github.com/generaltranslation/gt/commit/8b3b6e5c542d926c2236c14725243333701f2a2a"
        },
        "date": 1777150629353,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04161179543941412,
            "range": "±0.0188",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2462355061546035,
            "range": "±0.0732",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4265418260869571,
            "range": "±0.0823",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.41528706307054936,
            "range": "±0.0728",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 173.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 214.10000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 305.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 134,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.900000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 125.10000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 598,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.900000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 123.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.13\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "1cee3ddeb1a52e807f2dc441597f9f8f4c2d75f4",
          "message": "[ci] release (#1264)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.21\n\n### Patch Changes\n\n- [#1261](https://github.com/generaltranslation/gt/pull/1261)\n[`a2c5c2e`](https://github.com/generaltranslation/gt/commit/a2c5c2e8c748c9d3d81dc3c99800ea17e2f2c9b9)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix(cli):\nenforcement of gt-react-native and gt-react sync\n\n## gtx-cli@2.14.21\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`a2c5c2e`](https://github.com/generaltranslation/gt/commit/a2c5c2e8c748c9d3d81dc3c99800ea17e2f2c9b9)]:\n    -   gt@2.14.21\n\n## gt-i18n@0.8.6\n\n### Patch Changes\n\n- [#1262](https://github.com/generaltranslation/gt/pull/1262)\n[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! -\nrefactor(gt-i18n): move over to subscription system\n\n## locadex@1.0.156\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`a2c5c2e`](https://github.com/generaltranslation/gt/commit/a2c5c2e8c748c9d3d81dc3c99800ea17e2f2c9b9)]:\n    -   gt@2.14.21\n\n## gt-next@6.16.14\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)]:\n    -   gt-i18n@0.8.6\n    -   gt-react@10.19.5\n\n## @generaltranslation/gt-next-lint@14.0.14\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.14\n\n## gt-node@0.6.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)]:\n    -   gt-i18n@0.8.6\n\n## gt-react@10.19.5\n\n### Patch Changes\n\n- [#1262](https://github.com/generaltranslation/gt/pull/1262)\n[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! -\nrefactor(gt-i18n): move over to subscription system\n\n- Updated dependencies\n\\[[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)]:\n    -   gt-i18n@0.8.6\n    -   @generaltranslation/react-core@1.8.7\n\n## @generaltranslation/react-core@1.8.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)]:\n    -   gt-i18n@0.8.6\n\n## gt-react-native@10.19.5\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   @generaltranslation/react-core@1.8.7\n\n## gt-sanity@2.0.9\n\n### Patch Changes\n\n- [#1265](https://github.com/generaltranslation/gt/pull/1265)\n[`5860bfe`](https://github.com/generaltranslation/gt/commit/5860bfe5aa14f0be40d7b01013fd3c4f7841b311)\nThanks [@brian-lou](https://github.com/brian-lou)! - Fix bulk\ntranslation imports creating duplicate translated documents when draft\nand published source documents are both present or multiple ready\nversions target the same source locale pair.\n\n## gt-tanstack-start@0.4.9\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`5af18c1`](https://github.com/generaltranslation/gt/commit/5af18c13c2c2ad341ec67c2b4f6f6ef29320123b)]:\n    -   gt-i18n@0.8.6\n    -   gt-react@10.19.5\n    -   @generaltranslation/react-core@1.8.7\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-26T23:07:10Z",
          "url": "https://github.com/generaltranslation/gt/commit/1cee3ddeb1a52e807f2dc441597f9f8f4c2d75f4"
        },
        "date": 1777245275530,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.039343794476355595,
            "range": "±0.0142",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.23458456988742968,
            "range": "±0.0507",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4118991663920928,
            "range": "±0.0697",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.41401958774834635,
            "range": "±0.0822",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 161.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 171.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 273,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 151,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 24.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 41.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 142.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 590,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 109.60000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.14\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "c41ddc67b3fafbba227acb660377ac630d57a97b",
          "message": "[ci] release (#1267)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-next@6.16.15\n\n### Patch Changes\n\n- [#1266](https://github.com/generaltranslation/gt/pull/1266)\n[`0c22b7a`](https://github.com/generaltranslation/gt/commit/0c22b7a7dd87db7657eb1ffee0444a054c6744fa)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: access\nlocale for metadata\n\n## @generaltranslation/gt-next-lint@14.0.15\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`0c22b7a`](https://github.com/generaltranslation/gt/commit/0c22b7a7dd87db7657eb1ffee0444a054c6744fa)]:\n    -   gt-next@6.16.15\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-27T01:46:57Z",
          "url": "https://github.com/generaltranslation/gt/commit/c41ddc67b3fafbba227acb660377ac630d57a97b"
        },
        "date": 1777254818801,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.030941899443069822,
            "range": "±0.0126",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.19225707920030494,
            "range": "±0.0587",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.3517883565400874,
            "range": "±0.0619",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.34599939695712606,
            "range": "±0.0547",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 148.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 159.19999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 107,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 99.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 587,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.400000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 18.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 134.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.15\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "022c515afddbff307ec7dbcf3a35620594de56de",
          "message": "[ci] release (#1268)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## @generaltranslation/compiler@1.3.13\n\n### Patch Changes\n\n-\n[`28d0c06`](https://github.com/generaltranslation/gt/commit/28d0c06f3e8366fc2c119b7792620c4764eda2de)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - patch: inject\ncompile-time hashes into standalone t() calls\n\n## gt-next@6.16.16\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`28d0c06`](https://github.com/generaltranslation/gt/commit/28d0c06f3e8366fc2c119b7792620c4764eda2de)]:\n    -   @generaltranslation/compiler@1.3.13\n\n## @generaltranslation/gt-next-lint@14.0.16\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.16\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-27T19:30:23Z",
          "url": "https://github.com/generaltranslation/gt/commit/022c515afddbff307ec7dbcf3a35620594de56de"
        },
        "date": 1777318637611,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03282810931652572,
            "range": "±0.0122",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.19698623316266162,
            "range": "±0.0593",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.3622152881969575,
            "range": "±0.0613",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.3590404070351748,
            "range": "±0.0678",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 143.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 153.69999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 242.19999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 120,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 19.400000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 111.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 616,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.199999999953434,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 17.800000000046566,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 123.19999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.16\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "f96aadd0e6d2ac182daaaf466f5e0642cb577236",
          "message": "[ci] release (#1274)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.22\n\n### Patch Changes\n\n- [#1248](https://github.com/generaltranslation/gt/pull/1248)\n[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add PO/POT file\nformat support and transformFormat plumbing for API uploads and CLI file\ndownloads.\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n    -   @generaltranslation/python-extractor@0.2.13\n\n## @generaltranslation/compiler@1.3.14\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n\n## generaltranslation@8.2.8\n\n### Patch Changes\n\n- [#1248](https://github.com/generaltranslation/gt/pull/1248)\n[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add PO/POT file\nformat support and transformFormat plumbing for API uploads and CLI file\ndownloads.\n\n## gtx-cli@2.14.22\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   gt@2.14.22\n\n## gt-i18n@0.8.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n    -   @generaltranslation/supported-locales@2.0.66\n\n## locadex@1.0.157\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   gt@2.14.22\n\n## gt-next@6.16.17\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n    -   @generaltranslation/compiler@1.3.14\n    -   gt-i18n@0.8.7\n    -   gt-react@10.19.6\n    -   @generaltranslation/supported-locales@2.0.66\n\n## @generaltranslation/gt-next-lint@14.0.17\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.17\n\n## gt-node@0.6.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n    -   gt-i18n@0.8.7\n\n## @generaltranslation/python-extractor@0.2.13\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n\n## gt-react@10.19.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n    -   gt-i18n@0.8.7\n    -   @generaltranslation/react-core@1.8.8\n    -   @generaltranslation/supported-locales@2.0.66\n\n## @generaltranslation/react-core@1.8.8\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n    -   gt-i18n@0.8.7\n    -   @generaltranslation/supported-locales@2.0.66\n\n## gt-react-native@10.19.6\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n    -   @generaltranslation/react-core@1.8.8\n    -   @generaltranslation/supported-locales@2.0.66\n\n## gt-sanity@2.0.10\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n\n## @generaltranslation/supported-locales@2.0.66\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n\n## gt-tanstack-start@0.4.10\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b12d57d`](https://github.com/generaltranslation/gt/commit/b12d57dab1d5cb1f602c5ac24a702b48cda7f11e)]:\n    -   generaltranslation@8.2.8\n    -   gt-i18n@0.8.7\n    -   gt-react@10.19.6\n    -   @generaltranslation/react-core@1.8.8\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-28T00:02:20Z",
          "url": "https://github.com/generaltranslation/gt/commit/f96aadd0e6d2ac182daaaf466f5e0642cb577236"
        },
        "date": 1777334994909,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.025454998574555864,
            "range": "±0.0145",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.14715756915833064,
            "range": "±0.0448",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.26816964504021257,
            "range": "±0.0447",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.26345835018430575,
            "range": "±0.0437",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 120.80000000004657,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 128.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 199.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 112,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 21.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 41.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 104.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 574,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 8.300000000046566,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 15.800000000046566,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 89.80000000004657,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.17\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "63cecf68789b314b05bee8d54a4ca65db51b6655",
          "message": "[ci] release (#1289)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.25\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n    -   @generaltranslation/python-extractor@0.2.14\n\n## @generaltranslation/compiler@1.3.15\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n\n## generaltranslation@8.2.9\n\n### Patch Changes\n\n- [#1278](https://github.com/generaltranslation/gt/pull/1278)\n[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)\nThanks [@bgub](https://github.com/bgub)! - Add a\n`generaltranslation/core` entrypoint for locale and formatting helpers,\nand update `gt-i18n` to consume it where possible.\n\n## gtx-cli@2.14.25\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.25\n\n## gt-i18n@0.8.8\n\n### Patch Changes\n\n- [#1278](https://github.com/generaltranslation/gt/pull/1278)\n[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)\nThanks [@bgub](https://github.com/bgub)! - Add a\n`generaltranslation/core` entrypoint for locale and formatting helpers,\nand update `gt-i18n` to consume it where possible.\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n    -   @generaltranslation/supported-locales@2.0.67\n\n## locadex@1.0.160\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.25\n\n## gt-next@6.16.18\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n    -   gt-i18n@0.8.8\n    -   @generaltranslation/compiler@1.3.15\n    -   gt-react@10.19.7\n    -   @generaltranslation/supported-locales@2.0.67\n\n## @generaltranslation/gt-next-lint@14.0.18\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.18\n\n## gt-node@0.6.8\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n    -   gt-i18n@0.8.8\n\n## @generaltranslation/python-extractor@0.2.14\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n\n## gt-react@10.19.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n    -   gt-i18n@0.8.8\n    -   @generaltranslation/react-core@1.8.9\n    -   @generaltranslation/supported-locales@2.0.67\n\n## @generaltranslation/react-core@1.8.9\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n    -   gt-i18n@0.8.8\n    -   @generaltranslation/supported-locales@2.0.67\n\n## gt-react-native@10.19.7\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n    -   @generaltranslation/react-core@1.8.9\n    -   @generaltranslation/supported-locales@2.0.67\n\n## gt-sanity@2.0.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n\n## @generaltranslation/supported-locales@2.0.67\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n\n## gt-tanstack-start@0.4.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`ce0933a`](https://github.com/generaltranslation/gt/commit/ce0933ab102d34a0c38634f7c2b0d634c9a620a8)]:\n    -   generaltranslation@8.2.9\n    -   gt-i18n@0.8.8\n    -   gt-react@10.19.7\n    -   @generaltranslation/react-core@1.8.9\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-28T21:07:46Z",
          "url": "https://github.com/generaltranslation/gt/commit/63cecf68789b314b05bee8d54a4ca65db51b6655"
        },
        "date": 1777410957715,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.040111750200545915,
            "range": "±0.0158",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.23742815194681785,
            "range": "±0.0649",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4198490512174671,
            "range": "±0.0714",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.41912458005029196,
            "range": "±0.0794",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 169.09999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 204.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 288.0999999999767,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 129,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.900000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.800000000046566,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 120.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 587,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 88.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.18\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "10d5ca140385c595980cb28045a0c21581a9f6a8",
          "message": "[ci] release (#1292)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.27\n\n### Patch Changes\n\n- [#1285](https://github.com/generaltranslation/gt/pull/1285)\n[`0404f04`](https://github.com/generaltranslation/gt/commit/0404f04be055275048ab3db03013cecb0d3d9153)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: silent\nerror on download file failure\n\n- [#1277](https://github.com/generaltranslation/gt/pull/1277)\n[`5eae67c`](https://github.com/generaltranslation/gt/commit/5eae67c47b14edf65f7a8911559aa154db19f437)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Improve\ntransformationFormat error message and normalize casing so lowercase\nvalues like \"po\" work in gt.config.json.\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n    -   @generaltranslation/python-extractor@0.2.15\n\n## @generaltranslation/compiler@1.3.16\n\n### Patch Changes\n\n- [#1271](https://github.com/generaltranslation/gt/pull/1271)\n[`7b1fd81`](https://github.com/generaltranslation/gt/commit/7b1fd816f8c8c9f2997bc0b9abe2cabd1dab00e8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! -\nrefactor(compiler): consolidate string extraction logic\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n\n## generaltranslation@8.2.10\n\n### Patch Changes\n\n- [#1276](https://github.com/generaltranslation/gt/pull/1276)\n[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)\nThanks [@bgub](https://github.com/bgub)! - Fix locale emoji fallback\nhandling for language exception locales and document supported flag\nregions.\n\n## gtx-cli@2.14.27\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`0404f04`](https://github.com/generaltranslation/gt/commit/0404f04be055275048ab3db03013cecb0d3d9153),\n[`5eae67c`](https://github.com/generaltranslation/gt/commit/5eae67c47b14edf65f7a8911559aa154db19f437)]:\n    -   gt@2.14.27\n\n## gt-i18n@0.8.9\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n    -   @generaltranslation/supported-locales@2.0.68\n\n## locadex@1.0.162\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`0404f04`](https://github.com/generaltranslation/gt/commit/0404f04be055275048ab3db03013cecb0d3d9153),\n[`5eae67c`](https://github.com/generaltranslation/gt/commit/5eae67c47b14edf65f7a8911559aa154db19f437)]:\n    -   gt@2.14.27\n\n## gt-next@6.16.19\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`7b1fd81`](https://github.com/generaltranslation/gt/commit/7b1fd816f8c8c9f2997bc0b9abe2cabd1dab00e8),\n[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   @generaltranslation/compiler@1.3.16\n    -   generaltranslation@8.2.10\n    -   gt-i18n@0.8.9\n    -   gt-react@10.19.8\n    -   @generaltranslation/supported-locales@2.0.68\n\n## @generaltranslation/gt-next-lint@14.0.19\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.19\n\n## gt-node@0.6.9\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n    -   gt-i18n@0.8.9\n\n## @generaltranslation/python-extractor@0.2.15\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n\n## gt-react@10.19.8\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n    -   gt-i18n@0.8.9\n    -   @generaltranslation/react-core@1.8.10\n    -   @generaltranslation/supported-locales@2.0.68\n\n## @generaltranslation/react-core@1.8.10\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n    -   gt-i18n@0.8.9\n    -   @generaltranslation/supported-locales@2.0.68\n\n## gt-react-native@10.19.8\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n    -   @generaltranslation/react-core@1.8.10\n    -   @generaltranslation/supported-locales@2.0.68\n\n## gt-sanity@2.0.12\n\n### Patch Changes\n\n- [#1271](https://github.com/generaltranslation/gt/pull/1271)\n[`7b1fd81`](https://github.com/generaltranslation/gt/commit/7b1fd816f8c8c9f2997bc0b9abe2cabd1dab00e8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! -\nrefactor(compiler): consolidate string extraction logic\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n\n## @generaltranslation/supported-locales@2.0.68\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n\n## gt-tanstack-start@0.4.12\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`20276d0`](https://github.com/generaltranslation/gt/commit/20276d03cc1494e79d93d9dc131eee2815a4fae6)]:\n    -   generaltranslation@8.2.10\n    -   gt-i18n@0.8.9\n    -   gt-react@10.19.8\n    -   @generaltranslation/react-core@1.8.10\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-28T23:48:28Z",
          "url": "https://github.com/generaltranslation/gt/commit/10d5ca140385c595980cb28045a0c21581a9f6a8"
        },
        "date": 1777420580855,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03998544078368695,
            "range": "±0.0154",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24696103111110965,
            "range": "±0.0687",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.43170818032786484,
            "range": "±0.0733",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4260087759795592,
            "range": "±0.0736",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 170.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 210.09999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 285.0999999999767,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 107,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 27.300000000046566,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 97.60000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 606,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.799999999988358,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 91.60000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.19\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "dea365ecfc9cbe20af7110ca57edc4cdf6328199",
          "message": "[ci] release (#1303)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.30\n\n### Patch Changes\n\n- [#1304](https://github.com/generaltranslation/gt/pull/1304)\n[`c15ecf5`](https://github.com/generaltranslation/gt/commit/c15ecf581821a2feac72f53c5470b5b9b163564a)\nThanks [@moss-bryophyta](https://github.com/moss-bryophyta)! - Sort JSON\nkeys when outputting translation files for deterministic output\n\n## @generaltranslation/compiler@1.3.17\n\n### Patch Changes\n\n- [#1272](https://github.com/generaltranslation/gt/pull/1272)\n[`7ce1813`](https://github.com/generaltranslation/gt/commit/7ce18131c7a1e494fdc5c488e2f53d033b083311)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: add error\nenforcement for msg(), t() and t\\`\\`\n\n## gtx-cli@2.14.30\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c15ecf5`](https://github.com/generaltranslation/gt/commit/c15ecf581821a2feac72f53c5470b5b9b163564a)]:\n    -   gt@2.14.30\n\n## gt-i18n@0.8.10\n\n### Patch Changes\n\n- [#1301](https://github.com/generaltranslation/gt/pull/1301)\n[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)\nThanks [@bgub](https://github.com/bgub)! - Fix source-locale\ninterpolation for missing translations and resolve custom locale aliases\nconsistently in browser and TanStack Start locale detection.\n\n## locadex@1.0.165\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c15ecf5`](https://github.com/generaltranslation/gt/commit/c15ecf581821a2feac72f53c5470b5b9b163564a)]:\n    -   gt@2.14.30\n\n## gt-next@6.16.20\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`7ce1813`](https://github.com/generaltranslation/gt/commit/7ce18131c7a1e494fdc5c488e2f53d033b083311),\n[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)]:\n    -   @generaltranslation/compiler@1.3.17\n    -   gt-i18n@0.8.10\n    -   gt-react@10.19.9\n\n## @generaltranslation/gt-next-lint@14.0.20\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.20\n\n## gt-node@0.6.10\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)]:\n    -   gt-i18n@0.8.10\n\n## gt-react@10.19.9\n\n### Patch Changes\n\n- [#1301](https://github.com/generaltranslation/gt/pull/1301)\n[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)\nThanks [@bgub](https://github.com/bgub)! - Fix source-locale\ninterpolation for missing translations and resolve custom locale aliases\nconsistently in browser and TanStack Start locale detection.\n\n- Updated dependencies\n\\[[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)]:\n    -   gt-i18n@0.8.10\n    -   @generaltranslation/react-core@1.8.11\n\n## @generaltranslation/react-core@1.8.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)]:\n    -   gt-i18n@0.8.10\n\n## gt-react-native@10.19.9\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   @generaltranslation/react-core@1.8.11\n\n## gt-tanstack-start@0.4.13\n\n### Patch Changes\n\n- [#1301](https://github.com/generaltranslation/gt/pull/1301)\n[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)\nThanks [@bgub](https://github.com/bgub)! - Fix source-locale\ninterpolation for missing translations and resolve custom locale aliases\nconsistently in browser and TanStack Start locale detection.\n\n- Updated dependencies\n\\[[`a5a109c`](https://github.com/generaltranslation/gt/commit/a5a109ceab5790af1dd621578cae7b597cfd26f2)]:\n    -   gt-i18n@0.8.10\n    -   gt-react@10.19.9\n    -   @generaltranslation/react-core@1.8.11\n\n<!-- codesmith:footer -->\n---\n<a\nhref=\"https://app.blacksmith.sh/generaltranslation/codesmith/gt/pr/1303\"><picture><source\nmedia=\"(prefers-color-scheme: dark)\"\nsrcset=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-dark.svg\"><source\nmedia=\"(prefers-color-scheme: light)\"\nsrcset=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-light.svg\"><img\nalt=\"View in Codesmith\"\nsrc=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-dark.svg\"></picture></a>\n<sup>Need help on this PR? Tag <code>@codesmith</code> with what you\nneed.</sup>\n\n- [ ] Let Codesmith autofix CI failures and bot reviews\n<!-- /codesmith:footer -->\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-30T18:43:16Z",
          "url": "https://github.com/generaltranslation/gt/commit/dea365ecfc9cbe20af7110ca57edc4cdf6328199"
        },
        "date": 1777575053885,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04120539464359256,
            "range": "±0.017",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24667215046867214,
            "range": "±0.0719",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.42540550255101983,
            "range": "±0.0668",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.42274282179054284,
            "range": "±0.0703",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 168.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 191.69999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 288.3999999999942,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 106,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 30.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 98.19999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 580,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 12.700000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 23.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 100.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.20\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "a4adc594da4fd72abd08ab2d19dbdd0e69aa75a8",
          "message": "[ci] release (#1307)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-i18n@0.8.11\n\n### Patch Changes\n\n- [#1296](https://github.com/generaltranslation/gt/pull/1296)\n[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)\nThanks [@bgub](https://github.com/bgub)! - Require explicit locales for\nI18nManager translation/cache operations, move current-locale lookup\ninto higher-level helpers, and keep runtime condition storage in wrapper\nruntimes.\n\n## gt-next@6.16.21\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)]:\n    -   gt-i18n@0.8.11\n    -   gt-react@10.19.10\n\n## @generaltranslation/gt-next-lint@14.0.21\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.21\n\n## gt-node@0.6.11\n\n### Patch Changes\n\n- [#1296](https://github.com/generaltranslation/gt/pull/1296)\n[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)\nThanks [@bgub](https://github.com/bgub)! - Require explicit locales for\nI18nManager translation/cache operations, move current-locale lookup\ninto higher-level helpers, and keep runtime condition storage in wrapper\nruntimes.\n\n- Updated dependencies\n\\[[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)]:\n    -   gt-i18n@0.8.11\n\n## gt-react@10.19.10\n\n### Patch Changes\n\n- [#1296](https://github.com/generaltranslation/gt/pull/1296)\n[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)\nThanks [@bgub](https://github.com/bgub)! - Require explicit locales for\nI18nManager translation/cache operations, move current-locale lookup\ninto higher-level helpers, and keep runtime condition storage in wrapper\nruntimes.\n\n- Updated dependencies\n\\[[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)]:\n    -   gt-i18n@0.8.11\n    -   @generaltranslation/react-core@1.8.12\n\n## @generaltranslation/react-core@1.8.12\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)]:\n    -   gt-i18n@0.8.11\n\n## gt-react-native@10.19.10\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   @generaltranslation/react-core@1.8.12\n\n## gt-tanstack-start@0.4.14\n\n### Patch Changes\n\n- [#1296](https://github.com/generaltranslation/gt/pull/1296)\n[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)\nThanks [@bgub](https://github.com/bgub)! - Require explicit locales for\nI18nManager translation/cache operations, move current-locale lookup\ninto higher-level helpers, and keep runtime condition storage in wrapper\nruntimes.\n\n- Updated dependencies\n\\[[`b8045ad`](https://github.com/generaltranslation/gt/commit/b8045ad0a6bf58ab39a0a1f632ed7250b670e401)]:\n    -   gt-i18n@0.8.11\n    -   gt-react@10.19.10\n    -   @generaltranslation/react-core@1.8.12\n\n<!-- codesmith:footer -->\n---\n<a\nhref=\"https://app.blacksmith.sh/generaltranslation/codesmith/gt/pr/1307\"><picture><source\nmedia=\"(prefers-color-scheme: dark)\"\nsrcset=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-dark.svg\"><source\nmedia=\"(prefers-color-scheme: light)\"\nsrcset=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-light.svg\"><img\nalt=\"View in Codesmith\"\nsrc=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-dark.svg\"></picture></a>\n<sup>Need help on this PR? Tag <code>@codesmith</code> with what you\nneed.</sup>\n\n- [ ] Let Codesmith autofix CI failures and bot reviews\n<!-- /codesmith:footer -->\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-04-30T23:54:38Z",
          "url": "https://github.com/generaltranslation/gt/commit/a4adc594da4fd72abd08ab2d19dbdd0e69aa75a8"
        },
        "date": 1777593706109,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03260870607799713,
            "range": "±0.0159",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.20161407741935347,
            "range": "±0.0707",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.370464357037035,
            "range": "±0.073",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.3754924984985097,
            "range": "±0.0879",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 149.60000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 159.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 257.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 146,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 34.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 51.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 137.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 590,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 87.09999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.21\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "2da9cd725ccb1927561507a6677f3a909725fcd8",
          "message": "[ci] release (#1318)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.31\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:\n    -   generaltranslation@8.2.11\n    -   @generaltranslation/python-extractor@0.2.17\n\n## @generaltranslation/compiler@1.3.18\n\n### Patch Changes\n\n- [#1313](https://github.com/generaltranslation/gt/pull/1313)\n[`b6098f8`](https://github.com/generaltranslation/gt/commit/b6098f87e2355e7d862d201c24b25467fb569015)\nThanks [@bgub](https://github.com/bgub)! - Do not treat JavaScript\nlabels as shadowing GT translation imports during string extraction.\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:\n    -   generaltranslation@8.2.11\n\n## generaltranslation@8.2.11\n\n### Patch Changes\n\n- [#1308](https://github.com/generaltranslation/gt/pull/1308)\n[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)\nThanks [@bgub](https://github.com/bgub)! - Add shared cache expiry,\nbatching, and runtime translation configuration to I18nManager.\n\n## gtx-cli@2.14.31\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.31\n\n## gt-i18n@0.8.12\n\n### Patch Changes\n\n- [#1308](https://github.com/generaltranslation/gt/pull/1308)\n[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)\nThanks [@bgub](https://github.com/bgub)! - Add shared cache expiry,\nbatching, and runtime translation configuration to I18nManager.\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:\n    -   generaltranslation@8.2.11\n    -   @generaltranslation/supported-locales@2.0.69\n\n## locadex@1.0.166\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.31\n\n## gt-next@6.16.22\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`b6098f8`](https://github.com/generaltranslation/gt/commit/b6098f87e2355e7d862d201c24b25467fb569015),\n[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:\n    -   @generaltranslation/compiler@1.3.18\n    -   generaltranslation@8.2.11\n    -   gt-i18n@0.8.12\n    -   gt-react@10.19.11\n    -   @generaltranslation/supported-locales@2.0.69\n\n## @generaltranslation/gt-next-lint@14.0.22\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.22\n\n## gt-node@0.6.12\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:\n    -   generaltranslation@8.2.11\n    -   gt-i18n@0.8.12\n\n## @generaltranslation/python-extractor@0.2.17\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:\n    -   generaltranslation@8.2.11\n\n## gt-react@10.19.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6),\n[`d9f3646`](https://github.com/generaltranslation/gt/commit/d9f3646aee45dc85cb3e28952bbf2c61b2b25050)]:\n    -   generaltranslation@8.2.11\n    -   gt-i18n@0.8.12\n    -   @generaltranslation/react-core@1.8.13\n    -   @generaltranslation/supported-locales@2.0.69\n\n## @generaltranslation/react-core@1.8.13\n\n### Patch Changes\n\n- [#1312](https://github.com/generaltranslation/gt/pull/1312)\n[`d9f3646`](https://github.com/generaltranslation/gt/commit/d9f3646aee45dc85cb3e28952bbf2c61b2b25050)\nThanks [@bgub](https://github.com/bgub)! - Fix locale selector sorting\nso it does not mutate provider locale state.\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:\n    -   generaltranslation@8.2.11\n    -   gt-i18n@0.8.12\n    -   @generaltranslation/supported-locales@2.0.69\n\n## gt-react-native@10.19.11\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6),\n[`d9f3646`](https://github.com/generaltranslation/gt/commit/d9f3646aee45dc85cb3e28952bbf2c61b2b25050)]:\n    -   generaltranslation@8.2.11\n    -   @generaltranslation/react-core@1.8.13\n    -   @generaltranslation/supported-locales@2.0.69\n\n## gt-sanity@2.0.13\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:\n    -   generaltranslation@8.2.11\n\n## @generaltranslation/supported-locales@2.0.69\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6)]:\n    -   generaltranslation@8.2.11\n\n## gt-tanstack-start@0.4.15\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`fecaf93`](https://github.com/generaltranslation/gt/commit/fecaf93d1dcae65598b3f81b8eeabaeb35be13c6),\n[`d9f3646`](https://github.com/generaltranslation/gt/commit/d9f3646aee45dc85cb3e28952bbf2c61b2b25050)]:\n    -   generaltranslation@8.2.11\n    -   gt-i18n@0.8.12\n    -   @generaltranslation/react-core@1.8.13\n    -   gt-react@10.19.11\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-04T18:05:51Z",
          "url": "https://github.com/generaltranslation/gt/commit/2da9cd725ccb1927561507a6677f3a909725fcd8"
        },
        "date": 1777918438707,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04164976301541008,
            "range": "±0.0165",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24378474987811075,
            "range": "±0.052",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4412474144620855,
            "range": "±0.0869",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.42181308853288574,
            "range": "±0.0549",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 171.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 200.80000000001746,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 288.80000000001746,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 104,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 29.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 95.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 601,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 113.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.22\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "fbf59324128e1aff1533307d8f45c5c73c7a1835",
          "message": "[ci] release (#1330)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.32\n\n### Patch Changes\n\n- [#1338](https://github.com/generaltranslation/gt/pull/1338)\n[`66b5df5`](https://github.com/generaltranslation/gt/commit/66b5df57a69d224345ad0a6191437ba8aca3a19d)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Generate\nexplicit relative import paths in `loadTranslations.js` for local\n    translation files.\n\n- [#1314](https://github.com/generaltranslation/gt/pull/1314)\n[`a13629f`](https://github.com/generaltranslation/gt/commit/a13629f2c5e5a2fcc22c34704507bcc591174825)\nThanks [@bgub](https://github.com/bgub)! - Show a warning download\nstatus when completed files are missing from the download response.\n\n## @generaltranslation/compiler@1.3.19\n\n### Patch Changes\n\n- [#1315](https://github.com/generaltranslation/gt/pull/1315)\n[`5801996`](https://github.com/generaltranslation/gt/commit/58019961cf4142e5468fbbc523a514e3f90b4123)\nThanks [@bgub](https://github.com/bgub)! - Preserve invalid template\nescape errors in `msg()` and `t()` validation even when string\nautoderive is enabled.\n\n- [#1331](https://github.com/generaltranslation/gt/pull/1331)\n[`3dedd4a`](https://github.com/generaltranslation/gt/commit/3dedd4a07b674f7b943f963190232e5c0f01026f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Thread JSX\ncollection through path-aware helpers for future derivation support.\n\n## gtx-cli@2.14.32\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`66b5df5`](https://github.com/generaltranslation/gt/commit/66b5df57a69d224345ad0a6191437ba8aca3a19d),\n[`a13629f`](https://github.com/generaltranslation/gt/commit/a13629f2c5e5a2fcc22c34704507bcc591174825)]:\n    -   gt@2.14.32\n\n## gt-i18n@0.8.13\n\n### Patch Changes\n\n- [#1325](https://github.com/generaltranslation/gt/pull/1325)\n[`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary\ncache primitives.\n\n- [#1310](https://github.com/generaltranslation/gt/pull/1310)\n[`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e)\nThanks [@bgub](https://github.com/bgub)! - Fix dialect translation cache\nkeys for fallback and custom alias locales.\n\n- [#1326](https://github.com/generaltranslation/gt/pull/1326)\n[`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96)\nThanks [@bgub](https://github.com/bgub)! - Fix runtime translation\nmetadata for max character limits.\n\n- [#1327](https://github.com/generaltranslation/gt/pull/1327)\n[`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Wire dictionary\nloading into the i18n manager.\n\n- [#1311](https://github.com/generaltranslation/gt/pull/1311)\n[`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24)\nThanks [@bgub](https://github.com/bgub)! - Route gt-next cached and\nruntime translation lookups through I18nManager.\n\n## locadex@1.0.167\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`66b5df5`](https://github.com/generaltranslation/gt/commit/66b5df57a69d224345ad0a6191437ba8aca3a19d),\n[`a13629f`](https://github.com/generaltranslation/gt/commit/a13629f2c5e5a2fcc22c34704507bcc591174825)]:\n    -   gt@2.14.32\n\n## gt-next@6.16.23\n\n### Patch Changes\n\n- [#1311](https://github.com/generaltranslation/gt/pull/1311)\n[`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24)\nThanks [@bgub](https://github.com/bgub)! - Route gt-next cached and\nruntime translation lookups through I18nManager.\n\n- Updated dependencies\n\\[[`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8),\n[`5801996`](https://github.com/generaltranslation/gt/commit/58019961cf4142e5468fbbc523a514e3f90b4123),\n[`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e),\n[`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96),\n[`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda),\n[`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24),\n[`3dedd4a`](https://github.com/generaltranslation/gt/commit/3dedd4a07b674f7b943f963190232e5c0f01026f)]:\n    -   gt-i18n@0.8.13\n    -   @generaltranslation/compiler@1.3.19\n    -   gt-react@10.19.12\n\n## @generaltranslation/gt-next-lint@14.0.23\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24)]:\n    -   gt-next@6.16.23\n\n## gt-node@0.6.13\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8),\n[`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e),\n[`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96),\n[`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda),\n[`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24)]:\n    -   gt-i18n@0.8.13\n\n## gt-react@10.19.12\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8),\n[`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e),\n[`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96),\n[`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda),\n[`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24)]:\n    -   gt-i18n@0.8.13\n    -   @generaltranslation/react-core@1.8.14\n\n## @generaltranslation/react-core@1.8.14\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8),\n[`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e),\n[`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96),\n[`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda),\n[`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24)]:\n    -   gt-i18n@0.8.13\n\n## gt-react-native@10.19.12\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   @generaltranslation/react-core@1.8.14\n\n## gt-tanstack-start@0.4.16\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`c7f8dbe`](https://github.com/generaltranslation/gt/commit/c7f8dbe7841b772358e4e0391fd7782e223cbec8),\n[`3af2461`](https://github.com/generaltranslation/gt/commit/3af2461b5456a87883431561712615fdb4f8c89e),\n[`6f56c52`](https://github.com/generaltranslation/gt/commit/6f56c52d2d6687b614b3eee7226f886c8eac9a96),\n[`a5b18eb`](https://github.com/generaltranslation/gt/commit/a5b18eb39f6f74e77df78b58f11f065cc7dbdbda),\n[`4976fc6`](https://github.com/generaltranslation/gt/commit/4976fc682c84fa95b7deace431b2235ca1fccf24)]:\n    -   gt-i18n@0.8.13\n    -   gt-react@10.19.12\n    -   @generaltranslation/react-core@1.8.14\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-05T21:16:34Z",
          "url": "https://github.com/generaltranslation/gt/commit/fbf59324128e1aff1533307d8f45c5c73c7a1835"
        },
        "date": 1778016254884,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.030530347234094878,
            "range": "±0.0135",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2054579897288423,
            "range": "±0.0757",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.3593660682471262,
            "range": "±0.0741",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.3552494382102257,
            "range": "±0.0677",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 163.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 196.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 286.3999999999942,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 129,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 119.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 592,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 89.69999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.23\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "c51c176c6e52fad68b16d26fae06330b94cbfda4",
          "message": "[ci] release (#1352)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-i18n@0.8.14\n\n### Patch Changes\n\n- [#1328](https://github.com/generaltranslation/gt/pull/1328)\n[`cb2e106`](https://github.com/generaltranslation/gt/commit/cb2e1066f975dce8e90b166c51f763a3778c3861)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary\nlookup.\n\n- [#1329](https://github.com/generaltranslation/gt/pull/1329)\n[`b907d87`](https://github.com/generaltranslation/gt/commit/b907d8799670e9e22355b5664da4c9f6f323b8f4)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary\ncache lifecycle events.\n\n- [#1346](https://github.com/generaltranslation/gt/pull/1346)\n[`bf0386b`](https://github.com/generaltranslation/gt/commit/bf0386b38b8a9342619eb2f8b4e5f043dcba4d8f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary\nmetadata entry types without applying metadata at lookup time.\n\n## gt-next@6.16.24\n\n### Patch Changes\n\n- [#1348](https://github.com/generaltranslation/gt/pull/1348)\n[`6307dea`](https://github.com/generaltranslation/gt/commit/6307deac200eab9d5a9b2bc4edca080d49e4c131)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Clarify Babel\ncompiler compatibility warnings for Turbopack and unsupported React\nversions.\n\n- Updated dependencies\n\\[[`cb2e106`](https://github.com/generaltranslation/gt/commit/cb2e1066f975dce8e90b166c51f763a3778c3861),\n[`b907d87`](https://github.com/generaltranslation/gt/commit/b907d8799670e9e22355b5664da4c9f6f323b8f4),\n[`bf0386b`](https://github.com/generaltranslation/gt/commit/bf0386b38b8a9342619eb2f8b4e5f043dcba4d8f)]:\n    -   gt-i18n@0.8.14\n    -   gt-react@10.19.13\n\n## @generaltranslation/gt-next-lint@14.0.24\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6307dea`](https://github.com/generaltranslation/gt/commit/6307deac200eab9d5a9b2bc4edca080d49e4c131)]:\n    -   gt-next@6.16.24\n\n## gt-node@0.6.14\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cb2e106`](https://github.com/generaltranslation/gt/commit/cb2e1066f975dce8e90b166c51f763a3778c3861),\n[`b907d87`](https://github.com/generaltranslation/gt/commit/b907d8799670e9e22355b5664da4c9f6f323b8f4),\n[`bf0386b`](https://github.com/generaltranslation/gt/commit/bf0386b38b8a9342619eb2f8b4e5f043dcba4d8f)]:\n    -   gt-i18n@0.8.14\n\n## gt-react@10.19.13\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cb2e106`](https://github.com/generaltranslation/gt/commit/cb2e1066f975dce8e90b166c51f763a3778c3861),\n[`b907d87`](https://github.com/generaltranslation/gt/commit/b907d8799670e9e22355b5664da4c9f6f323b8f4),\n[`bf0386b`](https://github.com/generaltranslation/gt/commit/bf0386b38b8a9342619eb2f8b4e5f043dcba4d8f)]:\n    -   gt-i18n@0.8.14\n    -   @generaltranslation/react-core@1.8.15\n\n## @generaltranslation/react-core@1.8.15\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cb2e106`](https://github.com/generaltranslation/gt/commit/cb2e1066f975dce8e90b166c51f763a3778c3861),\n[`b907d87`](https://github.com/generaltranslation/gt/commit/b907d8799670e9e22355b5664da4c9f6f323b8f4),\n[`bf0386b`](https://github.com/generaltranslation/gt/commit/bf0386b38b8a9342619eb2f8b4e5f043dcba4d8f)]:\n    -   gt-i18n@0.8.14\n\n## gt-react-native@10.19.13\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   @generaltranslation/react-core@1.8.15\n\n## gt-tanstack-start@0.4.17\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cb2e106`](https://github.com/generaltranslation/gt/commit/cb2e1066f975dce8e90b166c51f763a3778c3861),\n[`b907d87`](https://github.com/generaltranslation/gt/commit/b907d8799670e9e22355b5664da4c9f6f323b8f4),\n[`bf0386b`](https://github.com/generaltranslation/gt/commit/bf0386b38b8a9342619eb2f8b4e5f043dcba4d8f)]:\n    -   gt-i18n@0.8.14\n    -   gt-react@10.19.13\n    -   @generaltranslation/react-core@1.8.15\n\n<!-- codesmith:footer -->\n---\n<a\nhref=\"https://app.blacksmith.sh/generaltranslation/codesmith/gt/pr/1352\"><picture><source\nmedia=\"(prefers-color-scheme: dark)\"\nsrcset=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-dark.svg\"><source\nmedia=\"(prefers-color-scheme: light)\"\nsrcset=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-light.svg\"><img\nalt=\"View in Codesmith\"\nsrc=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-dark.svg\"></picture></a>\n<sup>Need help on this PR? Tag <code>@codesmith</code> with what you\nneed.</sup>\n\n- [ ] Let Codesmith autofix CI failures and bot reviews\n<!-- /codesmith:footer -->\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-06T19:29:03Z",
          "url": "https://github.com/generaltranslation/gt/commit/c51c176c6e52fad68b16d26fae06330b94cbfda4"
        },
        "date": 1778096178070,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.039719491063627876,
            "range": "±0.0158",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2418815094248413,
            "range": "±0.0683",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.422539521959459,
            "range": "±0.0642",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.41625341264559246,
            "range": "±0.063",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 160.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 171.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 268.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 128,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 29,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 119.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 612,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.700000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 56.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 134.60000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.24\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "aad691d483dd7cd5dfa68dbd555167c7f7efbd17",
          "message": "[ci] release (#1360)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-i18n@0.9.0\n\n### Minor Changes\n\n- [#1359](https://github.com/generaltranslation/gt/pull/1359)\n[`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Enable\ndictionary-backed getTranslations with t and t.obj, and expose it from\ngt-node.\n\n### Patch Changes\n\n- [#1354](https://github.com/generaltranslation/gt/pull/1354)\n[`663af94`](https://github.com/generaltranslation/gt/commit/663af94207bc244de30046d96130e913f48c9add)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary\nlookup with runtime fallback.\n\n- [#1355](https://github.com/generaltranslation/gt/pull/1355)\n[`a88c86d`](https://github.com/generaltranslation/gt/commit/a88c86df7842299063f1a2f6f7404e021c905016)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary\ncache object get and set primitives.\n\n- [#1358](https://github.com/generaltranslation/gt/pull/1358)\n[`0f252ff`](https://github.com/generaltranslation/gt/commit/0f252fff408c701811cba61565beaf15bf9cdd95)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary\nobject lookup with runtime fallback.\n\n- [#1356](https://github.com/generaltranslation/gt/pull/1356)\n[`ee3a6ee`](https://github.com/generaltranslation/gt/commit/ee3a6eea113fbc5c2f5f0e8771d878a305f7bc7f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add dictionary\nobject lookup on the i18n manager.\n\n- [#1357](https://github.com/generaltranslation/gt/pull/1357)\n[`375d75f`](https://github.com/generaltranslation/gt/commit/375d75f7a6525d83e19a5cf015a375a0f50537d2)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add runtime\nfallback primitives for dictionary object cache misses.\n\n- [#1349](https://github.com/generaltranslation/gt/pull/1349)\n[`e123485`](https://github.com/generaltranslation/gt/commit/e12348563700ed886f64b2e00d7964355fb4558a)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Return\ndictionary metadata from dictionary cache lookups.\n\n- [#1351](https://github.com/generaltranslation/gt/pull/1351)\n[`40e26b9`](https://github.com/generaltranslation/gt/commit/40e26b914295101d1be00f738fc33eb4ba9c495a)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add runtime\ntranslation fallback for dictionary cache misses.\n\n- Updated dependencies\n\\[[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:\n    -   generaltranslation@8.2.12\n    -   @generaltranslation/supported-locales@2.0.70\n\n## gt-node@0.7.0\n\n### Minor Changes\n\n- [#1359](https://github.com/generaltranslation/gt/pull/1359)\n[`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Enable\ndictionary-backed getTranslations with t and t.obj, and expose it from\ngt-node.\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`663af94`](https://github.com/generaltranslation/gt/commit/663af94207bc244de30046d96130e913f48c9add),\n[`a88c86d`](https://github.com/generaltranslation/gt/commit/a88c86df7842299063f1a2f6f7404e021c905016),\n[`0f252ff`](https://github.com/generaltranslation/gt/commit/0f252fff408c701811cba61565beaf15bf9cdd95),\n[`ee3a6ee`](https://github.com/generaltranslation/gt/commit/ee3a6eea113fbc5c2f5f0e8771d878a305f7bc7f),\n[`375d75f`](https://github.com/generaltranslation/gt/commit/375d75f7a6525d83e19a5cf015a375a0f50537d2),\n[`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0),\n[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0),\n[`e123485`](https://github.com/generaltranslation/gt/commit/e12348563700ed886f64b2e00d7964355fb4558a),\n[`40e26b9`](https://github.com/generaltranslation/gt/commit/40e26b914295101d1be00f738fc33eb4ba9c495a)]:\n    -   gt-i18n@0.9.0\n    -   generaltranslation@8.2.12\n\n## gt@2.14.33\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:\n    -   generaltranslation@8.2.12\n    -   @generaltranslation/python-extractor@0.2.18\n\n## @generaltranslation/compiler@1.3.20\n\n### Patch Changes\n\n- [#1342](https://github.com/generaltranslation/gt/pull/1342)\n[`6a255fb`](https://github.com/generaltranslation/gt/commit/6a255fb7ee440c88f6374fe14e7b0008e051d3a8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Auto-load\ngt.config.json for compiler plugins when no gtConfig option is passed.\n\n- Updated dependencies\n\\[[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:\n    -   generaltranslation@8.2.12\n\n## generaltranslation@8.2.12\n\n### Patch Changes\n\n- [#1364](https://github.com/generaltranslation/gt/pull/1364)\n[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)\nThanks [@pie575](https://github.com/pie575)! - Update Derive docs\ncomments\n\n## gtx-cli@2.14.33\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.33\n\n## locadex@1.0.168\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.33\n\n## gt-next@6.16.25\n\n### Patch Changes\n\n- [#1364](https://github.com/generaltranslation/gt/pull/1364)\n[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)\nThanks [@pie575](https://github.com/pie575)! - Update Derive docs\ncomments\n\n- Updated dependencies\n\\[[`6a255fb`](https://github.com/generaltranslation/gt/commit/6a255fb7ee440c88f6374fe14e7b0008e051d3a8),\n[`663af94`](https://github.com/generaltranslation/gt/commit/663af94207bc244de30046d96130e913f48c9add),\n[`a88c86d`](https://github.com/generaltranslation/gt/commit/a88c86df7842299063f1a2f6f7404e021c905016),\n[`0f252ff`](https://github.com/generaltranslation/gt/commit/0f252fff408c701811cba61565beaf15bf9cdd95),\n[`ee3a6ee`](https://github.com/generaltranslation/gt/commit/ee3a6eea113fbc5c2f5f0e8771d878a305f7bc7f),\n[`375d75f`](https://github.com/generaltranslation/gt/commit/375d75f7a6525d83e19a5cf015a375a0f50537d2),\n[`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0),\n[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0),\n[`e123485`](https://github.com/generaltranslation/gt/commit/e12348563700ed886f64b2e00d7964355fb4558a),\n[`40e26b9`](https://github.com/generaltranslation/gt/commit/40e26b914295101d1be00f738fc33eb4ba9c495a)]:\n    -   @generaltranslation/compiler@1.3.20\n    -   gt-i18n@0.9.0\n    -   gt-react@10.19.14\n    -   generaltranslation@8.2.12\n    -   @generaltranslation/supported-locales@2.0.70\n\n## @generaltranslation/gt-next-lint@14.0.25\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:\n    -   gt-next@6.16.25\n\n## @generaltranslation/python-extractor@0.2.18\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:\n    -   generaltranslation@8.2.12\n\n## gt-react@10.19.14\n\n### Patch Changes\n\n- [#1364](https://github.com/generaltranslation/gt/pull/1364)\n[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)\nThanks [@pie575](https://github.com/pie575)! - Update Derive docs\ncomments\n\n- Updated dependencies\n\\[[`663af94`](https://github.com/generaltranslation/gt/commit/663af94207bc244de30046d96130e913f48c9add),\n[`a88c86d`](https://github.com/generaltranslation/gt/commit/a88c86df7842299063f1a2f6f7404e021c905016),\n[`0f252ff`](https://github.com/generaltranslation/gt/commit/0f252fff408c701811cba61565beaf15bf9cdd95),\n[`ee3a6ee`](https://github.com/generaltranslation/gt/commit/ee3a6eea113fbc5c2f5f0e8771d878a305f7bc7f),\n[`375d75f`](https://github.com/generaltranslation/gt/commit/375d75f7a6525d83e19a5cf015a375a0f50537d2),\n[`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0),\n[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0),\n[`e123485`](https://github.com/generaltranslation/gt/commit/e12348563700ed886f64b2e00d7964355fb4558a),\n[`40e26b9`](https://github.com/generaltranslation/gt/commit/40e26b914295101d1be00f738fc33eb4ba9c495a)]:\n    -   gt-i18n@0.9.0\n    -   @generaltranslation/react-core@1.8.16\n    -   generaltranslation@8.2.12\n    -   @generaltranslation/supported-locales@2.0.70\n\n## @generaltranslation/react-core@1.8.16\n\n### Patch Changes\n\n- [#1364](https://github.com/generaltranslation/gt/pull/1364)\n[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)\nThanks [@pie575](https://github.com/pie575)! - Update Derive docs\ncomments\n\n- Updated dependencies\n\\[[`663af94`](https://github.com/generaltranslation/gt/commit/663af94207bc244de30046d96130e913f48c9add),\n[`a88c86d`](https://github.com/generaltranslation/gt/commit/a88c86df7842299063f1a2f6f7404e021c905016),\n[`0f252ff`](https://github.com/generaltranslation/gt/commit/0f252fff408c701811cba61565beaf15bf9cdd95),\n[`ee3a6ee`](https://github.com/generaltranslation/gt/commit/ee3a6eea113fbc5c2f5f0e8771d878a305f7bc7f),\n[`375d75f`](https://github.com/generaltranslation/gt/commit/375d75f7a6525d83e19a5cf015a375a0f50537d2),\n[`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0),\n[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0),\n[`e123485`](https://github.com/generaltranslation/gt/commit/e12348563700ed886f64b2e00d7964355fb4558a),\n[`40e26b9`](https://github.com/generaltranslation/gt/commit/40e26b914295101d1be00f738fc33eb4ba9c495a)]:\n    -   gt-i18n@0.9.0\n    -   generaltranslation@8.2.12\n    -   @generaltranslation/supported-locales@2.0.70\n\n## gt-react-native@10.19.14\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:\n    -   @generaltranslation/react-core@1.8.16\n    -   generaltranslation@8.2.12\n    -   @generaltranslation/supported-locales@2.0.70\n\n## gt-sanity@2.0.14\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:\n    -   generaltranslation@8.2.12\n\n## @generaltranslation/supported-locales@2.0.70\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0)]:\n    -   generaltranslation@8.2.12\n\n## gt-tanstack-start@0.4.18\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`663af94`](https://github.com/generaltranslation/gt/commit/663af94207bc244de30046d96130e913f48c9add),\n[`a88c86d`](https://github.com/generaltranslation/gt/commit/a88c86df7842299063f1a2f6f7404e021c905016),\n[`0f252ff`](https://github.com/generaltranslation/gt/commit/0f252fff408c701811cba61565beaf15bf9cdd95),\n[`ee3a6ee`](https://github.com/generaltranslation/gt/commit/ee3a6eea113fbc5c2f5f0e8771d878a305f7bc7f),\n[`375d75f`](https://github.com/generaltranslation/gt/commit/375d75f7a6525d83e19a5cf015a375a0f50537d2),\n[`528bb4a`](https://github.com/generaltranslation/gt/commit/528bb4a34b3eeab6f676137ab0f09e85dff213b0),\n[`9eae4d9`](https://github.com/generaltranslation/gt/commit/9eae4d93476688b621c739683c8bac64cbf50bf0),\n[`e123485`](https://github.com/generaltranslation/gt/commit/e12348563700ed886f64b2e00d7964355fb4558a),\n[`40e26b9`](https://github.com/generaltranslation/gt/commit/40e26b914295101d1be00f738fc33eb4ba9c495a)]:\n    -   gt-i18n@0.9.0\n    -   @generaltranslation/react-core@1.8.16\n    -   gt-react@10.19.14\n    -   generaltranslation@8.2.12\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-07T22:01:32Z",
          "url": "https://github.com/generaltranslation/gt/commit/aad691d483dd7cd5dfa68dbd555167c7f7efbd17"
        },
        "date": 1778191830344,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.031069446591685115,
            "range": "±0.0148",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.19740659139360436,
            "range": "±0.0642",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.3584894265232923,
            "range": "±0.0644",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.3559327715302407,
            "range": "±0.0661",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 158.89999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 171.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 268.0999999999767,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 131,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 24.399999999965075,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 33.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 121.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 587,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 12.299999999988358,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 94.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.25\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "7439ecda779d5f1ba2e00a0e95e1ba1137276bb8",
          "message": "[ci] release (#1371)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.34\n\n### Patch Changes\n\n- [#1385](https://github.com/generaltranslation/gt/pull/1385)\n[`bcb2b91`](https://github.com/generaltranslation/gt/commit/bcb2b91581d1edb134a451f9713c3a899e32282a)\nThanks [@bgub](https://github.com/bgub)! - Warn when duplicate source\nupdate IDs include hashless entries.\n\n- [#1379](https://github.com/generaltranslation/gt/pull/1379)\n[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7)\nThanks [@bgub](https://github.com/bgub)! - Tighten public and API\nmetadata types, and handle metadata entries without hashes in the CLI.\n\n- Updated dependencies\n\\[[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   generaltranslation@8.2.13\n    -   @generaltranslation/python-extractor@0.2.19\n\n## @generaltranslation/compiler@1.3.21\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   generaltranslation@8.2.13\n\n## generaltranslation@8.2.13\n\n### Patch Changes\n\n- [#1379](https://github.com/generaltranslation/gt/pull/1379)\n[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7)\nThanks [@bgub](https://github.com/bgub)! - Tighten public and API\nmetadata types, and handle metadata entries without hashes in the CLI.\n\n- [#1387](https://github.com/generaltranslation/gt/pull/1387)\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)\nThanks [@bgub](https://github.com/bgub)! - Reduce explicit any usage in\ncore and Next.js types.\n\n## gtx-cli@2.14.34\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`bcb2b91`](https://github.com/generaltranslation/gt/commit/bcb2b91581d1edb134a451f9713c3a899e32282a),\n[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7)]:\n    -   gt@2.14.34\n\n## gt-i18n@0.9.1\n\n### Patch Changes\n\n- [#1374](https://github.com/generaltranslation/gt/pull/1374)\n[`4d77edf`](https://github.com/generaltranslation/gt/commit/4d77edf7cb2bca5c20911c20c58f702803c9acc9)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - chore(gt-i18n):\nadd comment documentation for t.obj()\n\n- [#1380](https://github.com/generaltranslation/gt/pull/1380)\n[`feffb35`](https://github.com/generaltranslation/gt/commit/feffb35f75b3deee12e29878792461b8d32fad3e)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Export i18n\nmanager cache-miss event-name constants from `gt-i18n/internal` so\ndownstream packages such as `@generaltranslation/react-core` can consume\none shared source of truth.\n\n- [#1375](https://github.com/generaltranslation/gt/pull/1375)\n[`86263b3`](https://github.com/generaltranslation/gt/commit/86263b3aa8f2d283200515d609d69f570b97a84f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix dictionary\ngetTranslations fallback to use loaded translations when a target\ndictionary entry is missing.\n\n- Updated dependencies\n\\[[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   generaltranslation@8.2.13\n    -   @generaltranslation/supported-locales@2.0.71\n\n## locadex@1.0.169\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`bcb2b91`](https://github.com/generaltranslation/gt/commit/bcb2b91581d1edb134a451f9713c3a899e32282a),\n[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7)]:\n    -   gt@2.14.34\n\n## gt-next@6.16.26\n\n### Patch Changes\n\n- [#1386](https://github.com/generaltranslation/gt/pull/1386)\n[`f9f97a2`](https://github.com/generaltranslation/gt/commit/f9f97a2c1ce96fd79e50fa4bbd7d27139404bf06)\nThanks [@bgub](https://github.com/bgub)! - Preserve user Next config\ntypes when wrapping with GT config.\n\n- [#1387](https://github.com/generaltranslation/gt/pull/1387)\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)\nThanks [@bgub](https://github.com/bgub)! - Reduce explicit any usage in\ncore and Next.js types.\n\n- Updated dependencies\n\\[[`4d77edf`](https://github.com/generaltranslation/gt/commit/4d77edf7cb2bca5c20911c20c58f702803c9acc9),\n[`feffb35`](https://github.com/generaltranslation/gt/commit/feffb35f75b3deee12e29878792461b8d32fad3e),\n[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`86263b3`](https://github.com/generaltranslation/gt/commit/86263b3aa8f2d283200515d609d69f570b97a84f),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   gt-i18n@0.9.1\n    -   generaltranslation@8.2.13\n    -   gt-react@10.19.15\n    -   @generaltranslation/compiler@1.3.21\n    -   @generaltranslation/supported-locales@2.0.71\n\n## @generaltranslation/gt-next-lint@14.0.26\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`f9f97a2`](https://github.com/generaltranslation/gt/commit/f9f97a2c1ce96fd79e50fa4bbd7d27139404bf06),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   gt-next@6.16.26\n\n## gt-node@0.7.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`4d77edf`](https://github.com/generaltranslation/gt/commit/4d77edf7cb2bca5c20911c20c58f702803c9acc9),\n[`feffb35`](https://github.com/generaltranslation/gt/commit/feffb35f75b3deee12e29878792461b8d32fad3e),\n[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`86263b3`](https://github.com/generaltranslation/gt/commit/86263b3aa8f2d283200515d609d69f570b97a84f),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   gt-i18n@0.9.1\n    -   generaltranslation@8.2.13\n\n## @generaltranslation/python-extractor@0.2.19\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   generaltranslation@8.2.13\n\n## gt-react@10.19.15\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`4d77edf`](https://github.com/generaltranslation/gt/commit/4d77edf7cb2bca5c20911c20c58f702803c9acc9),\n[`feffb35`](https://github.com/generaltranslation/gt/commit/feffb35f75b3deee12e29878792461b8d32fad3e),\n[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`86263b3`](https://github.com/generaltranslation/gt/commit/86263b3aa8f2d283200515d609d69f570b97a84f),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   gt-i18n@0.9.1\n    -   generaltranslation@8.2.13\n    -   @generaltranslation/react-core@1.8.17\n    -   @generaltranslation/supported-locales@2.0.71\n\n## @generaltranslation/react-core@1.8.17\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`4d77edf`](https://github.com/generaltranslation/gt/commit/4d77edf7cb2bca5c20911c20c58f702803c9acc9),\n[`feffb35`](https://github.com/generaltranslation/gt/commit/feffb35f75b3deee12e29878792461b8d32fad3e),\n[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`86263b3`](https://github.com/generaltranslation/gt/commit/86263b3aa8f2d283200515d609d69f570b97a84f),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   gt-i18n@0.9.1\n    -   generaltranslation@8.2.13\n    -   @generaltranslation/supported-locales@2.0.71\n\n## gt-react-native@10.19.15\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   generaltranslation@8.2.13\n    -   @generaltranslation/react-core@1.8.17\n    -   @generaltranslation/supported-locales@2.0.71\n\n## gt-sanity@2.0.15\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   generaltranslation@8.2.13\n\n## @generaltranslation/supported-locales@2.0.71\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   generaltranslation@8.2.13\n\n## gt-tanstack-start@0.4.19\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`4d77edf`](https://github.com/generaltranslation/gt/commit/4d77edf7cb2bca5c20911c20c58f702803c9acc9),\n[`feffb35`](https://github.com/generaltranslation/gt/commit/feffb35f75b3deee12e29878792461b8d32fad3e),\n[`e88fd39`](https://github.com/generaltranslation/gt/commit/e88fd399683868d5af1fe2b0ba2974fe5b17d7a7),\n[`86263b3`](https://github.com/generaltranslation/gt/commit/86263b3aa8f2d283200515d609d69f570b97a84f),\n[`95f852a`](https://github.com/generaltranslation/gt/commit/95f852ae086ac79d2c446f4d3072d8fd18688796)]:\n    -   gt-i18n@0.9.1\n    -   generaltranslation@8.2.13\n    -   gt-react@10.19.15\n    -   @generaltranslation/react-core@1.8.17\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-08T22:03:56Z",
          "url": "https://github.com/generaltranslation/gt/commit/7439ecda779d5f1ba2e00a0e95e1ba1137276bb8"
        },
        "date": 1778278335176,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03994810833266726,
            "range": "±0.0151",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24665360059171393,
            "range": "±0.0581",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.44395125000000124,
            "range": "±0.102",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.41427246975972887,
            "range": "±0.0457",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 173,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 208.80000000004657,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 290,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 123,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.900000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.600000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 115,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 597,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 12,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 26.399999999965075,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 108.89999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.26\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "16a03175ca32bc556258bed535bd2d84b25effc1",
          "message": "[ci] release (#1406)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## @generaltranslation/format@0.1.0\n\n### Minor Changes\n\n- [#1397](https://github.com/generaltranslation/gt/pull/1397)\n[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99)\nThanks [@bgub](https://github.com/bgub)! - Extract locale and formatting\nprimitives into the new `@generaltranslation/format` package and update\n`generaltranslation/core` to re-export the shared helpers.\n\n## gt@2.14.35\n\n### Patch Changes\n\n- [#1408](https://github.com/generaltranslation/gt/pull/1408)\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)\nThanks [@bgub](https://github.com/bgub)! - Use\n@generaltranslation/format directly for shared formatting and locale\nhelpers.\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:\n    -   @generaltranslation/format@0.1.0\n    -   generaltranslation@8.2.14\n    -   @generaltranslation/python-extractor@0.2.20\n\n## @generaltranslation/compiler@1.3.22\n\n### Patch Changes\n\n- [#1408](https://github.com/generaltranslation/gt/pull/1408)\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)\nThanks [@bgub](https://github.com/bgub)! - Use\n@generaltranslation/format directly for shared formatting and locale\nhelpers.\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:\n    -   @generaltranslation/format@0.1.0\n    -   generaltranslation@8.2.14\n\n## generaltranslation@8.2.14\n\n### Patch Changes\n\n- [#1397](https://github.com/generaltranslation/gt/pull/1397)\n[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99)\nThanks [@bgub](https://github.com/bgub)! - Extract locale and formatting\nprimitives into the new `@generaltranslation/format` package and update\n`generaltranslation/core` to re-export the shared helpers.\n\n- [#1408](https://github.com/generaltranslation/gt/pull/1408)\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)\nThanks [@bgub](https://github.com/bgub)! - Use\n@generaltranslation/format directly for shared formatting and locale\nhelpers.\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99)]:\n    -   @generaltranslation/format@0.1.0\n\n## gtx-cli@2.14.35\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:\n    -   gt@2.14.35\n\n## gt-i18n@0.9.2\n\n### Patch Changes\n\n- [#1397](https://github.com/generaltranslation/gt/pull/1397)\n[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99)\nThanks [@bgub](https://github.com/bgub)! - Extract locale and formatting\nprimitives into the new `@generaltranslation/format` package and update\n`generaltranslation/core` to re-export the shared helpers.\n\n- [#1409](https://github.com/generaltranslation/gt/pull/1409)\n[`8650ae9`](https://github.com/generaltranslation/gt/commit/8650ae9ced69755bf3eebc1bafdf7743ba0c5136)\nThanks [@bgub](https://github.com/bgub)! - Prevent callers from mutating\ninternal translation caches through `getInternalCache()` and start\nlocale cache TTLs after async loads complete.\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:\n    -   @generaltranslation/format@0.1.0\n    -   generaltranslation@8.2.14\n    -   @generaltranslation/supported-locales@2.0.72\n\n## locadex@1.0.170\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:\n    -   gt@2.14.35\n\n## gt-next@6.16.27\n\n### Patch Changes\n\n- [#1408](https://github.com/generaltranslation/gt/pull/1408)\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)\nThanks [@bgub](https://github.com/bgub)! - Use\n@generaltranslation/format directly for shared formatting and locale\nhelpers.\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6),\n[`8650ae9`](https://github.com/generaltranslation/gt/commit/8650ae9ced69755bf3eebc1bafdf7743ba0c5136)]:\n    -   @generaltranslation/format@0.1.0\n    -   generaltranslation@8.2.14\n    -   gt-i18n@0.9.2\n    -   gt-react@10.19.16\n    -   @generaltranslation/compiler@1.3.22\n    -   @generaltranslation/supported-locales@2.0.72\n\n## @generaltranslation/gt-next-lint@14.0.27\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:\n    -   gt-next@6.16.27\n\n## gt-node@0.7.2\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6),\n[`8650ae9`](https://github.com/generaltranslation/gt/commit/8650ae9ced69755bf3eebc1bafdf7743ba0c5136)]:\n    -   generaltranslation@8.2.14\n    -   gt-i18n@0.9.2\n\n## @generaltranslation/python-extractor@0.2.20\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:\n    -   generaltranslation@8.2.14\n\n## gt-react@10.19.16\n\n### Patch Changes\n\n- [#1408](https://github.com/generaltranslation/gt/pull/1408)\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)\nThanks [@bgub](https://github.com/bgub)! - Use\n@generaltranslation/format directly for shared formatting and locale\nhelpers.\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6),\n[`8650ae9`](https://github.com/generaltranslation/gt/commit/8650ae9ced69755bf3eebc1bafdf7743ba0c5136),\n[`6e6c69e`](https://github.com/generaltranslation/gt/commit/6e6c69e3ca2f51937407674cf101b69e968952a1)]:\n    -   @generaltranslation/format@0.1.0\n    -   generaltranslation@8.2.14\n    -   gt-i18n@0.9.2\n    -   @generaltranslation/react-core@1.8.18\n    -   @generaltranslation/supported-locales@2.0.72\n\n## @generaltranslation/react-core@1.8.18\n\n### Patch Changes\n\n- [#1408](https://github.com/generaltranslation/gt/pull/1408)\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)\nThanks [@bgub](https://github.com/bgub)! - Use\n@generaltranslation/format directly for shared formatting and locale\nhelpers.\n\n- [#1415](https://github.com/generaltranslation/gt/pull/1415)\n[`6e6c69e`](https://github.com/generaltranslation/gt/commit/6e6c69e3ca2f51937407674cf101b69e968952a1)\nThanks [@bgub](https://github.com/bgub)! - Switch the React Core package\nbuild pipeline to tsdown while preserving the existing public\nentrypoints.\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6),\n[`8650ae9`](https://github.com/generaltranslation/gt/commit/8650ae9ced69755bf3eebc1bafdf7743ba0c5136)]:\n    -   @generaltranslation/format@0.1.0\n    -   generaltranslation@8.2.14\n    -   gt-i18n@0.9.2\n    -   @generaltranslation/supported-locales@2.0.72\n\n## gt-react-native@10.19.16\n\n### Patch Changes\n\n- [#1408](https://github.com/generaltranslation/gt/pull/1408)\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)\nThanks [@bgub](https://github.com/bgub)! - Use\n@generaltranslation/format directly for shared formatting and locale\nhelpers.\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6),\n[`6e6c69e`](https://github.com/generaltranslation/gt/commit/6e6c69e3ca2f51937407674cf101b69e968952a1)]:\n    -   @generaltranslation/format@0.1.0\n    -   generaltranslation@8.2.14\n    -   @generaltranslation/react-core@1.8.18\n    -   @generaltranslation/supported-locales@2.0.72\n\n## gt-sanity@2.0.16\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:\n    -   generaltranslation@8.2.14\n\n## @generaltranslation/supported-locales@2.0.72\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6)]:\n    -   generaltranslation@8.2.14\n\n## gt-tanstack-start@0.4.20\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`73f3ac1`](https://github.com/generaltranslation/gt/commit/73f3ac1308df11c1e6230c13c1999bfc5f6afc99),\n[`425d3e4`](https://github.com/generaltranslation/gt/commit/425d3e4e6c61afd108c65c27f7693ba2470b33c6),\n[`8650ae9`](https://github.com/generaltranslation/gt/commit/8650ae9ced69755bf3eebc1bafdf7743ba0c5136),\n[`6e6c69e`](https://github.com/generaltranslation/gt/commit/6e6c69e3ca2f51937407674cf101b69e968952a1)]:\n    -   generaltranslation@8.2.14\n    -   gt-i18n@0.9.2\n    -   @generaltranslation/react-core@1.8.18\n    -   gt-react@10.19.16\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-12T18:23:38Z",
          "url": "https://github.com/generaltranslation/gt/commit/16a03175ca32bc556258bed535bd2d84b25effc1"
        },
        "date": 1778610697976,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.0300581275163754,
            "range": "±0.0123",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.1983500194367333,
            "range": "±0.0625",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.3541163229461769,
            "range": "±0.0571",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.36117970974729696,
            "range": "±0.0757",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 165.30000000001746,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 180.80000000001746,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 273.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 115,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 23.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 35.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 106.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 607,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.300000000017462,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 89.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.27\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "daa09614e6ffffd0e72afbaa03cb38e3b144d96d",
          "message": "[ci] release (#1418)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.36\n\n### Patch Changes\n\n- [#1363](https://github.com/generaltranslation/gt/pull/1363)\n[`6a0e55b`](https://github.com/generaltranslation/gt/commit/6a0e55b6787b8e05f6c1fef7796e1b8b68f6d87b)\nThanks [@bgub](https://github.com/bgub)! - Add an Ink-powered\nfull-screen setup wizard for interactive CLI prompts.\n\n- [#1419](https://github.com/generaltranslation/gt/pull/1419)\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)\nThanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages\nand package-local diagnostic formatting.\n\n- [#1423](https://github.com/generaltranslation/gt/pull/1423)\n[`347cb48`](https://github.com/generaltranslation/gt/commit/347cb4844bba2007c7942f3f0e6a2ede4a1aa73e)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Suppress\nunnecessary project detection warnings for file-only translations.\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   @generaltranslation/format@0.1.1\n    -   generaltranslation@8.2.15\n    -   @generaltranslation/python-extractor@0.2.21\n    -   @generaltranslation/supported-locales@2.0.73\n\n## @generaltranslation/compiler@1.3.23\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   @generaltranslation/format@0.1.1\n    -   generaltranslation@8.2.15\n\n## generaltranslation@8.2.15\n\n### Patch Changes\n\n- [#1416](https://github.com/generaltranslation/gt/pull/1416)\n[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa)\nThanks [@bgub](https://github.com/bgub)! - Honor custom locale region\ndisplay-name overrides and simplify shared locale formatting helpers.\n\n- [#1419](https://github.com/generaltranslation/gt/pull/1419)\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)\nThanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages\nand package-local diagnostic formatting.\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa)]:\n    -   @generaltranslation/format@0.1.1\n\n## @generaltranslation/format@0.1.1\n\n### Patch Changes\n\n- [#1416](https://github.com/generaltranslation/gt/pull/1416)\n[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa)\nThanks [@bgub](https://github.com/bgub)! - Honor custom locale region\ndisplay-name overrides and simplify shared locale formatting helpers.\n\n## gtx-cli@2.14.36\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6a0e55b`](https://github.com/generaltranslation/gt/commit/6a0e55b6787b8e05f6c1fef7796e1b8b68f6d87b),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300),\n[`347cb48`](https://github.com/generaltranslation/gt/commit/347cb4844bba2007c7942f3f0e6a2ede4a1aa73e)]:\n    -   gt@2.14.36\n\n## gt-i18n@0.9.3\n\n### Patch Changes\n\n- [#1419](https://github.com/generaltranslation/gt/pull/1419)\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)\nThanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages\nand package-local diagnostic formatting.\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   @generaltranslation/format@0.1.1\n    -   generaltranslation@8.2.15\n    -   @generaltranslation/supported-locales@2.0.73\n\n## locadex@1.0.171\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`6a0e55b`](https://github.com/generaltranslation/gt/commit/6a0e55b6787b8e05f6c1fef7796e1b8b68f6d87b),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300),\n[`347cb48`](https://github.com/generaltranslation/gt/commit/347cb4844bba2007c7942f3f0e6a2ede4a1aa73e)]:\n    -   gt@2.14.36\n\n## gt-next@6.16.28\n\n### Patch Changes\n\n- [#1419](https://github.com/generaltranslation/gt/pull/1419)\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)\nThanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages\nand package-local diagnostic formatting.\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   @generaltranslation/format@0.1.1\n    -   generaltranslation@8.2.15\n    -   gt-i18n@0.9.3\n    -   gt-react@10.19.17\n    -   @generaltranslation/compiler@1.3.23\n    -   @generaltranslation/supported-locales@2.0.73\n\n## @generaltranslation/gt-next-lint@14.0.28\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   gt-next@6.16.28\n\n## gt-node@0.7.3\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   generaltranslation@8.2.15\n    -   gt-i18n@0.9.3\n\n## @generaltranslation/python-extractor@0.2.21\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   generaltranslation@8.2.15\n\n## gt-react@10.19.17\n\n### Patch Changes\n\n- [#1419](https://github.com/generaltranslation/gt/pull/1419)\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)\nThanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages\nand package-local diagnostic formatting.\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   @generaltranslation/format@0.1.1\n    -   generaltranslation@8.2.15\n    -   gt-i18n@0.9.3\n    -   @generaltranslation/react-core@1.8.19\n    -   @generaltranslation/supported-locales@2.0.73\n\n## @generaltranslation/react-core@1.8.19\n\n### Patch Changes\n\n- [#1419](https://github.com/generaltranslation/gt/pull/1419)\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)\nThanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages\nand package-local diagnostic formatting.\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   @generaltranslation/format@0.1.1\n    -   generaltranslation@8.2.15\n    -   gt-i18n@0.9.3\n    -   @generaltranslation/supported-locales@2.0.73\n\n## gt-react-native@10.19.17\n\n### Patch Changes\n\n- [#1419](https://github.com/generaltranslation/gt/pull/1419)\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)\nThanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages\nand package-local diagnostic formatting.\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   @generaltranslation/format@0.1.1\n    -   generaltranslation@8.2.15\n    -   @generaltranslation/react-core@1.8.19\n    -   @generaltranslation/supported-locales@2.0.73\n\n## gt-sanity@2.0.17\n\n### Patch Changes\n\n- [#1419](https://github.com/generaltranslation/gt/pull/1419)\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)\nThanks [@bgub](https://github.com/bgub)! - Improve diagnostic messages\nand package-local diagnostic formatting.\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   generaltranslation@8.2.15\n\n## @generaltranslation/supported-locales@2.0.73\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   generaltranslation@8.2.15\n\n## gt-tanstack-start@0.4.21\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`bb3624e`](https://github.com/generaltranslation/gt/commit/bb3624e58546c334c04370a1f5a262238bd040fa),\n[`a877a2a`](https://github.com/generaltranslation/gt/commit/a877a2a5bd5ca47b199c6caf53a6d60d96e3a300)]:\n    -   generaltranslation@8.2.15\n    -   gt-i18n@0.9.3\n    -   @generaltranslation/react-core@1.8.19\n    -   gt-react@10.19.17\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-14T00:32:54Z",
          "url": "https://github.com/generaltranslation/gt/commit/daa09614e6ffffd0e72afbaa03cb38e3b144d96d"
        },
        "date": 1778719251897,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03223479216090786,
            "range": "±0.0109",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.19850058475585752,
            "range": "±0.0612",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.3653005639152679,
            "range": "±0.0658",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.36866755858511013,
            "range": "±0.0758",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 154.80000000001746,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 164.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 233.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 165,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 23.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 45,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 144.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 596,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 25.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 110.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.28\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "c8ed2e761d64d2107a71a4a475a2b41d49a94cac",
          "message": "[ci] release (#1440)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## @generaltranslation/supported-locales@2.1.0\n\n### Minor Changes\n\n- [#1429](https://github.com/generaltranslation/gt/pull/1429)\n[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)\nThanks [@bgub](https://github.com/bgub)! - Add Esperanto to the\nsupported locales list.\n\n## gt@2.14.38\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:\n    -   @generaltranslation/supported-locales@2.1.0\n\n## gtx-cli@2.14.38\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.38\n\n## gt-i18n@0.9.4\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:\n    -   @generaltranslation/supported-locales@2.1.0\n\n## locadex@1.0.173\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.38\n\n## gt-next@6.16.29\n\n### Patch Changes\n\n- [#1437](https://github.com/generaltranslation/gt/pull/1437)\n[`fd61c44`](https://github.com/generaltranslation/gt/commit/fd61c4487a790e0802021478986b8c5b3dc0fb2b)\nThanks [@bgub](https://github.com/bgub)! - Deprecate\n`experimentalLocaleResolution` and update cache components warnings to\nrecommend explicit custom `getLocale.ts` and `getRegion.ts` request\nfunctions instead of automatic root parameter detection.\n\n- Updated dependencies\n\\[[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:\n    -   @generaltranslation/supported-locales@2.1.0\n    -   gt-i18n@0.9.4\n    -   gt-react@10.19.18\n\n## @generaltranslation/gt-next-lint@14.0.29\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`fd61c44`](https://github.com/generaltranslation/gt/commit/fd61c4487a790e0802021478986b8c5b3dc0fb2b)]:\n    -   gt-next@6.16.29\n\n## gt-node@0.7.4\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-i18n@0.9.4\n\n## gt-react@10.19.18\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:\n    -   @generaltranslation/supported-locales@2.1.0\n    -   gt-i18n@0.9.4\n    -   @generaltranslation/react-core@1.8.20\n\n## @generaltranslation/react-core@1.8.20\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:\n    -   @generaltranslation/supported-locales@2.1.0\n    -   gt-i18n@0.9.4\n\n## gt-react-native@10.19.18\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`cc4edc1`](https://github.com/generaltranslation/gt/commit/cc4edc1e40d9977125bf6d053fb7f8cdbdd40b05)]:\n    -   @generaltranslation/supported-locales@2.1.0\n    -   @generaltranslation/react-core@1.8.20\n\n## gt-tanstack-start@0.4.22\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-i18n@0.9.4\n    -   gt-react@10.19.18\n    -   @generaltranslation/react-core@1.8.20\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-18T23:54:06Z",
          "url": "https://github.com/generaltranslation/gt/commit/c8ed2e761d64d2107a71a4a475a2b41d49a94cac"
        },
        "date": 1779148882262,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03978625930935709,
            "range": "±0.0146",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.23901073087954022,
            "range": "±0.0508",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4119969678747976,
            "range": "±0.0484",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4178140208855492,
            "range": "±0.0743",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 167.39999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 177.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 272,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 101,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 16.900000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 92.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 604,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 16.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 36.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 133,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.29\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "142e480abb48be7fd9aefa340f3f034467a3dac3",
          "message": "[ci] release (#1461)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.41\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n    -   @generaltranslation/python-extractor@0.2.22\n    -   @generaltranslation/supported-locales@2.1.1\n\n## @generaltranslation/compiler@1.3.24\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n\n## generaltranslation@8.2.16\n\n### Patch Changes\n\n- [#1460](https://github.com/generaltranslation/gt/pull/1460)\n[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - fix: escape\ncharacters in declareVar() for source locale consumed by condenseVars()\n\n## gtx-cli@2.14.41\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.41\n\n## gt-i18n@0.9.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n    -   @generaltranslation/supported-locales@2.1.1\n\n## locadex@1.0.176\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt@2.14.41\n\n## gt-next@6.16.30\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n    -   @generaltranslation/compiler@1.3.24\n    -   gt-i18n@0.9.5\n    -   gt-react@10.19.19\n    -   @generaltranslation/supported-locales@2.1.1\n\n## @generaltranslation/gt-next-lint@14.0.30\n\n### Patch Changes\n\n-   Updated dependencies \\[]:\n    -   gt-next@6.16.30\n\n## gt-node@0.7.5\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n    -   gt-i18n@0.9.5\n\n## @generaltranslation/python-extractor@0.2.22\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n\n## gt-react@10.19.19\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n    -   gt-i18n@0.9.5\n    -   @generaltranslation/react-core@1.8.21\n    -   @generaltranslation/supported-locales@2.1.1\n\n## @generaltranslation/react-core@1.8.21\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n    -   gt-i18n@0.9.5\n    -   @generaltranslation/supported-locales@2.1.1\n\n## gt-react-native@10.19.19\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n    -   @generaltranslation/react-core@1.8.21\n    -   @generaltranslation/supported-locales@2.1.1\n\n## gt-sanity@2.0.18\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n\n## @generaltranslation/supported-locales@2.1.1\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n\n## gt-tanstack-start@0.4.23\n\n### Patch Changes\n\n- Updated dependencies\n\\[[`e041312`](https://github.com/generaltranslation/gt/commit/e04131263dd61e469db977bcc196dc1283e773d0)]:\n    -   generaltranslation@8.2.16\n    -   gt-i18n@0.9.5\n    -   gt-react@10.19.19\n    -   @generaltranslation/react-core@1.8.21\n\n<!-- codesmith:footer -->\n---\n<a\nhref=\"https://app.blacksmith.sh/generaltranslation/codesmith/gt/pr/1461\"><picture><source\nmedia=\"(prefers-color-scheme: dark)\"\nsrcset=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-dark.svg\"><source\nmedia=\"(prefers-color-scheme: light)\"\nsrcset=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-light.svg\"><img\nalt=\"View in Codesmith\"\nsrc=\"https://pr-comments-assets.blacksmith.sh/codesmith/view-in-codesmith-dark.svg\"></picture></a>\n<sup>Need help on this PR? Tag <code>@codesmith</code> with what you\nneed.</sup>\n\n- [ ] Let Codesmith autofix CI failures and bot reviews\n<!-- /codesmith:footer -->\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-05-20T00:06:32Z",
          "url": "https://github.com/generaltranslation/gt/commit/142e480abb48be7fd9aefa340f3f034467a3dac3"
        },
        "date": 1779236069689,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03969847288606568,
            "range": "±0.0147",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24055318566618777,
            "range": "±0.0638",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4121732677100474,
            "range": "±0.0601",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.409175311529031,
            "range": "±0.0639",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 166,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 177,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 269.5999999999767,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 136,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 117.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 585,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 15.299999999988358,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 38.09999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 130.19999999995343,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.30\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "c1ad1f71138edb4b8fc39a6e7f9630cf191b634e",
          "message": "[ci] release (#1781)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gtx-cli@2.14.57\n\n### Patch Changes\n\n- [#1768](https://github.com/generaltranslation/gt/pull/1768)\n[`da5385f`](https://github.com/generaltranslation/gt/commit/da5385f6ce6497c542a68d4c9207ce2bd0aa2a25)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retry main\nreleases that were blocked by recent release workflow failures.\n\n- Updated dependencies []:\n  - gt@2.14.57\n## locadex@1.0.192\n\n### Patch Changes\n\n- Updated dependencies []:\n  - gt@2.14.57\n## gt-next@6.16.36\n\n### Patch Changes\n\n- [#1768](https://github.com/generaltranslation/gt/pull/1768)\n[`da5385f`](https://github.com/generaltranslation/gt/commit/da5385f6ce6497c542a68d4c9207ce2bd0aa2a25)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retry main\nreleases that were blocked by recent release workflow failures.\n\n- [#1729](https://github.com/generaltranslation/gt/pull/1729)\n[`3b389dc`](https://github.com/generaltranslation/gt/commit/3b389dc08f3d86e2cea91a25e22840c188328d94)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fallback to the\ndefault locale when request locale resolution returns an invalid or\nunsupported locale. This prevents request-derived locale values from\ncausing runtime errors, and adds `isLocaleSupported()` to\n`gt-next/server` for apps that want to explicitly reject invalid locale\nroute params.\n## @generaltranslation/gt-next-lint@14.0.36\n\n### Patch Changes\n\n- Updated dependencies\n[[`da5385f`](https://github.com/generaltranslation/gt/commit/da5385f6ce6497c542a68d4c9207ce2bd0aa2a25),\n[`3b389dc`](https://github.com/generaltranslation/gt/commit/3b389dc08f3d86e2cea91a25e22840c188328d94)]:\n  - gt-next@6.16.36\n## gt@2.14.57\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-02T02:47:46Z",
          "url": "https://github.com/generaltranslation/gt/commit/c1ad1f71138edb4b8fc39a6e7f9630cf191b634e"
        },
        "date": 1782960886434,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04046790061508516,
            "range": "±0.0146",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2378862825880129,
            "range": "±0.0626",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4119479654036268,
            "range": "±0.0616",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.40661993739837876,
            "range": "±0.0572",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 164.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 175.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 269.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 128,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 17.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 119.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 610,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 16,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 36.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 132.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.36\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "46019049431c78d0348bba42c5b69189f097c135",
          "message": "[ci] release (#1797)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.58\n\n### Patch Changes\n\n- [#1786](https://github.com/generaltranslation/gt/pull/1786)\n[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add\n`requiresReview`\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - generaltranslation@8.2.19\n  - @generaltranslation/python-extractor@0.2.25\n  - @generaltranslation/supported-locales@2.1.5\n## @generaltranslation/compiler@1.3.27\n\n### Patch Changes\n\n- [#1786](https://github.com/generaltranslation/gt/pull/1786)\n[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add\n`requiresReview`\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - generaltranslation@8.2.19\n## generaltranslation@8.2.19\n\n### Patch Changes\n\n- [#1786](https://github.com/generaltranslation/gt/pull/1786)\n[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add\n`requiresReview`\n## gtx-cli@2.14.58\n\n### Patch Changes\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - gt@2.14.58\n## gt-i18n@0.9.9\n\n### Patch Changes\n\n- [#1786](https://github.com/generaltranslation/gt/pull/1786)\n[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add\n`requiresReview`\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - generaltranslation@8.2.19\n  - @generaltranslation/supported-locales@2.1.5\n## locadex@1.0.193\n\n### Patch Changes\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - gt@2.14.58\n## gt-next@6.16.37\n\n### Patch Changes\n\n- [#1796](https://github.com/generaltranslation/gt/pull/1796)\n[`9f305a9`](https://github.com/generaltranslation/gt/commit/9f305a9209acbc773015e187a7da0c5c10083a52)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add a\nwithGTConfig flag for disabling invalid request locale warnings.\n\n- [#1786](https://github.com/generaltranslation/gt/pull/1786)\n[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add\n`requiresReview`\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - @generaltranslation/compiler@1.3.27\n  - generaltranslation@8.2.19\n  - gt-i18n@0.9.9\n  - gt-react@10.20.5\n  - @generaltranslation/supported-locales@2.1.5\n## @generaltranslation/gt-next-lint@14.0.37\n\n### Patch Changes\n\n- Updated dependencies\n[[`9f305a9`](https://github.com/generaltranslation/gt/commit/9f305a9209acbc773015e187a7da0c5c10083a52),\n[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - gt-next@6.16.37\n## gt-node@0.7.9\n\n### Patch Changes\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - generaltranslation@8.2.19\n  - gt-i18n@0.9.9\n## @generaltranslation/python-extractor@0.2.25\n\n### Patch Changes\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - generaltranslation@8.2.19\n## gt-react@10.20.5\n\n### Patch Changes\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - @generaltranslation/react-core@1.8.25\n  - generaltranslation@8.2.19\n  - gt-i18n@0.9.9\n  - @generaltranslation/supported-locales@2.1.5\n## @generaltranslation/react-core@1.8.25\n\n### Patch Changes\n\n- [#1786](https://github.com/generaltranslation/gt/pull/1786)\n[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add\n`requiresReview`\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - generaltranslation@8.2.19\n  - gt-i18n@0.9.9\n  - @generaltranslation/supported-locales@2.1.5\n## @generaltranslation/react-core-linter@0.1.10\n\n### Patch Changes\n\n- [#1786](https://github.com/generaltranslation/gt/pull/1786)\n[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add\n`requiresReview`\n## gt-react-native@10.20.5\n\n### Patch Changes\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - @generaltranslation/react-core@1.8.25\n  - generaltranslation@8.2.19\n  - @generaltranslation/supported-locales@2.1.5\n## gt-sanity@2.0.21\n\n### Patch Changes\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - generaltranslation@8.2.19\n## @generaltranslation/supported-locales@2.1.5\n\n### Patch Changes\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - generaltranslation@8.2.19\n## gt-tanstack-start@0.4.29\n\n### Patch Changes\n\n- Updated dependencies\n[[`6945a98`](https://github.com/generaltranslation/gt/commit/6945a9871ea260dd999dcb2246c48b21134721f6)]:\n  - @generaltranslation/react-core@1.8.25\n  - generaltranslation@8.2.19\n  - gt-i18n@0.9.9\n  - gt-react@10.20.5\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-02T22:48:23Z",
          "url": "https://github.com/generaltranslation/gt/commit/46019049431c78d0348bba42c5b69189f097c135"
        },
        "date": 1783032973147,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.032293688626234794,
            "range": "±0.0126",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.19628225784929434,
            "range": "±0.057",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.3625985612762873,
            "range": "±0.0618",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.365862291880032,
            "range": "±0.0782",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 155.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 174.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 256.6000000000058,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 146,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 24.60000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 41.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 138.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 575,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 103.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"6.16.37\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "858323a771aeae10c735d0b4076e11c9e3d096a1",
          "message": "[ci] release (#1837)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n\n> The changelog information of each package has been omitted from this\nmessage, as the content exceeds the size limit.\n\n## generaltranslation@9.0.0\n\n\n## gt-i18n@1.0.0\n\n\n## gt-next@11.0.0\n\n\n## gt-node@1.0.0\n\n\n## gt-react@11.0.0\n\n\n## @generaltranslation/react-core@11.0.0\n\n\n## gt-react-native@11.0.0\n\n\n## gt-tanstack-start@11.0.0\n\n\n## gt@2.14.51\n\n\n## @generaltranslation/compiler@1.3.25\n\n\n## @generaltranslation/format@0.1.2\n\n\n## gtx-cli@2.14.51\n\n\n## locadex@1.0.186\n\n\n## @generaltranslation/mcp@1.0.8\n\n\n## @generaltranslation/python-extractor@0.2.23\n\n\n## @generaltranslation/react-core-linter@0.1.10\n\n\n## gt-remark@1.0.11\n\n\n## gt-sanity@2.0.18\n\n\n## @generaltranslation/supported-locales@2.1.2",
          "timestamp": "2026-07-04T02:29:30Z",
          "url": "https://github.com/generaltranslation/gt/commit/858323a771aeae10c735d0b4076e11c9e3d096a1"
        },
        "date": 1783132580991,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04745846649582348,
            "range": "±0.0339",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24487959990205507,
            "range": "±0.0785",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.4210137457912453,
            "range": "±0.0767",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.42658838789430253,
            "range": "±0.0934",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 145.69999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 158,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 233.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 119,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 20.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 30.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 99.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 627,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.60000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 110.30000000001746,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.0\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "fefa2f7a09dda89eb3aacba54dd4790c4b950263",
          "message": "[ci] release (#1839)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.52\n\n### Patch Changes\n\n- [#1838](https://github.com/generaltranslation/gt/pull/1838)\n[`b4ef241`](https://github.com/generaltranslation/gt/commit/b4ef2412635f7bc64886b8babde475c6ea1c3503)\nThanks [@bgub](https://github.com/bgub)! - Move `@babel/types` from\n`devDependencies` to `dependencies`. The CLI imports `@babel/types` at\nruntime across its parsing/JSX-injection code, but it was only declared\nas a dev dependency and left external in the published build. On\nstrict/isolated installs (e.g. pnpm on Vercel) consumers hit\n`ERR_MODULE_NOT_FOUND: Cannot find package '@babel/types'` when running\n`gtx-cli translate`. It now sits alongside the other `@babel/*` runtime\ndependencies so it is installed for consumers.\n\n- Updated dependencies\n[[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)]:\n  - @generaltranslation/supported-locales@2.1.3\n## gtx-cli@2.14.52\n\n### Patch Changes\n\n- Updated dependencies\n[[`b4ef241`](https://github.com/generaltranslation/gt/commit/b4ef2412635f7bc64886b8babde475c6ea1c3503)]:\n  - gt@2.14.52\n## gt-i18n@1.0.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)]:\n  - @generaltranslation/supported-locales@2.1.3\n## locadex@1.0.187\n\n### Patch Changes\n\n- Updated dependencies\n[[`b4ef241`](https://github.com/generaltranslation/gt/commit/b4ef2412635f7bc64886b8babde475c6ea1c3503)]:\n  - gt@2.14.52\n## gt-next@11.0.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)]:\n  - @generaltranslation/supported-locales@2.1.3\n  - gt-i18n@1.0.1\n  - gt-react@11.0.1\n  - @generaltranslation/react-core@11.0.1\n## gt-node@1.0.1\n\n### Patch Changes\n\n- Updated dependencies []:\n  - gt-i18n@1.0.1\n## gt-react@11.0.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)]:\n  - @generaltranslation/supported-locales@2.1.3\n  - gt-i18n@1.0.1\n  - @generaltranslation/react-core@11.0.1\n## @generaltranslation/react-core@11.0.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)]:\n  - @generaltranslation/supported-locales@2.1.3\n  - gt-i18n@1.0.1\n## gt-react-native@11.0.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)]:\n  - @generaltranslation/supported-locales@2.1.3\n  - gt-i18n@1.0.1\n  - @generaltranslation/react-core@11.0.1\n## @generaltranslation/supported-locales@2.1.3\n\n### Patch Changes\n\n- [#1840](https://github.com/generaltranslation/gt/pull/1840)\n[`7db86bd`](https://github.com/generaltranslation/gt/commit/7db86bd92be5d09a2da10133dbb873248b0e5a5c)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Expand\nsupported locales\n## gt-tanstack-start@11.0.1\n\n### Patch Changes\n\n- Updated dependencies []:\n  - gt-i18n@1.0.1\n  - gt-react@11.0.1\n  - @generaltranslation/react-core@11.0.1\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-09T18:56:14Z",
          "url": "https://github.com/generaltranslation/gt/commit/fefa2f7a09dda89eb3aacba54dd4790c4b950263"
        },
        "date": 1783623782667,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.027180907642965987,
            "range": "±0.0175",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.13180834528202534,
            "range": "±0.0681",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.2888624361640691,
            "range": "±0.1006",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.29049917886178894,
            "range": "±0.124",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 132.30000000004657,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 176.70000000006985,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 248.90000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 109,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 24.20000000006985,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 34.10000000009313,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 98.20000000006985,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 609,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 81.09999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.1\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "7f57f9bb0f343cf45d1502ea2adf22f3b81eb433",
          "message": "[ci] release (#1843)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-next@11.0.2\n\n### Patch Changes\n\n- [#1841](https://github.com/generaltranslation/gt/pull/1841)\n[`ae7eb72`](https://github.com/generaltranslation/gt/commit/ae7eb72ec46ad72fb693521faddc03d4950a3973)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add a\n`regexFilter` option to `createNextMiddleware` for limiting i18n\nmiddleware routing to matching pathnames.\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.2\n  - gt-react@11.0.2\n## gt-react@11.0.2\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.2\n## gt-react-native@11.0.2\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.2\n## gt-tanstack-start@11.0.2\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.2\n  - gt-react@11.0.2\n## @generaltranslation/react-core@11.0.2\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-09T22:27:49Z",
          "url": "https://github.com/generaltranslation/gt/commit/7f57f9bb0f343cf45d1502ea2adf22f3b81eb433"
        },
        "date": 1783636462909,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.03501675964703514,
            "range": "±0.0239",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.18932779439606315,
            "range": "±0.0684",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.35490172959544725,
            "range": "±0.0915",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.3663222747252713,
            "range": "±0.1207",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 144.09999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 154,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 248.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 128,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 118.39999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 610,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.700000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21.600000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 84.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.2\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "c639aa8cee797402488def8cee7fc84ec5b6f937",
          "message": "[ci] release (#1845)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-next@11.0.3\n\n### Patch Changes\n\n- [#1844](https://github.com/generaltranslation/gt/pull/1844)\n[`d5a705f`](https://github.com/generaltranslation/gt/commit/d5a705f44991e3eb55a1ee803cfa816b53194a02)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Move middleware\npath filtering to `withGTConfig` and apply it to client-side locale path\nchecks.\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.3\n  - gt-react@11.0.3\n## gt-react@11.0.3\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.3\n## gt-react-native@11.0.3\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.3\n## gt-tanstack-start@11.0.3\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.3\n  - gt-react@11.0.3\n## @generaltranslation/react-core@11.0.3\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-10T00:29:29Z",
          "url": "https://github.com/generaltranslation/gt/commit/c639aa8cee797402488def8cee7fc84ec5b6f937"
        },
        "date": 1783643766208,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.0463668944732942,
            "range": "±0.0262",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.23644784397162613,
            "range": "±0.0683",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.41403907036423515,
            "range": "±0.0774",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4158771695760645,
            "range": "±0.082",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 149.39999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 189.59999999997672,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 245.39999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 126,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 21.300000000046566,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 32.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 117.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 610,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 25.899999999965075,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 84.39999999996508,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.3\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "17a292b345739c9f47f63bb6b35b666f6b69ec37",
          "message": "[ci] release (#1875)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-sanity@2.1.0\n\n### Minor Changes\n\n- [#1872](https://github.com/generaltranslation/gt/pull/1872)\n[`1f55474`](https://github.com/generaltranslation/gt/commit/1f554742c76bee81b194c480a20cb5b697fafd6c)\nThanks [@brian-lou](https://github.com/brian-lou)! - Add support for\nfield-level localization\n\n### Patch Changes\n\n- [#1873](https://github.com/generaltranslation/gt/pull/1873)\n[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger\npackage publication after repairing release workspace dependency\nresolution.\n## gt@2.14.60\n\n### Patch Changes\n\n- [#1873](https://github.com/generaltranslation/gt/pull/1873)\n[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger\npackage publication after repairing release workspace dependency\nresolution.\n\n- Updated dependencies\n[[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)]:\n  - @generaltranslation/python-extractor@0.2.27\n  - @generaltranslation/supported-locales@2.1.7\n## @generaltranslation/compiler@1.3.29\n\n### Patch Changes\n\n- [#1873](https://github.com/generaltranslation/gt/pull/1873)\n[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger\npackage publication after repairing release workspace dependency\nresolution.\n## gtx-cli@2.14.60\n\n### Patch Changes\n\n- Updated dependencies\n[[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)]:\n  - gt@2.14.60\n## gt-i18n@1.0.3\n\n### Patch Changes\n\n- [#1861](https://github.com/generaltranslation/gt/pull/1861)\n[`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Skip\ninterpolation in compiler-injected string prefetch calls so dev hot\nreload no longer logs \"String interpolation failed\" for messages with\nplaceholders\n## locadex@1.0.195\n\n### Patch Changes\n\n- [#1873](https://github.com/generaltranslation/gt/pull/1873)\n[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger\npackage publication after repairing release workspace dependency\nresolution.\n\n- Updated dependencies\n[[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)]:\n  - gt@2.14.60\n## gt-next@11.0.6\n\n### Patch Changes\n\n- [#1873](https://github.com/generaltranslation/gt/pull/1873)\n[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger\npackage publication after repairing release workspace dependency\nresolution.\n\n- Updated dependencies\n[[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1),\n[`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8)]:\n  - @generaltranslation/compiler@1.3.29\n  - gt-i18n@1.0.3\n  - gt-react@11.0.6\n  - @generaltranslation/react-core@11.0.6\n## gt-node@1.0.3\n\n### Patch Changes\n\n- Updated dependencies\n[[`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8)]:\n  - gt-i18n@1.0.3\n## @generaltranslation/python-extractor@0.2.27\n\n### Patch Changes\n\n- [#1873](https://github.com/generaltranslation/gt/pull/1873)\n[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger\npackage publication after repairing release workspace dependency\nresolution.\n## gt-react@11.0.6\n\n### Patch Changes\n\n- Updated dependencies\n[[`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8)]:\n  - gt-i18n@1.0.3\n  - @generaltranslation/react-core@11.0.6\n## @generaltranslation/react-core@11.0.6\n\n### Patch Changes\n\n- Updated dependencies\n[[`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8)]:\n  - gt-i18n@1.0.3\n## @generaltranslation/react-core-linter@0.1.12\n\n### Patch Changes\n\n- [#1873](https://github.com/generaltranslation/gt/pull/1873)\n[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger\npackage publication after repairing release workspace dependency\nresolution.\n## gt-react-native@11.0.6\n\n### Patch Changes\n\n- Updated dependencies\n[[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1),\n[`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8)]:\n  - @generaltranslation/supported-locales@2.1.7\n  - gt-i18n@1.0.3\n  - @generaltranslation/react-core@11.0.6\n## @generaltranslation/supported-locales@2.1.7\n\n### Patch Changes\n\n- [#1873](https://github.com/generaltranslation/gt/pull/1873)\n[`2e57a08`](https://github.com/generaltranslation/gt/commit/2e57a08a3f8539400f0aef5b90fff25c0a44dce1)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Retrigger\npackage publication after repairing release workspace dependency\nresolution.\n## gt-tanstack-start@11.0.6\n\n### Patch Changes\n\n- Updated dependencies\n[[`6345dc5`](https://github.com/generaltranslation/gt/commit/6345dc5e3fe0a1e3ead9a3c30a0adaa4037d50a8)]:\n  - gt-i18n@1.0.3\n  - gt-react@11.0.6\n  - @generaltranslation/react-core@11.0.6\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-15T00:36:17Z",
          "url": "https://github.com/generaltranslation/gt/commit/17a292b345739c9f47f63bb6b35b666f6b69ec37"
        },
        "date": 1784076198225,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.021397041039028473,
            "range": "±0.0144",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.10410745878434315,
            "range": "±0.0648",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.2267650195011353,
            "range": "±0.1523",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.2223635744775482,
            "range": "±0.0983",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 108.19999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 138.69999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 207.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 106,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 15.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 22.800000000017462,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 98,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 602,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 10.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 18,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 89,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.6\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "7880dadd3f7ca60add41b60392e4530efd53de58",
          "message": "[ci] release (#1877)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.61\n\n### Patch Changes\n\n- [#1876](https://github.com/generaltranslation/gt/pull/1876)\n[`ae59375`](https://github.com/generaltranslation/gt/commit/ae593758047e32396e8eb7eeca9b38b86a20a909)\nThanks [@fernando-aviles](https://github.com/fernando-aviles)! - Make\n`upload` command overwrite content\n## gtx-cli@2.14.61\n\n### Patch Changes\n\n- Updated dependencies\n[[`ae59375`](https://github.com/generaltranslation/gt/commit/ae593758047e32396e8eb7eeca9b38b86a20a909)]:\n  - gt@2.14.61\n## gt-i18n@1.0.4\n\n### Patch Changes\n\n- [#1856](https://github.com/generaltranslation/gt/pull/1856)\n[`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Flatten the\ninternal i18n cache structure: the locale-cache layer is inlined into\n`I18nCache`, the in-flight promise dedupe shared by the caches is\nextracted into one helper, and the dev-only prefetch machinery is\nstatically gated behind `process.env.NODE_ENV !== 'production'` so\nproduction bundles drop it. No public API changes; `gt-i18n/internal`\nand `gt-i18n/internal/types` exports are unchanged.\n\n- [#1855](https://github.com/generaltranslation/gt/pull/1855)\n[`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Collapse the\nI18nCache constructor-time validation layer into a single helper.\nObservable behavior is unchanged: the same warnings are logged when a\ncustom `runtimeUrl` is configured without GT credentials, and providing\n`loadDictionary` without a source `dictionary` still throws. The\nunreachable validation branches are removed, slightly shrinking browser\nbundles.\n## locadex@1.0.196\n\n### Patch Changes\n\n- Updated dependencies\n[[`ae59375`](https://github.com/generaltranslation/gt/commit/ae593758047e32396e8eb7eeca9b38b86a20a909)]:\n  - gt@2.14.61\n## gt-next@11.0.7\n\n### Patch Changes\n\n- Updated dependencies\n[[`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a),\n[`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49)]:\n  - gt-i18n@1.0.4\n  - gt-react@11.0.7\n  - @generaltranslation/react-core@11.0.7\n## gt-node@1.0.4\n\n### Patch Changes\n\n- Updated dependencies\n[[`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a),\n[`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49)]:\n  - gt-i18n@1.0.4\n## gt-react@11.0.7\n\n### Patch Changes\n\n- Updated dependencies\n[[`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a),\n[`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49)]:\n  - gt-i18n@1.0.4\n  - @generaltranslation/react-core@11.0.7\n## @generaltranslation/react-core@11.0.7\n\n### Patch Changes\n\n- Updated dependencies\n[[`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a),\n[`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49)]:\n  - gt-i18n@1.0.4\n## gt-react-native@11.0.7\n\n### Patch Changes\n\n- Updated dependencies\n[[`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a),\n[`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49)]:\n  - gt-i18n@1.0.4\n  - @generaltranslation/react-core@11.0.7\n## gt-tanstack-start@11.0.7\n\n### Patch Changes\n\n- Updated dependencies\n[[`b742df9`](https://github.com/generaltranslation/gt/commit/b742df9f0684c6ea12da140c4fd73eebb42f897a),\n[`a148737`](https://github.com/generaltranslation/gt/commit/a1487377728b662dfd749ecfbd449a1e8d47db49)]:\n  - gt-i18n@1.0.4\n  - gt-react@11.0.7\n  - @generaltranslation/react-core@11.0.7\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-15T04:32:25Z",
          "url": "https://github.com/generaltranslation/gt/commit/7880dadd3f7ca60add41b60392e4530efd53de58"
        },
        "date": 1784090347583,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.046438944645677625,
            "range": "±0.0272",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.24166324601256933,
            "range": "±0.088",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.42836840496574163,
            "range": "±0.0949",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.41926298575020615,
            "range": "±0.0827",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 142.19999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 153.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 252.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 132,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 21.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 30.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 122.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 615,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 22.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 133.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.7\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "a2e3da0ac6067f675e4b34c36dbb10b506346bdf",
          "message": "[ci] release (#1883)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.62\n\n### Patch Changes\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n  - @generaltranslation/python-extractor@0.2.28\n  - @generaltranslation/supported-locales@2.1.8\n## @generaltranslation/compiler@1.3.30\n\n### Patch Changes\n\n- [#1862](https://github.com/generaltranslation/gt/pull/1862)\n[`7f0fbfe`](https://github.com/generaltranslation/gt/commit/7f0fbfef78f677372d39087252ab8d6c72d78e7e)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Skip\ncompile-time hash injection for `<T>` components containing `<Derive>`\nchildren. A single injected hash pinned the runtime lookup to a hash\nmatching none of the per-variant translations, so the rendered\ntranslation was stuck on one variant. Also stops injecting an empty\n`_hash` for `<T $context={derive(...)}>` and autoderive dynamic content.\n\n- [#1863](https://github.com/generaltranslation/gt/pull/1863)\n[`ed53c71`](https://github.com/generaltranslation/gt/commit/ed53c71bc5c6a8d82feaef1b52f68d20b3794c0b)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix `$_hash`\ninjection for `gt()` callbacks with derive content: a derive call no\nlonger shifts the injected hashes of sibling `gt()` calls (counter\nmisalignment), and derive `$context` no longer injects an empty `$_hash`\nor an empty-hash `useGT()` prefetch entry, both of which broke\ntranslation lookups.\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n## generaltranslation@9.0.1\n\n### Patch Changes\n\n- [#1880](https://github.com/generaltranslation/gt/pull/1880)\n[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Deprecate the\n`id` option in `hashSource` ahead of its removal in the next major\nversion.\n## gtx-cli@2.14.62\n\n### Patch Changes\n\n- Updated dependencies []:\n  - gt@2.14.62\n## gt-i18n@1.0.5\n\n### Patch Changes\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n## locadex@1.0.197\n\n### Patch Changes\n\n- Updated dependencies []:\n  - gt@2.14.62\n## gt-next@11.0.8\n\n### Patch Changes\n\n- [#1881](https://github.com/generaltranslation/gt/pull/1881)\n[`4ea53d6`](https://github.com/generaltranslation/gt/commit/4ea53d68e0889784d5255c9fc254b79950caace0)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Exclude custom\ntranslation IDs from SWC-generated content hashes to match the\nTypeScript compiler and runtime.\n\n- Updated dependencies\n[[`7f0fbfe`](https://github.com/generaltranslation/gt/commit/7f0fbfef78f677372d39087252ab8d6c72d78e7e),\n[`ed53c71`](https://github.com/generaltranslation/gt/commit/ed53c71bc5c6a8d82feaef1b52f68d20b3794c0b),\n[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - @generaltranslation/compiler@1.3.30\n  - generaltranslation@9.0.1\n  - gt-i18n@1.0.5\n  - gt-react@11.0.8\n  - @generaltranslation/react-core@11.0.8\n## gt-node@1.0.5\n\n### Patch Changes\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n  - gt-i18n@1.0.5\n## @generaltranslation/python-extractor@0.2.28\n\n### Patch Changes\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n## gt-react@11.0.8\n\n### Patch Changes\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n  - gt-i18n@1.0.5\n  - @generaltranslation/react-core@11.0.8\n## @generaltranslation/react-core@11.0.8\n\n### Patch Changes\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n  - gt-i18n@1.0.5\n## gt-react-native@11.0.8\n\n### Patch Changes\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n  - gt-i18n@1.0.5\n  - @generaltranslation/react-core@11.0.8\n  - @generaltranslation/supported-locales@2.1.8\n## gt-sanity@2.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n## @generaltranslation/supported-locales@2.1.8\n\n### Patch Changes\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n## gt-tanstack-start@11.0.8\n\n### Patch Changes\n\n- Updated dependencies\n[[`3ad93f8`](https://github.com/generaltranslation/gt/commit/3ad93f89da099ef345b707bf37db425662d87e2a)]:\n  - generaltranslation@9.0.1\n  - gt-i18n@1.0.5\n  - gt-react@11.0.8\n  - @generaltranslation/react-core@11.0.8\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-15T21:38:42Z",
          "url": "https://github.com/generaltranslation/gt/commit/a2e3da0ac6067f675e4b34c36dbb10b506346bdf"
        },
        "date": 1784151961533,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.046640252961477,
            "range": "±0.0271",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.23816572285714518,
            "range": "±0.0791",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.423412264182897,
            "range": "±0.0926",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.42044852857142695,
            "range": "±0.0951",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 155.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 194.69999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 270.69999999998254,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 106,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 19.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 30.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 95.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 587,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.799999999988358,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 85.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.8\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "1a2adbaf3e770e13a2d2402ce340d6a09a97fa5d",
          "message": "[ci] release (#1891)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.63\n\n### Patch Changes\n\n- [#1867](https://github.com/generaltranslation/gt/pull/1867)\n[`a7aea57`](https://github.com/generaltranslation/gt/commit/a7aea57b1c6ecdc3edc0ace4cb21a859ac6ef508)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Fix `<T\n$context=\"...\">` and `<T $id=\"...\">` string-literal props being dropped\nfrom hashing and registration. Context-carrying `<T>` components were\nregistered under context-less hashes that the runtime never looks up, so\ntheir file translations always missed; `gt translate` now registers them\nunder the same context-aware hashes the runtime and compiler compute.\n\n- [#1890](https://github.com/generaltranslation/gt/pull/1890)\n[`6feb7b7`](https://github.com/generaltranslation/gt/commit/6feb7b79f0320d54d341f06b1482a9153e69d909)\nThanks [@bgub](https://github.com/bgub)! - Inline single-use\nderive-expression adapters in the CLI string parser to reduce\npass-through indirection.\n\n- [#1882](https://github.com/generaltranslation/gt/pull/1882)\n[`288a47d`](https://github.com/generaltranslation/gt/commit/288a47dccfa7572b381bf76cc0bfc863436ae4a4)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Warn when GT\nReact packages before version 11 may use incompatible ID-based\ntranslation keys, with an explicit suppression flag.\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n  - @generaltranslation/python-extractor@0.2.29\n  - @generaltranslation/supported-locales@2.1.9\n## @generaltranslation/compiler@1.3.31\n\n### Patch Changes\n\n- [#1887](https://github.com/generaltranslation/gt/pull/1887)\n[`da32fa0`](https://github.com/generaltranslation/gt/commit/da32fa05bd718fc55ce418e68678c2d2691d5433)\nThanks [@bgub](https://github.com/bgub)! - Remove empty callback\nregistration and injection modules while preserving callback validation\nand `useGT` hash injection behavior.\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n## generaltranslation@9.0.2\n\n### Patch Changes\n\n- [#1895](https://github.com/generaltranslation/gt/pull/1895)\n[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Resolve custom\nsource-locale aliases before uploading translation files.\n\n- [#1897](https://github.com/generaltranslation/gt/pull/1897)\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Allow\n`setupProject` callers to pass only the branch, file, and version IDs\nthat the API request uses.\n\n- [#1896](https://github.com/generaltranslation/gt/pull/1896)\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Correct the\nshipped `checkJobStatus` example to pass the timeout as a number.\n## gtx-cli@2.14.63\n\n### Patch Changes\n\n- Updated dependencies\n[[`a7aea57`](https://github.com/generaltranslation/gt/commit/a7aea57b1c6ecdc3edc0ace4cb21a859ac6ef508),\n[`6feb7b7`](https://github.com/generaltranslation/gt/commit/6feb7b79f0320d54d341f06b1482a9153e69d909),\n[`288a47d`](https://github.com/generaltranslation/gt/commit/288a47dccfa7572b381bf76cc0bfc863436ae4a4)]:\n  - gt@2.14.63\n## gt-i18n@1.0.6\n\n### Patch Changes\n\n- [#1901](https://github.com/generaltranslation/gt/pull/1901)\n[`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Forward the\ntop-level `modelProvider` configuration to runtime translation requests\nwhile allowing explicit runtime metadata to override it.\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n## locadex@1.0.198\n\n### Patch Changes\n\n- Updated dependencies\n[[`a7aea57`](https://github.com/generaltranslation/gt/commit/a7aea57b1c6ecdc3edc0ace4cb21a859ac6ef508),\n[`6feb7b7`](https://github.com/generaltranslation/gt/commit/6feb7b79f0320d54d341f06b1482a9153e69d909),\n[`288a47d`](https://github.com/generaltranslation/gt/commit/288a47dccfa7572b381bf76cc0bfc863436ae4a4)]:\n  - gt@2.14.63\n## gt-next@11.0.9\n\n### Patch Changes\n\n- [#1894](https://github.com/generaltranslation/gt/pull/1894)\n[`0d50450`](https://github.com/generaltranslation/gt/commit/0d50450288bdea5ff4bb6b42f5360ac0b6c4e81d)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Correct the\nshipped `CompilerOptions.type` documentation to show `none` as the\nruntime default.\n\n- [#1850](https://github.com/generaltranslation/gt/pull/1850)\n[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)\nThanks [@bgub](https://github.com/bgub)! - Stop publishing unreachable\n`index.types` runtime bundles. The `index.types` entry only backs the\nexports map's `types` conditions, so only its declaration files are ever\nresolved; the runtime `.cjs`/`.mjs` artifacts (and sourcemaps) were dead\nweight in the published package (~179KB in gt-react, ~83KB in gt-next).\nThey are now deleted after each build.\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288),\n[`ffa855f`](https://github.com/generaltranslation/gt/commit/ffa855fa929d1c668e75d0c27a99dc704fcb2561),\n[`da32fa0`](https://github.com/generaltranslation/gt/commit/da32fa05bd718fc55ce418e68678c2d2691d5433),\n[`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`b320e17`](https://github.com/generaltranslation/gt/commit/b320e176d581bfade57f0d122f7b95e8e3229cbf),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n  - gt-react@11.0.9\n  - @generaltranslation/react-core@11.0.9\n  - @generaltranslation/compiler@1.3.31\n  - gt-i18n@1.0.6\n## gt-node@1.0.6\n\n### Patch Changes\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n  - gt-i18n@1.0.6\n## @generaltranslation/python-extractor@0.2.29\n\n### Patch Changes\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n## gt-react@11.0.9\n\n### Patch Changes\n\n- [#1850](https://github.com/generaltranslation/gt/pull/1850)\n[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)\nThanks [@bgub](https://github.com/bgub)! - Stop publishing unreachable\n`index.types` runtime bundles. The `index.types` entry only backs the\nexports map's `types` conditions, so only its declaration files are ever\nresolved; the runtime `.cjs`/`.mjs` artifacts (and sourcemaps) were dead\nweight in the published package (~179KB in gt-react, ~83KB in gt-next).\nThey are now deleted after each build.\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`ffa855f`](https://github.com/generaltranslation/gt/commit/ffa855fa929d1c668e75d0c27a99dc704fcb2561),\n[`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`b320e17`](https://github.com/generaltranslation/gt/commit/b320e176d581bfade57f0d122f7b95e8e3229cbf),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n  - @generaltranslation/react-core@11.0.9\n  - gt-i18n@1.0.6\n## @generaltranslation/react-core@11.0.9\n\n### Patch Changes\n\n- [#1852](https://github.com/generaltranslation/gt/pull/1852)\n[`ffa855f`](https://github.com/generaltranslation/gt/commit/ffa855fa929d1c668e75d0c27a99dc704fcb2561)\nThanks [@bgub](https://github.com/bgub)! - Move the default cookie-name\nconstants (`defaultLocaleCookieName`, `defaultRegionCookieName`,\n`defaultEnableI18nCookieName`, `defaultResetLocaleCookieName`) into a\ndependency-free module. They were co-located with `ReactI18nConfig`, so\nimporting just a cookie name from `@generaltranslation/react-core/pure`\ncould drag the `gt-i18n/internal` runtime (~60KB) into size-constrained\nbundles like gt-next's edge middleware. The `/pure` entry re-exports\nthem unchanged.\n\n- [#1888](https://github.com/generaltranslation/gt/pull/1888)\n[`b320e17`](https://github.com/generaltranslation/gt/commit/b320e176d581bfade57f0d122f7b95e8e3229cbf)\nThanks [@bgub](https://github.com/bgub)! - Share condition setter hooks\nthrough react-core instead of duplicating them in the React and React\nNative packages.\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n  - gt-i18n@1.0.6\n## gt-react-native@11.0.9\n\n### Patch Changes\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`ffa855f`](https://github.com/generaltranslation/gt/commit/ffa855fa929d1c668e75d0c27a99dc704fcb2561),\n[`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`b320e17`](https://github.com/generaltranslation/gt/commit/b320e176d581bfade57f0d122f7b95e8e3229cbf),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n  - @generaltranslation/react-core@11.0.9\n  - gt-i18n@1.0.6\n  - @generaltranslation/supported-locales@2.1.9\n## gt-sanity@2.1.2\n\n### Patch Changes\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n## @generaltranslation/supported-locales@2.1.9\n\n### Patch Changes\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n## gt-tanstack-start@11.0.9\n\n### Patch Changes\n\n- Updated dependencies\n[[`5d93858`](https://github.com/generaltranslation/gt/commit/5d9385872eb041af0991fc273d5eddd7a032e584),\n[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288),\n[`ffa855f`](https://github.com/generaltranslation/gt/commit/ffa855fa929d1c668e75d0c27a99dc704fcb2561),\n[`8836fbd`](https://github.com/generaltranslation/gt/commit/8836fbda088b5192b2eaa8e2109a724256458bc2),\n[`5721267`](https://github.com/generaltranslation/gt/commit/57212672a595c8c8578366636767bcbfe8ab6e57),\n[`b320e17`](https://github.com/generaltranslation/gt/commit/b320e176d581bfade57f0d122f7b95e8e3229cbf),\n[`8b9b440`](https://github.com/generaltranslation/gt/commit/8b9b4404b703b552b9aa327dc0ae85fce584c97c)]:\n  - generaltranslation@9.0.2\n  - gt-react@11.0.9\n  - @generaltranslation/react-core@11.0.9\n  - gt-i18n@1.0.6\n## gt-test-esbuild-react@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-react@11.0.9\n## gt-test-node-express@0.1.1\n\n### Patch Changes\n\n- Updated dependencies []:\n  - gt-node@1.0.6\n## gt-test-next-app-router@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`0d50450`](https://github.com/generaltranslation/gt/commit/0d50450288bdea5ff4bb6b42f5360ac0b6c4e81d),\n[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-next@11.0.9\n## gt-test-next-app-router-dictionary@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`0d50450`](https://github.com/generaltranslation/gt/commit/0d50450288bdea5ff4bb6b42f5360ac0b6c4e81d),\n[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-next@11.0.9\n## gt-test-next-app-router-locale-routing@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`0d50450`](https://github.com/generaltranslation/gt/commit/0d50450288bdea5ff4bb6b42f5360ac0b6c4e81d),\n[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-next@11.0.9\n## gt-test-next-app-router-locale-routing-ssg@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`0d50450`](https://github.com/generaltranslation/gt/commit/0d50450288bdea5ff4bb6b42f5360ac0b6c4e81d),\n[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-next@11.0.9\n## gt-test-next-app-router-locale-routing-use-cache@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`0d50450`](https://github.com/generaltranslation/gt/commit/0d50450288bdea5ff4bb6b42f5360ac0b6c4e81d),\n[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-next@11.0.9\n## gt-test-next-pages-router@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`0d50450`](https://github.com/generaltranslation/gt/commit/0d50450288bdea5ff4bb6b42f5360ac0b6c4e81d),\n[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-next@11.0.9\n## gt-test-react-native@0.1.1\n\n### Patch Changes\n\n- Updated dependencies []:\n  - gt-react-native@11.0.9\n## gt-test-rolldown-react@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-react@11.0.9\n## gt-test-rollup-react@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-react@11.0.9\n## gt-test-tanstack-start@0.1.1\n\n### Patch Changes\n\n- Updated dependencies []:\n  - gt-tanstack-start@11.0.9\n## gt-test-vite-react@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-react@11.0.9\n## gt-test-webpack-react@0.1.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`81d0efe`](https://github.com/generaltranslation/gt/commit/81d0efea4540e11ec0fca784ebbc61db3cf28288)]:\n  - gt-react@11.0.9\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-16T20:37:00Z",
          "url": "https://github.com/generaltranslation/gt/commit/1a2adbaf3e770e13a2d2402ce340d6a09a97fa5d"
        },
        "date": 1784234680708,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.044461246465723844,
            "range": "±0.0255",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.23292558593385956,
            "range": "±0.0749",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.41566665752285986,
            "range": "±0.0861",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.422491396798654,
            "range": "±0.1098",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 150.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 182.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 264.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 103,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 19.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 93.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 621,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 12.800000000017462,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 85.90000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.9\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "3cb1045b984721f71d9a1572683cee7d02c32a33",
          "message": "[ci] release (#1922)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.64\n\n### Patch Changes\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n  - @generaltranslation/python-extractor@0.2.30\n  - @generaltranslation/supported-locales@2.1.10\n## @generaltranslation/compiler@1.3.32\n\n### Patch Changes\n\n- [#1918](https://github.com/generaltranslation/gt/pull/1918)\n[`dce7a7a`](https://github.com/generaltranslation/gt/commit/dce7a7a0b5b82ee0ac7ca3518030ab51026da103)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Allow framework\nintegrations to configure the package used for automatic JSX injection\nimports.\n\n- [#1916](https://github.com/generaltranslation/gt/pull/1916)\n[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify\n`gt.config.json` types so complete config objects can be spread into\ncompiler plugins and runtime initializers while file settings remain\noptional.\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n## generaltranslation@9.0.3\n\n### Patch Changes\n\n- [#1916](https://github.com/generaltranslation/gt/pull/1916)\n[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify\n`gt.config.json` types so complete config objects can be spread into\ncompiler plugins and runtime initializers while file settings remain\noptional.\n## gtx-cli@2.14.64\n\n### Patch Changes\n\n- Updated dependencies []:\n  - gt@2.14.64\n## gt-i18n@1.0.7\n\n### Patch Changes\n\n- [#1916](https://github.com/generaltranslation/gt/pull/1916)\n[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify\n`gt.config.json` types so complete config objects can be spread into\ncompiler plugins and runtime initializers while file settings remain\noptional.\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n## locadex@1.0.199\n\n### Patch Changes\n\n- Updated dependencies []:\n  - gt@2.14.64\n## gt-next@11.0.10\n\n### Patch Changes\n\n- [#1921](https://github.com/generaltranslation/gt/pull/1921)\n[`50043dd`](https://github.com/generaltranslation/gt/commit/50043dd68387d6db52afa6f09c74d9c9fa4d2d5f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Support\nautomatic JSX injection with the webpack compiler and import the\ninjected components from `gt-next`.\n\n- Updated dependencies\n[[`dce7a7a`](https://github.com/generaltranslation/gt/commit/dce7a7a0b5b82ee0ac7ca3518030ab51026da103),\n[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - @generaltranslation/compiler@1.3.32\n  - generaltranslation@9.0.3\n  - gt-i18n@1.0.7\n  - @generaltranslation/react-core@11.0.10\n  - gt-react@11.0.10\n## gt-node@1.0.7\n\n### Patch Changes\n\n- [#1916](https://github.com/generaltranslation/gt/pull/1916)\n[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify\n`gt.config.json` types so complete config objects can be spread into\ncompiler plugins and runtime initializers while file settings remain\noptional.\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n  - gt-i18n@1.0.7\n## @generaltranslation/python-extractor@0.2.30\n\n### Patch Changes\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n## gt-react@11.0.10\n\n### Patch Changes\n\n- [#1916](https://github.com/generaltranslation/gt/pull/1916)\n[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify\n`gt.config.json` types so complete config objects can be spread into\ncompiler plugins and runtime initializers while file settings remain\noptional.\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n  - gt-i18n@1.0.7\n  - @generaltranslation/react-core@11.0.10\n## @generaltranslation/react-core@11.0.10\n\n### Patch Changes\n\n- [#1916](https://github.com/generaltranslation/gt/pull/1916)\n[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify\n`gt.config.json` types so complete config objects can be spread into\ncompiler plugins and runtime initializers while file settings remain\noptional.\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n  - gt-i18n@1.0.7\n## gt-react-native@11.0.10\n\n### Patch Changes\n\n- [#1916](https://github.com/generaltranslation/gt/pull/1916)\n[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify\n`gt.config.json` types so complete config objects can be spread into\ncompiler plugins and runtime initializers while file settings remain\noptional.\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n  - gt-i18n@1.0.7\n  - @generaltranslation/react-core@11.0.10\n  - @generaltranslation/supported-locales@2.1.10\n## gt-sanity@2.1.3\n\n### Patch Changes\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n## @generaltranslation/supported-locales@2.1.10\n\n### Patch Changes\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n## gt-tanstack-start@11.0.10\n\n### Patch Changes\n\n- [#1916](https://github.com/generaltranslation/gt/pull/1916)\n[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Unify\n`gt.config.json` types so complete config objects can be spread into\ncompiler plugins and runtime initializers while file settings remain\noptional.\n\n- Updated dependencies\n[[`c658e7e`](https://github.com/generaltranslation/gt/commit/c658e7e1f6929965e3752a6828e3658dd8c527a8)]:\n  - generaltranslation@9.0.3\n  - gt-i18n@1.0.7\n  - @generaltranslation/react-core@11.0.10\n  - gt-react@11.0.10\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-17T21:46:43Z",
          "url": "https://github.com/generaltranslation/gt/commit/3cb1045b984721f71d9a1572683cee7d02c32a33"
        },
        "date": 1784325238416,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.0458431957279055,
            "range": "±0.0249",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.23618868351440636,
            "range": "±0.0701",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.42370638018628637,
            "range": "±0.0839",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.41074823973727215,
            "range": "±0.0694",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 146.39999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 180.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 260.5999999999767,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 124,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 20.60000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 29.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 115.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 584,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.300000000017462,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 19.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 83.40000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.10\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "f04eba7050a38f30ca1c059fc52813301e30ca03",
          "message": "[ci] release (#1930)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-next@11.0.11\n\n### Patch Changes\n\n- [#1928](https://github.com/generaltranslation/gt/pull/1928)\n[`84bc362`](https://github.com/generaltranslation/gt/commit/84bc362d03d03c6f70773c35e6d92770ad56548f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Use the\nclient-safe React i18n cache in the browser so gt-next only resolves\ndictionary files and loaders on the server.\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.11\n  - gt-react@11.0.11\n## gt-react@11.0.11\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.11\n## gt-react-native@11.0.11\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.11\n## gt-tanstack-start@11.0.11\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.11\n  - gt-react@11.0.11\n## @generaltranslation/react-core@11.0.11\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-18T03:08:00Z",
          "url": "https://github.com/generaltranslation/gt/commit/f04eba7050a38f30ca1c059fc52813301e30ca03"
        },
        "date": 1784344483211,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.04593363916957441,
            "range": "±0.0235",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.23290745039590235,
            "range": "±0.0686",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.41064622331690803,
            "range": "±0.0779",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.4140891266556164,
            "range": "±0.0848",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 133.60000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 151.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 236.80000000001746,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 120,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 18.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 26.89999999999418,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 111.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 589,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.10000000000582,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 20.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 124.90000000002328,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.11\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "64bf6cbe4015234a872acc97fa2f7d7ad423a2ce",
          "message": "[ci] release (#1954)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt-next@11.0.12\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.12\n  - gt-react@11.0.12\n## gt-react@11.0.12\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.12\n## gt-react-native@11.0.12\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.12\n## gt-tanstack-start@11.0.12\n\n### Patch Changes\n\n- [#1941](https://github.com/generaltranslation/gt/pull/1941)\n[`7fef71d`](https://github.com/generaltranslation/gt/commit/7fef71de88a770bd5e14ec9f62cdac91671b3d2f)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Add\nrequest-scoped server middleware and server-only translation helpers for\nTanStack Start.\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.12\n  - gt-react@11.0.12\n## @generaltranslation/react-core@11.0.12\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-21T04:35:39Z",
          "url": "https://github.com/generaltranslation/gt/commit/64bf6cbe4015234a872acc97fa2f7d7ad423a2ce"
        },
        "date": 1784608943442,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.046224214477211686,
            "range": "±0.0266",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.2370996880037869,
            "range": "±0.0751",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.418488569037659,
            "range": "±0.0926",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.41304627332782623,
            "range": "±0.0869",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 140.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 159.60000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 245.10000000003492,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 104,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 19.099999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.29999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 94.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 591,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.599999999976717,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 22.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 126.79999999998836,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.12\"\n}"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "name": "github-actions[bot]",
            "username": "github-actions[bot]",
            "email": "41898282+github-actions[bot]@users.noreply.github.com"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "e8457b74e756b2fcfd30575f95aad78bd91f4206",
          "message": "[ci] release (#1961)\n\nThis PR was opened by the [Changesets\nrelease](https://github.com/changesets/action) GitHub action. When\nyou're ready to do a release, you can merge this and the packages will\nbe published to npm automatically. If you're not ready to do a release\nyet, that's fine, whenever you add more changesets to main, this PR will\nbe updated.\n\n\n# Releases\n## gt@2.14.65\n\n### Patch Changes\n\n- [#1962](https://github.com/generaltranslation/gt/pull/1962)\n[`99f63e6`](https://github.com/generaltranslation/gt/commit/99f63e6826244cb07c18382031cce3fd8ca4ffc2)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Clear the\nlocale search query after selecting a locale during setup.\n## gtx-cli@2.14.65\n\n### Patch Changes\n\n- Updated dependencies\n[[`99f63e6`](https://github.com/generaltranslation/gt/commit/99f63e6826244cb07c18382031cce3fd8ca4ffc2)]:\n  - gt@2.14.65\n## locadex@1.0.200\n\n### Patch Changes\n\n- Updated dependencies\n[[`99f63e6`](https://github.com/generaltranslation/gt/commit/99f63e6826244cb07c18382031cce3fd8ca4ffc2)]:\n  - gt@2.14.65\n## gt-next@11.0.13\n\n### Patch Changes\n\n- [#1935](https://github.com/generaltranslation/gt/pull/1935)\n[`ca2d2d7`](https://github.com/generaltranslation/gt/commit/ca2d2d70fb4e58b205cee7a899a6df9fcae3f0dd)\nThanks [@pjsny](https://github.com/pjsny)! - Support Next.js's\nfunction-form config in `withGTConfig`. When passed a `(phase, context)\n=> NextConfig` function (Next's function config form), `withGTConfig`\nnow calls it and wraps the resolved config instead of spreading the\nfunction as a plain object. This lets `withGTConfig` compose with other\nNext config plugins that return a config function — matching\n`@sentry/nextjs`'s `withSentryConfig` — for both sync and async config\nfunctions.\n\n- Updated dependencies\n[[`f1eb7c4`](https://github.com/generaltranslation/gt/commit/f1eb7c42bebf0eb75e477c700a61ac060924bb30)]:\n  - gt-react@11.0.13\n  - @generaltranslation/react-core@11.0.13\n## gt-react@11.0.13\n\n### Patch Changes\n\n- [#1971](https://github.com/generaltranslation/gt/pull/1971)\n[`f1eb7c4`](https://github.com/generaltranslation/gt/commit/f1eb7c42bebf0eb75e477c700a61ac060924bb30)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Initialize\nTanStack Start browser condition state from the locale cookie, expose\ntranslation helpers from the isomorphic package entry point, and\ndeprecate `parseLocale()` in favor of `getLocale()`. Export the browser\ncondition-store factory from `gt-react` for framework integrations.\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.13\n## gt-react-native@11.0.13\n\n### Patch Changes\n\n- Updated dependencies []:\n  - @generaltranslation/react-core@11.0.13\n## gt-sanity@2.1.4\n\n### Patch Changes\n\n- [#1958](https://github.com/generaltranslation/gt/pull/1958)\n[`45e1452`](https://github.com/generaltranslation/gt/commit/45e14525b135177074e6d0ef9d3eafdb0eedf408)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Use the\ncanonical library locale for serialization fallbacks.\n## gt-tanstack-start@11.0.13\n\n### Patch Changes\n\n- [#1971](https://github.com/generaltranslation/gt/pull/1971)\n[`f1eb7c4`](https://github.com/generaltranslation/gt/commit/f1eb7c42bebf0eb75e477c700a61ac060924bb30)\nThanks [@ErnestM1234](https://github.com/ErnestM1234)! - Initialize\nTanStack Start browser condition state from the locale cookie, expose\ntranslation helpers from the isomorphic package entry point, and\ndeprecate `parseLocale()` in favor of `getLocale()`. Export the browser\ncondition-store factory from `gt-react` for framework integrations.\n\n- Updated dependencies\n[[`f1eb7c4`](https://github.com/generaltranslation/gt/commit/f1eb7c42bebf0eb75e477c700a61ac060924bb30)]:\n  - gt-react@11.0.13\n  - @generaltranslation/react-core@11.0.13\n## @generaltranslation/react-core@11.0.13\n\n\n## webpack-spa@0.0.1\n\n### Patch Changes\n\n- Updated dependencies\n[[`f1eb7c4`](https://github.com/generaltranslation/gt/commit/f1eb7c42bebf0eb75e477c700a61ac060924bb30),\n[`99f63e6`](https://github.com/generaltranslation/gt/commit/99f63e6826244cb07c18382031cce3fd8ca4ffc2)]:\n  - gt-react@11.0.13\n  - gt@2.14.65\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
          "timestamp": "2026-07-22T20:34:05Z",
          "url": "https://github.com/generaltranslation/gt/commit/e8457b74e756b2fcfd30575f95aad78bd91f4206"
        },
        "date": 1784752887311,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "gt-next > unit > middleware: factory creation latency > createNextMiddleware() (mean)",
            "value": 0.026595512525928972,
            "range": "±0.0163",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > default locale request (/) (mean)",
            "value": 0.13069371536852945,
            "range": "±0.0714",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > non-default locale request (/fr) (mean)",
            "value": 0.2870736963260682,
            "range": "±0.0979",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > unit > middleware: per-request execution latency > nested route (/fr/about) (mean)",
            "value": 0.2917757812135327,
            "range": "±0.1314",
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > ttfb",
            "value": 131.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > domContentLoaded",
            "value": 216.5,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-home > load",
            "value": 308.9000000000233,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > elapsed",
            "value": 122,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > ttfb",
            "value": 19.100000000034925,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > domContentLoaded",
            "value": 28.400000000023283,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: redirect-chain-fr-about > load",
            "value": 113.70000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: locale-switch-en-to-fr > elapsed",
            "value": 608,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > ttfb",
            "value": 11.200000000011642,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > domContentLoaded",
            "value": 21,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          },
          {
            "name": "gt-next > e2e > middleware: cold-navigation-about > load",
            "value": 109.20000000001164,
            "unit": "ms",
            "extra": "{\n  \"package\": \"gt-next\",\n  \"version\": \"11.0.13\"\n}"
          }
        ]
      }
    ]
  }
}