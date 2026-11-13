import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { frontmatter } from 'micromark-extension-frontmatter';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import type { GeneratedSource, SourceLanguage } from './language.js';
import {
  generateVue,
  hasVueTools,
  VUE_INSTALLED_WITH,
  VUE_REQUIRES,
} from './vue/generate.js';

type MarkdownNode = { type: string; value?: string; children?: MarkdownNode[] };
type HtmlNode = DefaultTreeAdapterMap['node'];

const NO_CODE: GeneratedSource = { code: '', lang: 'js', mappings: [] };

/**
 * VitePress Markdown: `<script setup>`, `{{ … }}` and Vue components in a `.md`
 * file, read by `@vue/language-core` as VitePress does.
 */
export const markdownLanguage: SourceLanguage = {
  name: 'markdown',
  extensions: ['.md'],
  requires: VUE_REQUIRES,
  installedWith: VUE_INSTALLED_WITH,
  async generate(source, file, context) {
    // Without the tools, Markdown without a script (a README) is not reported.
    const isUnreadable = !(await hasVueTools(context));
    if (isUnreadable && !hasScript(source)) return NO_CODE;

    return generateVue(source, file, context, { vitePress: true });
  },
};

/** A `<script>` in the Markdown's HTML: not in code, a comment or frontmatter. */
function hasScript(source: string): boolean {
  const tree = fromMarkdown(source, {
    extensions: [frontmatter()],
    mdastExtensions: [frontmatterFromMarkdown()],
  });

  return htmlOf(tree).some((html) => hasScriptElement(parseFragment(html)));
}

function htmlOf(node: MarkdownNode): string[] {
  if (node.type === 'html') return [node.value ?? ''];

  return (node.children ?? []).flatMap(htmlOf);
}

function hasScriptElement(node: HtmlNode): boolean {
  if (node.nodeName === 'script') return true;

  return 'childNodes' in node && node.childNodes.some(hasScriptElement);
}
