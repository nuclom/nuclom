import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { videos, users, organizations, channels, collections, members } from "@/lib/db/schema";
import { eq, and, or, ilike, desc } from "drizzle-orm";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(["all", "videos", "channels", "collections", "users"]).default("all"),
  organizationId: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(["relevance", "date", "title"]).default("relevance"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate search parameters
    const validatedParams = searchSchema.parse({
      q: searchParams.get("q"),
      type: searchParams.get("type") || "all",
      organizationId: searchParams.get("organizationId"),
      limit: Number(searchParams.get("limit")) || 20,
      offset: Number(searchParams.get("offset")) || 0,
      sortBy: searchParams.get("sortBy") || "relevance",
    });

    const { q, type, organizationId, limit, offset, sortBy } = validatedParams;
    const searchTerm = `%${q.toLowerCase()}%`;

    let results: any = {
      query: q,
      total: 0,
      videos: [],
      channels: [],
      collections: [],
      users: [],
    };

    // Check organization access if specified
    if (organizationId) {
      const memberCheck = await db
        .select()
        .from(members)
        .where(
          and(
            eq(members.organizationId, organizationId),
            eq(members.userId, session.user.id)
          )
        )
        .limit(1);

      if (memberCheck.length === 0) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Search videos
    if (type === "all" || type === "videos") {
      let baseVideoQuery = db
        .select({
          id: videos.id,
          title: videos.title,
          description: videos.description,
          duration: videos.duration,
          videoUrl: videos.videoUrl,
          thumbnailUrl: videos.thumbnailUrl,
          transcript: videos.transcript,
          aiSummary: videos.aiSummary,
          createdAt: videos.createdAt,
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
          organization: {
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
          },
        })
        .from(videos)
        .innerJoin(users, eq(videos.authorId, users.id))
        .innerJoin(organizations, eq(videos.organizationId, organizations.id))
        .where(
          and(
            or(
              ilike(videos.title, searchTerm),
              ilike(videos.description, searchTerm),
              ilike(videos.transcript, searchTerm),
              ilike(videos.aiSummary, searchTerm)
            ),
            organizationId ? eq(videos.organizationId, organizationId) : undefined
          )
        );

      // Apply sorting and execute query
      let videoResults;
      if (sortBy === "date") {
        videoResults = await baseVideoQuery.orderBy(desc(videos.createdAt)).limit(limit).offset(offset);
      } else if (sortBy === "title") {
        videoResults = await baseVideoQuery.orderBy(videos.title).limit(limit).offset(offset);
      } else {
        // For relevance, we'll keep the default order for now
        videoResults = await baseVideoQuery.limit(limit).offset(offset);
      }
      results.videos = videoResults;
    }

    // Search channels
    if (type === "all" || type === "channels") {
      let baseChannelQuery = db
        .select({
          id: channels.id,
          name: channels.name,
          description: channels.description,
          memberCount: channels.memberCount,
          createdAt: channels.createdAt,
          organization: {
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
          },
        })
        .from(channels)
        .innerJoin(organizations, eq(channels.organizationId, organizations.id))
        .where(
          and(
            or(
              ilike(channels.name, searchTerm),
              ilike(channels.description, searchTerm)
            ),
            organizationId ? eq(channels.organizationId, organizationId) : undefined
          )
        );

      let channelResults;
      if (sortBy === "date") {
        channelResults = await baseChannelQuery.orderBy(desc(channels.createdAt)).limit(limit).offset(offset);
      } else if (sortBy === "title") {
        channelResults = await baseChannelQuery.orderBy(channels.name).limit(limit).offset(offset);
      } else {
        channelResults = await baseChannelQuery.limit(limit).offset(offset);
      }
      results.channels = channelResults;
    }

    // Search collections (series)
    if (type === "all" || type === "collections") {
      let baseCollectionQuery = db
        .select({
          id: collections.id,
          name: collections.name,
          description: collections.description,
          createdAt: collections.createdAt,
          organization: {
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
          },
        })
        .from(collections)
        .innerJoin(organizations, eq(collections.organizationId, organizations.id))
        .where(
          and(
            or(
              ilike(collections.name, searchTerm),
              ilike(collections.description, searchTerm)
            ),
            organizationId ? eq(collections.organizationId, organizationId) : undefined
          )
        );

      let collectionResults;
      if (sortBy === "date") {
        collectionResults = await baseCollectionQuery.orderBy(desc(collections.createdAt)).limit(limit).offset(offset);
      } else if (sortBy === "title") {
        collectionResults = await baseCollectionQuery.orderBy(collections.name).limit(limit).offset(offset);
      } else {
        collectionResults = await baseCollectionQuery.limit(limit).offset(offset);
      }
      results.collections = collectionResults;
    }

    // Search users (only within user's organizations)
    if (type === "all" || type === "users") {
      // Get user's organizations
      const userOrgs = await db
        .select({ organizationId: members.organizationId })
        .from(members)
        .where(eq(members.userId, session.user.id));

      const orgIds = userOrgs.map(org => org.organizationId);

      if (orgIds.length > 0) {
        let baseUserQuery = db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            role: members.role,
            organization: {
              id: organizations.id,
              name: organizations.name,
              slug: organizations.slug,
            },
          })
          .from(users)
          .innerJoin(members, eq(users.id, members.userId))
          .innerJoin(organizations, eq(members.organizationId, organizations.id))
          .where(
            and(
              or(
                ilike(users.name, searchTerm),
                ilike(users.email, searchTerm)
              ),
              organizationId 
                ? eq(members.organizationId, organizationId)
                : eq(members.organizationId, orgIds[0]) // For now, just search first org if no specific org
            )
          );

        let userResults;
        if (sortBy === "title") {
          userResults = await baseUserQuery.orderBy(users.name).limit(limit).offset(offset);
        } else {
          userResults = await baseUserQuery.limit(limit).offset(offset);
        }
        results.users = userResults;
      }
    }

    // Calculate total results
    results.total = results.videos.length + results.channels.length + results.collections.length + results.users.length;

    return NextResponse.json({
      success: true,
      data: results,
      pagination: {
        limit,
        offset,
        total: results.total,
      },
    });

  } catch (error) {
    console.error("Error performing search:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid search parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}