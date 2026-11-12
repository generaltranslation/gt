import { hashSource } from 'generaltranslation/id';
import type { JsxChildren } from '@generaltranslation/format';
import { createRenderer, createSSRApp, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { vi } from 'vitest';
import type { GTPlugin } from '../index';

export function jsxHash(source: JsxChildren, context?: string): string {
  return hashSource({ source, context, dataFormat: 'JSX' });
}

export function stripFragmentMarkers(html: string): string {
  return html.replaceAll('<!--[-->', '').replaceAll('<!--]-->', '');
}

/** Renders a component through the server renderer with a GT plugin. */
export async function renderWithPlugin(
  root: Component,
  plugin: GTPlugin
): Promise<string> {
  return renderToString(createSSRApp(root).use(plugin));
}

export type HostNode = {
  children: HostNode[];
  parent?: HostNode;
  props: Record<string, unknown>;
  text?: string;
  type: string;
};

function createHostNode(type: string, text?: string): HostNode {
  return { children: [], props: {}, text, type };
}

const renderer = createRenderer<HostNode, HostNode>({
  createComment: (text) => createHostNode('#comment', text),
  createElement: (type) => createHostNode(type),
  createText: (text) => createHostNode('#text', text),
  insert(child, parent, anchor) {
    if (child.parent) {
      const previousIndex = child.parent.children.indexOf(child);
      if (previousIndex >= 0) child.parent.children.splice(previousIndex, 1);
    }
    child.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    if (index < 0) parent.children.push(child);
    else parent.children.splice(index, 0, child);
  },
  nextSibling(node) {
    if (!node.parent) return null;
    const index = node.parent.children.indexOf(node);
    return node.parent.children[index + 1] ?? null;
  },
  parentNode: (node) => node.parent ?? null,
  patchProp(element, key, _previous, value) {
    element.props[key] = value;
  },
  remove(child) {
    if (!child.parent) return;
    const index = child.parent.children.indexOf(child);
    if (index >= 0) child.parent.children.splice(index, 1);
    child.parent = undefined;
  },
  setElementText(element, text) {
    const child = createHostNode('#text', text);
    child.parent = element;
    element.children = [child];
  },
  setText(node, text) {
    node.text = text;
  },
});

/** Mounts a component on an in-memory host tree with a client renderer. */
export function mount(rootComponent: Component, plugin?: GTPlugin) {
  const root = createHostNode('root');
  const app = renderer.createApp(rootComponent);
  if (plugin) app.use(plugin);
  app.mount(root);
  return { app, root };
}

export function textContent(node: HostNode): string {
  if (node.type === '#comment') return '';
  return node.text ?? node.children.map(textContent).join('');
}

export function findElement(
  node: HostNode,
  type: string
): HostNode | undefined {
  if (node.type === type) return node;
  return node.children.map((child) => findElement(child, type)).find(Boolean);
}

export class TestCookieDocument {
  readonly writes: string[] = [];
  private readonly values = new Map<string, string>();

  constructor(cookieHeader = '') {
    for (const cookie of cookieHeader.split(';')) this.store(cookie);
  }

  get cookie(): string {
    return [...this.values]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  set cookie(serializedCookie: string) {
    this.writes.push(serializedCookie);
    this.store(serializedCookie.split(';')[0] ?? '');
  }

  get(cookieName: string): string | undefined {
    return this.values.get(cookieName);
  }

  delete(cookieName: string): void {
    this.values.delete(cookieName);
  }

  private store(cookie: string): void {
    const separator = cookie.indexOf('=');
    if (separator < 0) return;
    this.values.set(
      cookie.slice(0, separator).trim(),
      cookie.slice(separator + 1).trim()
    );
  }
}

/** Stubs `document` with an in-memory cookie jar until globals are unstubbed. */
export function installCookieDocument(cookieHeader = ''): TestCookieDocument {
  const cookieDocument = new TestCookieDocument(cookieHeader);
  vi.stubGlobal('document', cookieDocument);
  return cookieDocument;
}
