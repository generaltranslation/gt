# RSC T Refactor Stack Plan

1. Add explicit-locale internal variable component variants and export them through context interfaces.
2. Thread explicit locale through renderVariable and switch react-core renderVariable to the new variants.
3. Move RSC T into react-core as RscT and keep Next as a getLocale wrapper.
4. Remove this temporary plan and any transitional cleanup.
