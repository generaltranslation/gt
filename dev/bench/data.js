window.BENCHMARK_DATA = {
  "lastUpdate": 1773088615694,
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
      }
    ]
  }
}