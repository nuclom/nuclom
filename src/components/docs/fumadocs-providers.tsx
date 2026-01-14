'use client';

import type * as PageTree from 'fumadocs-core/page-tree';
import { SidebarProvider } from 'fumadocs-ui/components/sidebar/base';
import { TreeContextProvider } from 'fumadocs-ui/contexts/tree';

interface FumadocsProvidersProps {
  tree: PageTree.Root;
  children: React.ReactNode;
}

export function FumadocsProviders({ tree, children }: FumadocsProvidersProps) {
  return (
    <TreeContextProvider tree={tree}>
      <SidebarProvider>{children}</SidebarProvider>
    </TreeContextProvider>
  );
}
