"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Keyword {
  word: string;
  count: number;
  weight: number; // 1-10 scale
}

interface KeywordCategories {
  technical: Keyword[];
  product: Keyword[];
  process: Keyword[];
}

interface KeywordCloudProps {
  keywords: Keyword[];
  categories?: KeywordCategories;
  summary?: {
    totalKeywords: number;
    totalOccurrences: number;
  };
}

function getWeightStyles(weight: number) {
  // Weight is 1-10, map to font size and opacity
  const sizes = [
    "text-xs",
    "text-xs",
    "text-sm",
    "text-sm",
    "text-base",
    "text-base",
    "text-lg",
    "text-lg",
    "text-xl",
    "text-2xl",
  ];

  const opacities = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1];

  return {
    fontSize: sizes[Math.min(weight - 1, 9)],
    opacity: opacities[Math.min(weight - 1, 9)],
  };
}

function getColorClass(index: number) {
  const colors = [
    "text-blue-600 dark:text-blue-400",
    "text-green-600 dark:text-green-400",
    "text-purple-600 dark:text-purple-400",
    "text-orange-600 dark:text-orange-400",
    "text-pink-600 dark:text-pink-400",
    "text-cyan-600 dark:text-cyan-400",
    "text-yellow-600 dark:text-yellow-400",
    "text-red-600 dark:text-red-400",
  ];
  return colors[index % colors.length];
}

export function KeywordCloud({ keywords, categories, summary }: KeywordCloudProps) {
  // Shuffle keywords for a more organic look
  const shuffledKeywords = useMemo(() => {
    const shuffled = [...keywords];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [keywords]);

  const displayKeywords = shuffledKeywords.slice(0, 40);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Main Keyword Cloud */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Keyword Cloud</CardTitle>
          <CardDescription>
            {summary
              ? `${summary.totalKeywords} keywords with ${summary.totalOccurrences.toLocaleString()} total occurrences`
              : `${keywords.length} keywords extracted from your meetings`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayKeywords.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              No keywords found for this period
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2 py-4">
              {displayKeywords.map((keyword, index) => {
                const { fontSize, opacity } = getWeightStyles(keyword.weight);
                return (
                  <span
                    key={keyword.word}
                    className={cn(
                      "px-2 py-1 rounded hover:bg-muted transition-colors cursor-default",
                      fontSize,
                      getColorClass(index),
                    )}
                    style={{ opacity }}
                    title={`${keyword.count} occurrences`}
                  >
                    {keyword.word}
                  </span>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {categories && (
        <>
          {categories.technical.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400">Technical</CardTitle>
                <CardDescription>{categories.technical.length} keywords</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.technical.slice(0, 15).map((keyword) => (
                    <span
                      key={keyword.word}
                      className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      title={`${keyword.count} occurrences`}
                    >
                      {keyword.word}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {categories.product.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400">Product</CardTitle>
                <CardDescription>{categories.product.length} keywords</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.product.slice(0, 15).map((keyword) => (
                    <span
                      key={keyword.word}
                      className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      title={`${keyword.count} occurrences`}
                    >
                      {keyword.word}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {categories.process.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-600 dark:text-purple-400">Process</CardTitle>
                <CardDescription>{categories.process.length} keywords</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.process.slice(0, 20).map((keyword) => (
                    <span
                      key={keyword.word}
                      className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      title={`${keyword.count} occurrences`}
                    >
                      {keyword.word}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Top Keywords List */}
      <Card className={cn(categories ? "" : "md:col-span-2")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Top Keywords</CardTitle>
          <CardDescription>Most frequently mentioned terms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {keywords.slice(0, 10).map((keyword, index) => (
              <div key={keyword.word} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5">{index + 1}.</span>
                  <span className="font-medium text-sm">{keyword.word}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(keyword.weight / 10) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right">{keyword.count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
