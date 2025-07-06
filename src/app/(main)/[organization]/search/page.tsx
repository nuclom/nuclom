"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { VideoCard } from "@/components/video-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Video, Users, Folder, Hash, Filter } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
  query: string;
  total: number;
  videos: any[];
  channels: any[];
  collections: any[];
  users: any[];
}

export default function SearchPage({ params }: { params: Promise<{ organization: string }> }) {
  const [organization, setOrganization] = useState<string>("");
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("relevance");
  const { toast } = useToast();

  useEffect(() => {
    params.then(({ organization }) => {
      setOrganization(organization);
    });
    setSearchParams(new URLSearchParams(window.location.search));
  }, [params]);

  useEffect(() => {
    if (searchParams) {
      const q = searchParams.get("q");
      if (q) {
        setQuery(q);
        performSearch(q, activeTab, sortBy);
      }
    }
  }, [searchParams, activeTab, sortBy]);

  const performSearch = async (searchQuery: string, type: string = "all", sort: string = "relevance") => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&type=${type}&sortBy=${sort}&organizationId=${organization}`
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data.data);
      } else {
        toast({
          title: "Search Error",
          description: "Failed to perform search. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search Error",
        description: "An error occurred while searching. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (query) {
      performSearch(query, value, sortBy);
    }
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    if (query) {
      performSearch(query, activeTab, value);
    }
  };

  const getTabCount = (type: string) => {
    if (!results) return 0;
    switch (type) {
      case "videos": return results.videos.length;
      case "channels": return results.channels.length;
      case "collections": return results.collections.length;
      case "users": return results.users.length;
      default: return results.total;
    }
  };

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Search className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Start searching</h1>
        <p className="text-muted-foreground">Use the search bar above to find videos, channels, and more.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            Search results for <span className="text-primary">"{query}"</span>
          </h1>
          {results && (
            <p className="text-muted-foreground">
              {results.total} result{results.total !== 1 ? 's' : ''} found
            </p>
          )}
        </div>
        
        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Search Results */}
      {results && !loading && (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              All
              <Badge variant="secondary" className="ml-1">{getTabCount("all")}</Badge>
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Videos
              <Badge variant="secondary" className="ml-1">{getTabCount("videos")}</Badge>
            </TabsTrigger>
            <TabsTrigger value="channels" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Channels
              <Badge variant="secondary" className="ml-1">{getTabCount("channels")}</Badge>
            </TabsTrigger>
            <TabsTrigger value="collections" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Series
              <Badge variant="secondary" className="ml-1">{getTabCount("collections")}</Badge>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              People
              <Badge variant="secondary" className="ml-1">{getTabCount("users")}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* All Results Tab */}
          <TabsContent value="all" className="space-y-8">
            {results.videos.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4">Videos</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {results.videos.slice(0, 8).map((video) => (
                    <VideoCard key={video.id} video={video} organization={organization} />
                  ))}
                </div>
              </section>
            )}

            {results.channels.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4">Channels</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.channels.slice(0, 6).map((channel) => (
                    <Card key={channel.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Hash className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{channel.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {channel.memberCount} members
                            </p>
                          </div>
                        </div>
                        {channel.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {channel.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {results.collections.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4">Series</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.collections.slice(0, 6).map((collection) => (
                    <Card key={collection.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Folder className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{collection.name}</h3>
                          </div>
                        </div>
                        {collection.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {collection.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {results.users.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4">People</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.users.slice(0, 6).map((user) => (
                    <Card key={user.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{user.name}</h3>
                            <p className="text-sm text-muted-foreground capitalize">
                              {user.role} in {user.organization.name}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {results.total === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold mb-2">No results found</h2>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search terms or filters.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos">
            {results.videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {results.videos.map((video) => (
                  <VideoCard key={video.id} video={video} organization={organization} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Video className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold mb-2">No videos found</h2>
                <p className="text-muted-foreground">No videos match your search criteria.</p>
              </div>
            )}
          </TabsContent>

          {/* Other tabs would be similar... */}
          <TabsContent value="channels">
            {results.channels.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.channels.map((channel) => (
                  <Card key={channel.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Hash className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{channel.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {channel.memberCount} members
                          </p>
                        </div>
                      </div>
                      {channel.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {channel.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Hash className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold mb-2">No channels found</h2>
                <p className="text-muted-foreground">No channels match your search criteria.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="collections">
            {results.collections.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.collections.map((collection) => (
                  <Card key={collection.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Folder className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{collection.name}</h3>
                        </div>
                      </div>
                      {collection.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {collection.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Folder className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold mb-2">No series found</h2>
                <p className="text-muted-foreground">No series match your search criteria.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users">
            {results.users.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.users.map((user) => (
                  <Card key={user.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{user.name}</h3>
                          <p className="text-sm text-muted-foreground capitalize">
                            {user.role} in {user.organization.name}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold mb-2">No people found</h2>
                <p className="text-muted-foreground">No people match your search criteria.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
