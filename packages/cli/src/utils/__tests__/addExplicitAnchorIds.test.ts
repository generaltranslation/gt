import { describe, it, expect } from 'vitest';
import {
  addExplicitAnchorIds,
  extractHeadingInfo,
} from '../addExplicitAnchorIds';

describe('addExplicitAnchorIds', () => {
  const standardSettings = undefined;
  const mintlifySettings = {
    options: {
      experimentalLocalizeStaticUrls: true,
      experimentalAddHeaderAnchorIds: 'mintlify' as const,
    },
  };

  describe('anchor format', () => {
    // Formatting, punctuation, every heading level, links to the headings and
    // a fenced heading that must be left alone.
    const headings = [
      ['# Getting Started', 'getting-started'],
      ['## **Bold Heading** with formatting', 'bold-heading-with-formatting'],
      ['## `Code Heading` example', 'code-heading-example'],
      ['## *Italic* and **mixed** formatting', 'italic-and-mixed-formatting'],
      ['### Code & Design Workflow!', 'code-design-workflow'],
      ['#### API Reference (v2.0)', 'api-reference-v20'],
      ['##### Getting Started: Step 1', 'getting-started-step-1'],
      ["###### What's New?", 'whats-new'],
    ];
    const rest = `
This section has no links pointing at it.

<Card href="#code-design-workflow">Link to workflow</Card>

[Link to step 1](#getting-started-step-1) and [Unclosed link(#test

<div>
  <a href="#whats-new">Raw JSX link</a>
</div>

\`\`\`markdown
## Fake Heading In Code Block
This is just an example
\`\`\`
`;
    const document = (anchor: (id: string) => string) =>
      headings.map(([heading, id]) => `${heading}${anchor(id)}\n`).join('\n') +
      rest;
    const escaped = (id: string) => ` \\{#${id}\\}`;

    it.each([
      ['escaped \\{#id\\} anchors by default', standardSettings, escaped],
      [
        'escaped \\{#id\\} anchors with experimentalLocalizeStaticUrls',
        { options: { experimentalLocalizeStaticUrls: true } },
        escaped,
      ],
      [
        'native {#id} anchors in Mintlify mode',
        mintlifySettings,
        (id: string) => ` {#${id}}`,
      ],
    ])('adds %s to every real heading', (_name, settings, anchor) => {
      const input = document(() => '');

      const result = addExplicitAnchorIds(
        input,
        extractHeadingInfo(input),
        settings
      );

      // Only the anchors are added: heading text, links and the code block are
      // left exactly as written.
      expect(result.content).toBe(document(anchor));
      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toEqual(
        headings.map(([heading, id]) => ({
          heading: heading.replace(/^#+ /, '').replace(/[*`]/g, ''),
          id,
        }))
      );
    });
  });

  describe('IDs from the source file', () => {
    const source = `## Source heading {#custom-source-id}

## Another Source Heading
`;

    it('applies explicit and derived source IDs to translated headings in order', () => {
      const result = addExplicitAnchorIds(
        `## Encabezado traducido

## Otro encabezado
`,
        extractHeadingInfo(source)
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toEqual([
        { heading: 'Encabezado traducido', id: 'custom-source-id' },
        { heading: 'Otro encabezado', id: 'another-source-heading' },
      ]);
      expect(result.content)
        .toBe(`## Encabezado traducido \\{#custom-source-id\\}

## Otro encabezado \\{#another-source-heading\\}
`);
    });

    it('normalizes an inline ID the translation kept to the escaped form in MDX', () => {
      const result = addExplicitAnchorIds(
        `## Traducción {#custom-source-id}`,
        extractHeadingInfo(`## Source heading {#custom-source-id}`)
      );

      expect(result.hasChanges).toBe(true);
      expect(result.content).toBe('## Traducción \\{#custom-source-id\\}');
      // Normalization counts as a recorded ID in MDX mode
      expect(result.addedIds).toHaveLength(1);
    });

    it.each([
      ['a .md target path', '/tmp/file.md', undefined, '{#custom-source-id}'],
      ['an md fileTypeHint', '/tmp/file.mdx', 'md', '{#custom-source-id}'],
      ['an mdx fileTypeHint', '/tmp/file.md', 'mdx', '\\{#custom-source-id\\}'],
    ] as const)(
      'chooses the anchor escaping from %s',
      (_name, targetPath, fileTypeHint, anchor) => {
        const result = addExplicitAnchorIds(
          `## Encabezado traducido

## Otro encabezado {#another-source-heading}
`,
          extractHeadingInfo(source),
          undefined,
          source,
          targetPath,
          fileTypeHint
        );

        expect(result.hasChanges).toBe(true);
        expect(result.content).toContain(`## Encabezado traducido ${anchor}\n`);
        // Markdown keeps an existing anchor unescaped; MDX escapes it.
        expect(result.content).toContain(
          `## Otro encabezado ${anchor.replace('custom-source-id', 'another-source-heading')}\n`
        );
      }
    );
  });

  describe('when MDX parsing fails (string fallback)', () => {
    it('still anchors headings and ignores code blocks', () => {
      const input = `## Real Heading

This is real content.

{ this will break mdx parsing

\`\`\`markdown
## Fake Heading In Code Block
This is just an example
\`\`\`

## Another Real Heading
`;

      const result = addExplicitAnchorIds(input, extractHeadingInfo(input));

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toEqual([
        { heading: 'Real Heading', id: 'real-heading' },
        { heading: 'Another Real Heading', id: 'another-real-heading' },
      ]);
      expect(result.content).toContain('## Real Heading \\{#real-heading\\}');
      expect(result.content).toContain(
        '## Another Real Heading \\{#another-real-heading\\}'
      );
      expect(result.content).toContain(
        '```markdown\n## Fake Heading In Code Block\nThis is just an example\n```'
      );
    });

    it('normalizes unescaped anchors to a single-escaped form', () => {
      const input = `## Titulo {#titulo}

{ this will break mdx parsing
`;

      const result = addExplicitAnchorIds(input, extractHeadingInfo(input));

      expect(result.hasChanges).toBe(true);
      expect(result.content).toContain('## Titulo \\{#titulo\\}');
      expect(result.content).not.toContain('## Titulo \\\\{#titulo\\\\}');
    });
  });

  describe('Idempotency', () => {
    it('does not duplicate inline IDs when already present (escaped form)', () => {
      const input = `## Sub Heading \\{#sub-heading\\}`;
      const sourceHeadingMap = extractHeadingInfo('## Sub Heading');
      const result = addExplicitAnchorIds(input, sourceHeadingMap);
      expect(result.hasChanges).toBe(false);
      expect(result.content).toContain('## Sub Heading \\{#sub-heading\\}');
    });

    it('Mintlify anchors remain stable on repeated runs', () => {
      const input = `## Real Heading`;
      const sourceHeadingMap = extractHeadingInfo(input);
      const settings = {
        options: { experimentalAddHeaderAnchorIds: 'mintlify' as const },
      };
      const first = addExplicitAnchorIds(input, sourceHeadingMap, settings);
      const second = addExplicitAnchorIds(
        first.content,
        sourceHeadingMap,
        settings
      );

      expect(first.hasChanges).toBe(true);
      expect(second.hasChanges).toBe(false);
      expect(second.content).toBe(first.content);
    });

    it('anchors headings containing HTML entities in Mintlify mode', () => {
      const sourceContent = `## Register the app`;
      const translatedContent = `## Configurer l&#39;application`;
      const sourceHeadingMap = extractHeadingInfo(sourceContent);
      const settings = {
        options: { experimentalAddHeaderAnchorIds: 'mintlify' as const },
      };

      const result = addExplicitAnchorIds(
        translatedContent,
        sourceHeadingMap,
        settings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.content).toContain(
        '## Configurer l&#39;application {#register-the-app}'
      );
    });
  });

  describe('Custom heading IDs (Mintlify {#id} syntax)', () => {
    const mintlify = {
      options: { experimentalAddHeaderAnchorIds: 'mintlify' as const },
    };

    it('extracts headings from a source file that uses custom heading IDs', () => {
      const source = `## CSS variables reference {#css-variables}

### Completion and the \`callback\` function {#callback}
`;
      const headings = extractHeadingInfo(source);

      expect(headings).toHaveLength(2);
      expect(headings[0]).toMatchObject({
        text: 'CSS variables reference',
        slug: 'css-variables',
        explicit: true,
        startLine: 1,
      });
      expect(headings[1]).toMatchObject({
        text: 'Completion and the callback function',
        slug: 'callback',
        explicit: true,
        startLine: 3,
      });
    });

    it('writes native anchors for explicit and derived IDs alike', () => {
      // A wrapper keeps old links working, but Mintlify's hover link on the
      // heading would then point at a slug of the translated text instead.
      const source = '## Setup {#custom}\n\n## Other heading\n';
      const translated = '## Configuration\n\n## Autre titre\n';

      const result = addExplicitAnchorIds(
        translated,
        extractHeadingInfo(source),
        mintlify,
        'a.mdx',
        'fr/a.mdx',
        'mdx'
      );

      expect(result.content).toBe(
        '## Configuration {#custom}\n\n## Autre titre {#other-heading}\n'
      );
    });

    it('does not double-apply an ID the translation already carried over', () => {
      const source = '## Setup {#custom}\n';
      const translated = '## Configuration {#custom}\n';

      const result = addExplicitAnchorIds(
        translated,
        extractHeadingInfo(source),
        mintlify,
        'a.mdx',
        'fr/a.mdx',
        'mdx'
      );

      expect(result.content).toBe('## Configuration {#custom}\n');
      expect(result.hasChanges).toBe(false);
    });

    it('unescapes an anchor the translation carried over in escaped form', () => {
      const source = '## Setup {#custom}\n';
      const translated = '## Configuration \\{#custom\\}\n';

      const result = addExplicitAnchorIds(
        translated,
        extractHeadingInfo(source),
        mintlify,
        'a.mdx',
        'fr/a.mdx',
        'mdx'
      );

      expect(result.content).toBe('## Configuration {#custom}\n');
    });
  });

  describe('Mintlify only reads {#id} on headings indented up to three spaces', () => {
    // Verified with `mint validate`: `{#id}` on a heading at four or more
    // spaces fails with "Could not parse expression with acorn". The MDX
    // serializer indents JSX children two spaces per level, so a heading
    // inside <Tabs><Tab> lands at four.
    const mintlify = {
      options: { experimentalAddHeaderAnchorIds: 'mintlify' as const },
    };
    const run = (source: string, translated: string) =>
      addExplicitAnchorIds(
        translated,
        extractHeadingInfo(source),
        mintlify,
        'a.mdx',
        'fr/a.mdx',
        'mdx'
      ).content;

    const source = `<Tabs>
  <Tab title="Plain CSS">

## CSS variables reference {#css-variables}

Body text.

  </Tab>
</Tabs>
`;

    it('moves a heading the serializer indented too deep back to the margin', () => {
      const translated = `<Tabs>
  <Tab title="CSS simple">
    ## Référence des variables CSS

    Corps du texte.
  </Tab>
</Tabs>
`;

      expect(run(source, translated)).toBe(`<Tabs>
  <Tab title="CSS simple">
## Référence des variables CSS {#css-variables}

    Corps du texte.
  </Tab>
</Tabs>
`);
    });

    it('leaves a heading within reach where it is', () => {
      const translated = `<Tabs>
  <Tab title="CSS simple">
   ## Référence des variables CSS

    Corps du texte.
  </Tab>
</Tabs>
`;

      expect(run(source, translated)).toContain(
        '\n   ## Référence des variables CSS {#css-variables}\n'
      );
    });

    it('leaves a setext heading alone, since Mintlify reads {#id} on ATX headings only', () => {
      const doc = 'Setup\n=====\n';
      expect(run(doc, doc)).toBe(doc);
    });

    it('still anchors a setext heading in default mode, as before', () => {
      const doc = 'Setup\n=====\n';
      const out = addExplicitAnchorIds(
        doc,
        extractHeadingInfo(doc),
        undefined,
        'a.mdx',
        'fr/a.mdx',
        'mdx'
      ).content;
      expect(out).toBe('Setup \\{#setup\\}\n=====\n');
    });

    it('anchors a heading inside an existing element without touching the element', () => {
      const out = run(
        '## Setup {#setup}\n',
        '<div id="setup">\n  ## Configuration\n</div>\n'
      );
      expect(out).toBe(
        '<div id="setup">\n  ## Configuration {#setup}\n</div>\n'
      );
      expect(run('## Setup {#setup}\n', out)).toBe(out);
    });
  });

  describe('Headings the old text-matching applier could not find', () => {
    const mintlify = {
      options: { experimentalAddHeaderAnchorIds: 'mintlify' as const },
    };

    const wrap = (source: string, translated: string) =>
      addExplicitAnchorIds(
        translated,
        extractHeadingInfo(source),
        mintlify,
        'a.mdx',
        'fr/a.mdx',
        'mdx'
      ).content;

    it('anchors headings indented inside a JSX block', () => {
      const doc = `<Tabs>
  <Tab title="Plain CSS">

    ## Setup

    Body text.

  </Tab>
</Tabs>
`;
      const out = wrap(doc, doc);

      expect(out).toContain('\n## Setup {#setup}\n');
    });

    it('anchors headings containing JSX elements', () => {
      const doc =
        '### <Badge color="yellow">Early Access</Badge> Use your own database\n';
      const out = wrap(doc, doc);

      expect(out).toContain('{#early-access-use-your-own-database}');
    });

    it('anchors headings containing escaped characters', () => {
      const doc = '### country\\_code\n';
      const out = wrap(doc, doc);

      expect(out).toContain('### country\\_code {#country_code}');
    });

    it('gives every repeated heading its own Mintlify-compatible ID', () => {
      const doc = `### Response status codes

### Response status codes

### Response status codes
`;
      const headings = extractHeadingInfo(doc);
      expect(headings.map((h) => h.slug)).toEqual([
        'response-status-codes',
        'response-status-codes-2',
        'response-status-codes-3',
      ]);

      const out = wrap(doc, doc);
      expect(out).toContain(
        '### Response status codes {#response-status-codes}\n'
      );
      expect(out).toContain(
        '### Response status codes {#response-status-codes-2}\n'
      );
      expect(out).toContain(
        '### Response status codes {#response-status-codes-3}\n'
      );
    });

    it('does not let a generated slug claim a later explicit ID', () => {
      const doc = `## Setup

## Configuration {#setup}
`;
      expect(extractHeadingInfo(doc).map((h) => h.slug)).toEqual([
        'setup-2',
        'setup',
      ]);

      const out = wrap(doc, doc);
      expect(out).toContain('## Setup {#setup-2}');
      expect(out).toContain('## Configuration {#setup}');
    });

    it('does not renumber author-written IDs', () => {
      const doc = `## Setup {#setup-plain}

## Setup {#setup-tailwind}
`;
      expect(extractHeadingInfo(doc).map((h) => h.slug)).toEqual([
        'setup-plain',
        'setup-tailwind',
      ]);
    });
  });

  describe('Source/translation heading alignment', () => {
    it('does not shift IDs when the source uses custom IDs and the translation does not', () => {
      // The source cannot be parsed as plain MDX, so before anchor-syntax
      // tolerance it fell back to line scanning, which cannot see the heading
      // nested in JSX. The translation parsed normally, so the two lists
      // disagreed and IDs landed on the wrong headings.
      const source = `## Alpha {#alpha}

<Accordion>
  ## Nested {#nested}
</Accordion>

## Beta {#beta}
`;
      const translated = `## Alpha-fr

<Accordion>
  ## Imbriqué-fr
</Accordion>

## Beta-fr
`;

      const sourceHeadings = extractHeadingInfo(source);
      expect(sourceHeadings.map((h) => h.slug)).toEqual([
        'alpha',
        'nested',
        'beta',
      ]);

      const result = addExplicitAnchorIds(
        translated,
        sourceHeadings,
        { options: { experimentalAddHeaderAnchorIds: 'mintlify' as const } },
        'a.mdx',
        'fr/a.mdx',
        'mdx'
      );

      expect(result.content).toContain('## Alpha-fr {#alpha}');
      expect(result.content).toContain('  ## Imbriqué-fr {#nested}');
      expect(result.content).toContain('## Beta-fr {#beta}');
    });
  });
  describe('Heading location is taken from the parser, not matched by shape', () => {
    const mintlify = {
      options: { experimentalAddHeaderAnchorIds: 'mintlify' as const },
    };
    const run = (doc: string, settings?: typeof mintlify) =>
      addExplicitAnchorIds(
        doc,
        extractHeadingInfo(doc),
        settings,
        'a.mdx',
        'fr/a.mdx',
        'mdx'
      ).content;

    it('inserts an inline anchor before a closing hash sequence', () => {
      // Appending after the closing `##` would stop it being a closing
      // sequence, turning it into visible heading text.
      expect(run('## Foo ##\n')).toBe('## Foo \\{#foo\\} ##\n');
    });

    it('does not mistake an ordinary container for an anchor wrapper', () => {
      // <Tab> carries an id-less title and holds the heading among other
      // content, so the heading gets its own anchor, within Mintlify's reach.
      const out = run(
        '<Tabs>\n  <Tab title="x">\n\n    ## Foo\n\n    Body.\n\n  </Tab>\n</Tabs>\n',
        mintlify
      );
      expect(out).toContain('\n## Foo {#foo}\n');
      expect(out).toContain('  <Tab title="x">');
    });

    it('does not treat a container holding more than the heading as a wrapper', () => {
      const out = run(
        '<div id="card">\n  ## Foo\n\n  Body.\n</div>\n',
        mintlify
      );
      expect(out).toBe('<div id="card">\n  ## Foo {#foo}\n\n  Body.\n</div>\n');
    });
  });
});
