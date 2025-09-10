import { describe, it, expect, vi } from 'vitest';
import {
  addExplicitAnchorIds,
  extractHeadingInfo,
} from '../addExplicitAnchorIds';

describe('addExplicitAnchorIds', () => {
  // Mock settings for different modes
  const standardSettings = undefined; // No settings = standard mode
  const urlLocalizationSettings = {
    options: {
      experimentalLocalizeStaticUrls: true,
    },
  };
  const mintlifySettings = {
    options: {
      experimentalLocalizeStaticUrls: true,
      experimentalAddHeaderAnchorIds: 'mintlify' as const,
    },
  };
  it('should add explicit IDs to all headings (default \\{#id} format)', () => {
    const input = `# Getting Started

## Code-based workflow

This section explains the code workflow.

<Card href="#code-based-workflow">Link to workflow</Card>

## Web editor workflow

Another section here.

[Link to web editor](#web-editor-workflow)
`;

    // Extract heading info from source (same as translated in this test case)
    const sourceHeadingMap = extractHeadingInfo(input);
    const result = addExplicitAnchorIds(input, sourceHeadingMap);

    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(3);
    expect(result.addedIds).toEqual([
      { heading: 'Getting Started', id: 'getting-started' },
      { heading: 'Code-based workflow', id: 'code-based-workflow' },
      { heading: 'Web editor workflow', id: 'web-editor-workflow' },
    ]);

    expect(result.content).toContain('# Getting Started \\{#getting-started\\}');
    expect(result.content).toContain(
      '## Code-based workflow \\{#code-based-workflow\\}'
    );
    expect(result.content).toContain(
      '## Web editor workflow \\{#web-editor-workflow\\}'
    );
  });

  it('should skip headings that already have explicit IDs', () => {
    const input = `## Already has ID \\{#custom-id}

<Card href="#custom-id">Link to section</Card>
`;

    const sourceHeadingMap = extractHeadingInfo(input);
    const result = addExplicitAnchorIds(input, sourceHeadingMap);

    expect(result.hasChanges).toBe(false);
    expect(result.addedIds).toHaveLength(0);
    expect(result.content).toBe(input);
  });

  it('should add IDs to all headings even without anchor links', () => {
    const input = `## No Links Here

This heading has no anchor links pointing to it.

## Another Section

No links here either.
`;

    const sourceHeadingMap = extractHeadingInfo(input);
    const result = addExplicitAnchorIds(input, sourceHeadingMap);

    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(2);
    expect(result.addedIds).toEqual([
      { heading: 'No Links Here', id: 'no-links-here' },
      { heading: 'Another Section', id: 'another-section' },
    ]);
    expect(result.content).toContain('## No Links Here \\{#no-links-here\\}');
    expect(result.content).toContain('## Another Section \\{#another-section\\}');
  });

  it('should handle JSX href attributes in raw JSX', () => {
    const input = `## Implementation Details

<div>
  <a href="#implementation-details">Link to implementation</a>
</div>
`;

    const sourceHeadingMap = extractHeadingInfo(input);
    const result = addExplicitAnchorIds(input, sourceHeadingMap);

    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(1);
    expect(result.addedIds[0]).toEqual({
      heading: 'Implementation Details',
      id: 'implementation-details',
    });
    expect(result.content).toContain(
      '## Implementation Details \\{#implementation-details\\}'
    );
  });

  it('should handle special characters in headings', () => {
    const input = `## Code & Design Workflow!

[Link here](#code-design-workflow)
`;

    const sourceHeadingMap = extractHeadingInfo(input);
    const result = addExplicitAnchorIds(input, sourceHeadingMap);

    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(1);
    expect(result.addedIds[0]).toEqual({
      heading: 'Code & Design Workflow!',
      id: 'code-design-workflow',
    });
  });

  it('should add IDs even if no anchor links exist', () => {
    const input = `## Some Section

Regular content without any anchor links.
`;

    const sourceHeadingMap = extractHeadingInfo(input);
    const result = addExplicitAnchorIds(input, sourceHeadingMap);

    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(1);
    expect(result.addedIds[0]).toEqual({
      heading: 'Some Section',
      id: 'some-section',
    });
    expect(result.content).toContain('## Some Section \\{#some-section\\}');
  });

  it('should handle most markdown content successfully', () => {
    const input = `## Section
[Unclosed link(#test
`;

    const sourceHeadingMap = extractHeadingInfo(input);
    const result = addExplicitAnchorIds(input, sourceHeadingMap);

    // Should process the heading even if link syntax is malformed
    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(1);
    expect(result.addedIds[0]).toEqual({
      heading: 'Section',
      id: 'section',
    });
    expect(result.content).toContain('## Section \\{#section\\}');
  });

  // Edge case tests that we expect to fail currently
  it('should handle headings with formatting (currently fails)', () => {
    const input = `## **Bold Heading** with formatting

<Card href="#bold-heading-with-formatting">Link to bold heading</Card>

## \`Code Heading\` example

<Card href="#code-heading-example">Link to code heading</Card>
`;

    const sourceHeadingMap = extractHeadingInfo(input);
    const result = addExplicitAnchorIds(input, sourceHeadingMap);

    // This test documents current behavior - we expect it to fail
    // AST extracts "Bold Heading with formatting" but regex looks for "## **Bold Heading** with formatting"
    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(2);

    // Should now handle formatted headings correctly
    expect(result.content).toContain(
      '## **Bold Heading** with formatting \\{#bold-heading-with-formatting\\}'
    );
    expect(result.content).toContain(
      '## `Code Heading` example \\{#code-heading-example\\}'
    );
  });

  it('should not process headings inside code blocks (currently fails)', () => {
    const input = `## Real Heading

This is real content.

\`\`\`markdown
## Fake Heading In Code Block
This is just an example
\`\`\`

<Card href="#real-heading">Link to real heading</Card>
`;

    const sourceHeadingMap = extractHeadingInfo(input);
    const result = addExplicitAnchorIds(input, sourceHeadingMap);

    // Should only process the real heading, not the one in code block
    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(1);
    expect(result.addedIds[0]).toEqual({
      heading: 'Real Heading',
      id: 'real-heading',
    });

    // Should add ID to real heading but NOT the code block heading
    expect(result.content).toContain('## Real Heading \\{#real-heading\\}');
    expect(result.content).not.toContain(
      '<div id="fake-heading-in-code-block">'
    );

    // Code block should remain unchanged
    expect(result.content).toContain(
      '```markdown\n## Fake Heading In Code Block\nThis is just an example\n```'
    );
  });

  // Comprehensive dual tests for both modes
  describe('Standard Mode vs Mintlify Mode', () => {
    const basicInput = `# Getting Started

## Code-based workflow

This section explains the code workflow.

## Web editor workflow

Another section here.
`;

    it('should add \\{#id} format in standard mode', () => {
      const sourceHeadingMap = extractHeadingInfo(basicInput);
      const result = addExplicitAnchorIds(
        basicInput,
        sourceHeadingMap,
        standardSettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(3);

      expect(result.content).toContain('# Getting Started \\{#getting-started\\}');
      expect(result.content).toContain(
        '## Code-based workflow \\{#code-based-workflow\\}'
      );
      expect(result.content).toContain(
        '## Web editor workflow \\{#web-editor-workflow\\}'
      );

      // Should NOT contain div wrapping
      expect(result.content).not.toContain('<div id="getting-started">');
    });

    it('should use inline \\{#id} format when experimentalLocalizeStaticUrls is enabled', () => {
      const sourceHeadingMap = extractHeadingInfo(basicInput);
      const result = addExplicitAnchorIds(
        basicInput,
        sourceHeadingMap,
        urlLocalizationSettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(3);

      // Should use inline \\{#id} format (same as standard mode)
      expect(result.content).toContain('# Getting Started \\{#getting-started\\}');
      expect(result.content).toContain(
        '## Code-based workflow \\{#code-based-workflow\\}'
      );
      expect(result.content).toContain(
        '## Web editor workflow \\{#web-editor-workflow\\}'
      );

      // Should NOT contain div wrapping
      expect(result.content).not.toContain('<div id="getting-started">');
    });

    it('should add div wrapping in Mintlify mode', () => {
      const sourceHeadingMap = extractHeadingInfo(basicInput);
      const result = addExplicitAnchorIds(
        basicInput,
        sourceHeadingMap,
        mintlifySettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(3);

      expect(result.content).toContain(
        '<div id="getting-started">\n  # Getting Started\n</div>'
      );
      expect(result.content).toContain(
        '<div id="code-based-workflow">\n  ## Code-based workflow\n</div>'
      );
      expect(result.content).toContain(
        '<div id="web-editor-workflow">\n  ## Web editor workflow\n</div>'
      );

      // Should NOT contain \\{#id} format
      expect(result.content).not.toContain('\\{#getting-started\\}');
    });
  });

  describe('Formatted Headings - Both Modes', () => {
    const formattedInput = `## **Bold Heading** with formatting

## \`Code Heading\` example

## *Italic* and **mixed** formatting
`;

    it('should handle formatted headings in standard mode', () => {
      const sourceHeadingMap = extractHeadingInfo(formattedInput);
      const result = addExplicitAnchorIds(
        formattedInput,
        sourceHeadingMap,
        standardSettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(3);

      expect(result.content).toContain(
        '## **Bold Heading** with formatting \\{#bold-heading-with-formatting\\}'
      );
      expect(result.content).toContain(
        '## `Code Heading` example \\{#code-heading-example\\}'
      );
      expect(result.content).toContain(
        '## *Italic* and **mixed** formatting \\{#italic-and-mixed-formatting\\}'
      );
    });

    it('should handle formatted headings in Mintlify mode', () => {
      const sourceHeadingMap = extractHeadingInfo(formattedInput);
      const result = addExplicitAnchorIds(
        formattedInput,
        sourceHeadingMap,
        mintlifySettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(3);

      expect(result.content).toContain(
        '<div id="bold-heading-with-formatting">\n  ## **Bold Heading** with formatting\n</div>'
      );
      expect(result.content).toContain(
        '<div id="code-heading-example">\n  ## `Code Heading` example\n</div>'
      );
      expect(result.content).toContain(
        '<div id="italic-and-mixed-formatting">\n  ## *Italic* and **mixed** formatting\n</div>'
      );
    });
  });

  describe('Code Block Protection - Both Modes', () => {
    const codeBlockInput = `## Real Heading

This is real content.

\`\`\`markdown
## Fake Heading In Code Block
This is just an example
\`\`\`

## Another Real Heading

More content.
`;

    it('should ignore code blocks in standard mode', () => {
      const sourceHeadingMap = extractHeadingInfo(codeBlockInput);
      const result = addExplicitAnchorIds(
        codeBlockInput,
        sourceHeadingMap,
        standardSettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(2);
      expect(result.addedIds).toEqual([
        { heading: 'Real Heading', id: 'real-heading' },
        { heading: 'Another Real Heading', id: 'another-real-heading' },
      ]);

      expect(result.content).toContain('## Real Heading \\{#real-heading\\}');
      expect(result.content).toContain(
        '## Another Real Heading \\{#another-real-heading\\}'
      );
      expect(result.content).not.toContain('\\{#fake-heading-in-code-block\\}');

      // Code block should remain unchanged
      expect(result.content).toContain(
        '```markdown\n## Fake Heading In Code Block\nThis is just an example\n```'
      );
    });

    it('should ignore code blocks in Mintlify mode', () => {
      const sourceHeadingMap = extractHeadingInfo(codeBlockInput);
      const result = addExplicitAnchorIds(
        codeBlockInput,
        sourceHeadingMap,
        mintlifySettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(2);

      expect(result.content).toContain(
        '<div id="real-heading">\n  ## Real Heading\n</div>'
      );
      expect(result.content).toContain(
        '<div id="another-real-heading">\n  ## Another Real Heading\n</div>'
      );
      expect(result.content).not.toContain(
        '<div id="fake-heading-in-code-block">'
      );

      // Code block should remain unchanged
      expect(result.content).toContain(
        '```markdown\n## Fake Heading In Code Block\nThis is just an example\n```'
      );
    });
  });

  describe('Special Characters - Both Modes', () => {
    const specialCharsInput = `## Code & Design Workflow!

## API Reference (v2.0)

## Getting Started: Step 1

## What's New?
`;

    it('should handle special characters in standard mode', () => {
      const sourceHeadingMap = extractHeadingInfo(specialCharsInput);
      const result = addExplicitAnchorIds(
        specialCharsInput,
        sourceHeadingMap,
        standardSettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(4);

      expect(result.content).toContain(
        '## Code & Design Workflow! \\{#code-design-workflow\\}'
      );
      expect(result.content).toContain(
        '## API Reference (v2.0) \\{#api-reference-v20\\}'
      );
      expect(result.content).toContain(
        '## Getting Started: Step 1 \\{#getting-started-step-1\\}'
      );
      expect(result.content).toContain("## What's New? \\{#whats-new\\}");
    });

    it('should handle special characters in Mintlify mode', () => {
      const sourceHeadingMap = extractHeadingInfo(specialCharsInput);
      const result = addExplicitAnchorIds(
        specialCharsInput,
        sourceHeadingMap,
        mintlifySettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(4);

      expect(result.content).toContain(
        '<div id="code-design-workflow">\n  ## Code & Design Workflow!\n</div>'
      );
      expect(result.content).toContain(
        '<div id="api-reference-v20">\n  ## API Reference (v2.0)\n</div>'
      );
      expect(result.content).toContain(
        '<div id="getting-started-step-1">\n  ## Getting Started: Step 1\n</div>'
      );
      expect(result.content).toContain(
        '<div id="whats-new">\n  ## What\'s New?\n</div>'
      );
    });
  });

  describe('All Heading Levels - Both Modes', () => {
    const allLevelsInput = `# H1 Heading

## H2 Heading

### H3 Heading

#### H4 Heading

##### H5 Heading

###### H6 Heading
`;

    it('should handle all heading levels in standard mode', () => {
      const sourceHeadingMap = extractHeadingInfo(allLevelsInput);
      const result = addExplicitAnchorIds(
        allLevelsInput,
        sourceHeadingMap,
        standardSettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(6);

      expect(result.content).toContain('# H1 Heading \\{#h1-heading\\}');
      expect(result.content).toContain('## H2 Heading \\{#h2-heading\\}');
      expect(result.content).toContain('### H3 Heading \\{#h3-heading\\}');
      expect(result.content).toContain('#### H4 Heading \\{#h4-heading\\}');
      expect(result.content).toContain('##### H5 Heading \\{#h5-heading\\}');
      expect(result.content).toContain('###### H6 Heading \\{#h6-heading\\}');
    });

    it('should handle all heading levels in Mintlify mode', () => {
      const sourceHeadingMap = extractHeadingInfo(allLevelsInput);
      const result = addExplicitAnchorIds(
        allLevelsInput,
        sourceHeadingMap,
        mintlifySettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(6);

      expect(result.content).toContain(
        '<div id="h1-heading">\n  # H1 Heading\n</div>'
      );
      expect(result.content).toContain(
        '<div id="h2-heading">\n  ## H2 Heading\n</div>'
      );
      expect(result.content).toContain(
        '<div id="h3-heading">\n  ### H3 Heading\n</div>'
      );
      expect(result.content).toContain(
        '<div id="h4-heading">\n  #### H4 Heading\n</div>'
      );
      expect(result.content).toContain(
        '<div id="h5-heading">\n  ##### H5 Heading\n</div>'
      );
      expect(result.content).toContain(
        '<div id="h6-heading">\n  ###### H6 Heading\n</div>'
      );
    });
  });

  describe('Header Count Validation', () => {
    it('should work when source and translated files have same header count', () => {
      const sourceContent = `## Header 1

Content here.

## Header 2

More content.`;

      const translatedContent = `## Cabecera 1

Contenido aquí.

## Cabecera 2

Más contenido.`;

      const sourceHeadingMap = extractHeadingInfo(sourceContent);

      // This should work fine - same number of headers
      const result = addExplicitAnchorIds(
        translatedContent,
        sourceHeadingMap,
        standardSettings
      );

      expect(result.hasChanges).toBe(true);
      expect(result.addedIds).toHaveLength(2);
      expect(result.content).toContain('## Cabecera 1 \\{#header-1\\}');
      expect(result.content).toContain('## Cabecera 2 \\{#header-2\\}');
    });

    // Note: Testing the header count mismatch failure is complex in a unit test environment
    // because logErrorAndExit calls process.exit(). The validation logic is there and will
    // work in production - it catches cases where source file was edited after translation,
    // causing different header counts between source and translated files.
  });
});
