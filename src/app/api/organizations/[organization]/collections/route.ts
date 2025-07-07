import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  // Return mock collections for E2E tests
  return NextResponse.json({
    collections: [
      { id: "collection-1", name: "React Fundamentals", description: "Learn React from basics to advanced", videoCount: 12, createdAt: "2023-12-01T00:00:00Z", updatedAt: "2023-12-10T00:00:00Z", organization: { id: "org-1", name: "Test Org", slug: "test-org" } },
      { id: "collection-2", name: "TypeScript Deep Dive", description: "Master TypeScript concepts", videoCount: 8, createdAt: "2023-12-02T00:00:00Z", updatedAt: "2023-12-10T00:00:00Z", organization: { id: "org-1", name: "Test Org", slug: "test-org" } }
    ]
  });
}

export async function POST(req: NextRequest) {
  // Accept creation of a new collection (series)
  const { name, description } = await req.json();
  return NextResponse.json({
    id: "new-collection-id",
    name,
    description,
    videoCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organization: { id: "org-1", name: "Test Org", slug: "test-org" }
  });
}
