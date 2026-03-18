window.BENCHMARK_DATA = {
  "lastUpdate": 1773810200883,
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
      }
    ]
  }
}