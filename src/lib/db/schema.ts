import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  unique,
} from 'drizzle-orm/pg-core';

export const workspaceRoleEnum = pgEnum('WorkspaceRole', ['OWNER', 'ADMIN', 'MEMBER']);

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').unique().notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaceUsers = pgTable('workspace_users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  role: workspaceRoleEnum('role').default('MEMBER').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserWorkspace: unique().on(table.userId, table.workspaceId),
}));

export const channels = pgTable('channels', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  memberCount: integer('member_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const series = pgTable('series', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const videos = pgTable('videos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  description: text('description'),
  duration: text('duration').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  videoUrl: text('video_url'),
  authorId: text('author_id').notNull().references(() => users.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').references(() => channels.id),
  seriesId: text('series_id').references(() => series.id),
  transcript: text('transcript'),
  aiSummary: text('ai_summary'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const comments = pgTable('comments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  content: text('content').notNull(),
  timestamp: text('timestamp'),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references(() => comments.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const videoProgress = pgTable('video_progress', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  currentTime: text('current_time').notNull(),
  completed: boolean('completed').default(false).notNull(),
  lastWatchedAt: timestamp('last_watched_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserVideo: unique().on(table.userId, table.videoId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaceUsers),
  videos: many(videos),
  comments: many(comments),
  videoProgresses: many(videoProgress),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  users: many(workspaceUsers),
  videos: many(videos),
  channels: many(channels),
  series: many(series),
}));

export const workspaceUsersRelations = relations(workspaceUsers, ({ one }) => ({
  user: one(users, {
    fields: [workspaceUsers.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [workspaceUsers.workspaceId],
    references: [workspaces.id],
  }),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  author: one(users, {
    fields: [videos.authorId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [videos.workspaceId],
    references: [workspaces.id],
  }),
  channel: one(channels, {
    fields: [videos.channelId],
    references: [channels.id],
  }),
  series: one(series, {
    fields: [videos.seriesId],
    references: [series.id],
  }),
  comments: many(comments),
  videoProgresses: many(videoProgress),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [channels.workspaceId],
    references: [workspaces.id],
  }),
  videos: many(videos),
}));

export const seriesRelations = relations(series, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [series.workspaceId],
    references: [workspaces.id],
  }),
  videos: many(videos),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [comments.videoId],
    references: [videos.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'CommentThread',
  }),
  replies: many(comments, {
    relationName: 'CommentThread',
  }),
}));

export const videoProgressRelations = relations(videoProgress, ({ one }) => ({
  user: one(users, {
    fields: [videoProgress.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [videoProgress.videoId],
    references: [videos.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceUser = typeof workspaceUsers.$inferSelect;
export type NewWorkspaceUser = typeof workspaceUsers.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Series = typeof series.$inferSelect;
export type NewSeries = typeof series.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type VideoProgress = typeof videoProgress.$inferSelect;
export type NewVideoProgress = typeof videoProgress.$inferInsert;
