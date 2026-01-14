import type * as PageTree from 'fumadocs-core/page-tree';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { FumadocsProviders } from '@/components/docs/fumadocs-providers';
import { OpenApiViewer } from '@/components/docs/openapi-viewer';

export const metadata: Metadata = {
  title: 'API Reference',
  description: 'Complete API reference for the Nuclom video collaboration platform',
};

const apiReferenceTree: PageTree.Root = {
  name: 'Docs',
  children: [
    {
      type: 'folder',
      name: 'API Reference',
      defaultOpen: true,
      children: [
        {
          type: 'page',
          name: 'API Reference',
          url: '/docs/api/reference',
        },
      ],
    },
  ],
};

export default function ApiReferencePage() {
  return (
    <FumadocsProviders tree={apiReferenceTree}>
      <DocsPage>
        <DocsTitle>API Reference</DocsTitle>
        <DocsDescription>
          Complete reference documentation for the Nuclom API, auto-generated from the OpenAPI specification.
        </DocsDescription>
        <DocsBody>
          <OpenApiViewer />
        </DocsBody>
      </DocsPage>
    </FumadocsProviders>
  );
}
