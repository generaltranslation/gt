window.BENCHMARK_DATA = {
  "lastUpdate": 1776213545592,
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
      }
    ]
  }
}