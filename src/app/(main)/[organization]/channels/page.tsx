"use client";

import { useState, useEffect } from "react";
import { Plus, Hash, Users, Settings, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Channel {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function ChannelsPage({ params }: { params: Promise<{ organization: string }> }) {
  const [organization, setOrganization] = useState<string>("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    params.then(({ organization }) => {
      setOrganization(organization);
      loadChannels(organization);
    });
  }, [params]);

  const loadChannels = async (orgSlug: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizations/${orgSlug}/channels`);
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load channels",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error loading channels:", error);
      toast({
        title: "Error",
        description: "An error occurred while loading channels",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredChannels = channels
    .filter(channel => 
      channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (channel.description && channel.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "members":
          return b.memberCount - a.memberCount;
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className="text-muted-foreground">
            Organize your content into channels for better discovery and collaboration.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="w-fit">
          <Plus className="h-4 w-4 mr-2" />
          Create Channel
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="members">Members</SelectItem>
              <SelectItem value="date">Created Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Channels Grid */}
      {filteredChannels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredChannels.map((channel) => (
            <Card key={channel.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Hash className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{channel.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {channel.memberCount} member{channel.memberCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {channel.description && (
                <CardContent className="pt-0">
                  <CardDescription className="line-clamp-2">
                    {channel.description}
                  </CardDescription>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-16">
          <CardContent>
            <Hash className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? "No channels found" : "No channels yet"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? "Try adjusting your search terms."
                : "Create your first channel to start organizing your content."}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Channel
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Channel Modal would go here */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create Channel</CardTitle>
              <CardDescription>
                Create a new channel to organize your content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Channel Name</label>
                <Input placeholder="Enter channel name" />
              </div>
              <div>
                <label className="text-sm font-medium">Description (Optional)</label>
                <Input placeholder="Enter description" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button>Create Channel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}