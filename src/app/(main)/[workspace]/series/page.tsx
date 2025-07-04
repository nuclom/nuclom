import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const seriesData = [
  {
    id: "nextjs-conf",
    name: "Next.js Conf 2025",
    videoCount: 12,
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
  },
  {
    id: "design-talks",
    name: "Design Talks",
    videoCount: 8,
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
  },
  {
    id: "onboarding",
    name: "New Hire Onboarding",
    videoCount: 5,
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
  },
];

export default async function SeriesListPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Series</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {seriesData.map((series) => (
          <Link key={series.id} href={`/${workspace}/series/${series.id}`}>
            <Card className="group hover:border-primary transition-colors">
              <CardHeader className="p-0">
                <div className="relative aspect-video overflow-hidden rounded-t-lg">
                  <Image
                    src={series.thumbnailUrl || "/placeholder.svg"}
                    alt={series.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <CardTitle className="text-lg">{series.name}</CardTitle>
                <p className="text-sm text-gray-400">{series.videoCount} videos</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
