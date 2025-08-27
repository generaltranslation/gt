import { describe, it, expect } from 'vitest';
import { addExplicitAnchorIds } from '../addExplicitAnchorIds';

describe('addExplicitAnchorIds', () => {
  it('should add explicit IDs to all headings', () => {
    const input = `# Getting Started

## Code-based workflow

This section explains the code workflow.

<Card href="#code-based-workflow">Link to workflow</Card>

## Web editor workflow

Another section here.

[Link to web editor](#web-editor-workflow)
`;

    const result = addExplicitAnchorIds(input);

    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(3);
    expect(result.addedIds).toEqual([
      { heading: 'Getting Started', id: 'getting-started' },
      { heading: 'Code-based workflow', id: 'code-based-workflow' },
      { heading: 'Web editor workflow', id: 'web-editor-workflow' },
    ]);

    expect(result.content).toContain(
      '<div id="getting-started">\n\n# Getting Started\n\n</div>'
    );
    expect(result.content).toContain(
      '<div id="code-based-workflow">\n\n## Code-based workflow\n\n</div>'
    );
    expect(result.content).toContain(
      '<div id="web-editor-workflow">\n\n## Web editor workflow\n\n</div>'
    );
  });

  it('should skip headings that already have explicit IDs', () => {
    const input = `## Already has ID {#custom-id}

<Card href="#custom-id">Link to section</Card>
`;

    const result = addExplicitAnchorIds(input);

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

    const result = addExplicitAnchorIds(input);

    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(2);
    expect(result.addedIds).toEqual([
      { heading: 'No Links Here', id: 'no-links-here' },
      { heading: 'Another Section', id: 'another-section' },
    ]);
    expect(result.content).toContain(
      '<div id="no-links-here">\n\n## No Links Here\n\n</div>'
    );
    expect(result.content).toContain(
      '<div id="another-section">\n\n## Another Section\n\n</div>'
    );
  });

  it('should handle JSX href attributes in raw JSX', () => {
    const input = `## Implementation Details

<div>
  <a href="#implementation-details">Link to implementation</a>
</div>
`;

    const result = addExplicitAnchorIds(input);

    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(1);
    expect(result.addedIds[0]).toEqual({
      heading: 'Implementation Details',
      id: 'implementation-details',
    });
    expect(result.content).toContain(
      '<div id="implementation-details">\n\n## Implementation Details\n\n</div>'
    );
  });

  it('should handle special characters in headings', () => {
    const input = `## Code & Design Workflow!

[Link here](#code-design-workflow)
`;

    const result = addExplicitAnchorIds(input);

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

    const result = addExplicitAnchorIds(input);

    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(1);
    expect(result.addedIds[0]).toEqual({
      heading: 'Some Section',
      id: 'some-section',
    });
    expect(result.content).toContain(
      '<div id="some-section">\n\n## Some Section\n\n</div>'
    );
  });

  it('should handle most markdown content successfully', () => {
    const input = `## Section
[Unclosed link(#test
`;

    const result = addExplicitAnchorIds(input);

    // Should process the heading even if link syntax is malformed
    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(1);
    expect(result.addedIds[0]).toEqual({
      heading: 'Section',
      id: 'section',
    });
    expect(result.content).toContain(
      '<div id="section">\n\n## Section\n\n</div>'
    );
  });

  // Edge case tests that we expect to fail currently
  it('should handle headings with formatting (currently fails)', () => {
    const input = `## **Bold Heading** with formatting

<Card href="#bold-heading-with-formatting">Link to bold heading</Card>

## \`Code Heading\` example

<Card href="#code-heading-example">Link to code heading</Card>
`;

    const result = addExplicitAnchorIds(input);

    // This test documents current behavior - we expect it to fail
    // AST extracts "Bold Heading with formatting" but regex looks for "## **Bold Heading** with formatting"
    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(2);

    // These assertions will likely fail with current implementation
    expect(result.content).toContain('<div id="bold-heading-with-formatting">');
    expect(result.content).toContain('<div id="code-heading-example">');
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

    const result = addExplicitAnchorIds(input);

    // Should only process the real heading, not the one in code block
    expect(result.hasChanges).toBe(true);
    expect(result.addedIds).toHaveLength(1);
    expect(result.addedIds[0]).toEqual({
      heading: 'Real Heading',
      id: 'real-heading',
    });

    // Should wrap real heading but NOT the code block heading
    expect(result.content).toContain(
      '<div id="real-heading">\n\n## Real Heading\n\n</div>'
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
