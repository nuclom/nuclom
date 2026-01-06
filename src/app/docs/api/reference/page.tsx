import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { OpenApiViewer } from '@/components/docs/openapi-viewer';

export const metadata: Metadata = {
  title: 'API Reference',
  description: 'Complete API reference for the Nuclom video collaboration platform',
};

export default function ApiReferencePage() {
  return (
    <DocsPage>
      <DocsTitle>API Reference</DocsTitle>
      <DocsDescription>
        Complete reference documentation for the Nuclom API, auto-generated from the OpenAPI specification.
      </DocsDescription>
      <DocsBody>
        <OpenApiViewer />
      </DocsBody>
    </DocsPage>
  );
}
