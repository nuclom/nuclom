import { auth } from '@nuclom/lib/auth';
import { db } from '@nuclom/lib/db';
import { type WorkflowTemplateType, workflowTemplates } from '@nuclom/lib/db/schema';
import { logger } from '@nuclom/lib/logger';
import { safeParse } from '@nuclom/lib/validation';
import { and, desc, eq } from 'drizzle-orm';
import { Schema } from 'effect';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

const CreateTemplateSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  type: Schema.optional(
    Schema.Literal('meeting_recap', 'tutorial', 'product_demo', 'training', 'onboarding', 'marketing', 'custom'),
  ),
  icon: Schema.optional(Schema.String),
  config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  organizationId: Schema.String,
});

// Default system templates
const SYSTEM_TEMPLATES = [
  {
    id: 'system-meeting-recap',
    name: 'Meeting Recap',
    description: 'Automatically extract action items, decisions, and key discussion points from meeting recordings',
    type: 'meeting_recap' as const,
    icon: 'Users',
    config: {
      autoTranscribe: true,
      generateSummary: true,
      extractChapters: true,
      extractActionItems: true,
      detectCodeSnippets: false,
      subtitleLanguages: ['en'],
      notifyOnComplete: true,
      customPrompts: {
        summaryPrompt:
          'Generate a meeting summary that includes: 1) Key decisions made, 2) Action items with owners, 3) Topics discussed, 4) Next steps',
        actionItemsPrompt:
          'Extract all action items from this meeting. Include the person responsible if mentioned, and the deadline if specified.',
      },
    },
    isSystem: true,
    isActive: true,
  },
  {
    id: 'system-tutorial',
    name: 'Tutorial / How-To',
    description: 'Optimized for step-by-step tutorials with chapters and code snippet detection',
    type: 'tutorial' as const,
    icon: 'GraduationCap',
    config: {
      autoTranscribe: true,
      generateSummary: true,
      extractChapters: true,
      extractActionItems: false,
      detectCodeSnippets: true,
      subtitleLanguages: ['en', 'es', 'fr', 'de', 'pt'],
      notifyOnComplete: true,
      autoShareSettings: {
        enabled: false,
      },
    },
    isSystem: true,
    isActive: true,
  },
  {
    id: 'system-product-demo',
    name: 'Product Demo',
    description: 'Perfect for product demonstrations with key feature highlights and timestamps',
    type: 'product_demo' as const,
    icon: 'Presentation',
    config: {
      autoTranscribe: true,
      generateSummary: true,
      extractChapters: true,
      extractActionItems: false,
      detectCodeSnippets: false,
      subtitleLanguages: ['en'],
      notifyOnComplete: true,
      autoShareSettings: {
        enabled: true,
        accessLevel: 'view' as const,
        expiresInDays: 30,
      },
      customPrompts: {
        summaryPrompt:
          'Create a product demo summary that highlights: 1) Key features demonstrated, 2) Benefits mentioned, 3) Use cases shown, 4) Call to action or next steps',
      },
    },
    isSystem: true,
    isActive: true,
  },
  {
    id: 'system-training',
    name: 'Training Session',
    description: 'Comprehensive training content with quizzes, action items, and multi-language support',
    type: 'training' as const,
    icon: 'BookOpen',
    config: {
      autoTranscribe: true,
      generateSummary: true,
      extractChapters: true,
      extractActionItems: true,
      detectCodeSnippets: true,
      subtitleLanguages: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh', 'ko'],
      notifyOnComplete: true,
      customPrompts: {
        summaryPrompt:
          'Create a training summary that includes: 1) Learning objectives covered, 2) Key concepts explained, 3) Practical exercises or examples, 4) Assessment points',
        actionItemsPrompt: 'Extract homework, practice exercises, and follow-up tasks from this training session.',
      },
    },
    isSystem: true,
    isActive: true,
  },
  {
    id: 'system-onboarding',
    name: 'Team Onboarding',
    description: 'Welcome videos for new team members with clear action items and resources',
    type: 'onboarding' as const,
    icon: 'UserPlus',
    config: {
      autoTranscribe: true,
      generateSummary: true,
      extractChapters: true,
      extractActionItems: true,
      detectCodeSnippets: false,
      subtitleLanguages: ['en'],
      notifyOnComplete: true,
      autoShareSettings: {
        enabled: true,
        accessLevel: 'view' as const,
      },
      customPrompts: {
        actionItemsPrompt:
          'Extract all tasks the new team member needs to complete, including account setups, reading materials, and meetings to schedule.',
      },
    },
    isSystem: true,
    isActive: true,
  },
  {
    id: 'system-marketing',
    name: 'Marketing Content',
    description: 'Promotional videos optimized for sharing and SEO with auto-generated descriptions',
    type: 'marketing' as const,
    icon: 'Megaphone',
    config: {
      autoTranscribe: true,
      generateSummary: true,
      extractChapters: true,
      extractActionItems: false,
      detectCodeSnippets: false,
      subtitleLanguages: ['en', 'es', 'fr', 'de', 'pt'],
      notifyOnComplete: true,
      autoShareSettings: {
        enabled: true,
        accessLevel: 'view' as const,
      },
      customPrompts: {
        summaryPrompt:
          'Create a marketing-friendly summary suitable for social media and SEO. Include: 1) Key message, 2) Target audience appeal, 3) Call to action, 4) Suggested hashtags',
      },
    },
    isSystem: true,
    isActive: true,
  },
];

// =============================================================================
// GET /api/workflow-templates - List available templates
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const type = searchParams.get('type');
    const includeSystem = searchParams.get('system') !== 'false';

    // Build query conditions
    const conditions = [eq(workflowTemplates.isActive, true)];

    if (type) {
      conditions.push(eq(workflowTemplates.type, type as WorkflowTemplateType));
    }

    // Get custom templates for the organization if authenticated
    let customTemplates: (typeof workflowTemplates.$inferSelect)[] = [];
    if (session?.user && organizationId) {
      customTemplates = await db
        .select()
        .from(workflowTemplates)
        .where(
          and(
            eq(workflowTemplates.organizationId, organizationId),
            eq(workflowTemplates.isActive, true),
            eq(workflowTemplates.isSystem, false),
            type ? eq(workflowTemplates.type, type as WorkflowTemplateType) : undefined,
          ),
        )
        .orderBy(desc(workflowTemplates.usageCount));
    }

    // Get system templates from database or use defaults
    let systemTemplates: (typeof workflowTemplates.$inferSelect)[] = [];
    if (includeSystem) {
      systemTemplates = await db
        .select()
        .from(workflowTemplates)
        .where(
          and(
            eq(workflowTemplates.isSystem, true),
            eq(workflowTemplates.isActive, true),
            type ? eq(workflowTemplates.type, type as WorkflowTemplateType) : undefined,
          ),
        )
        .orderBy(desc(workflowTemplates.usageCount));

      // If no system templates in DB, return defaults
      if (systemTemplates.length === 0) {
        const filteredDefaults = type ? SYSTEM_TEMPLATES.filter((t) => t.type === type) : SYSTEM_TEMPLATES;
        return NextResponse.json({
          templates: [...filteredDefaults, ...customTemplates],
          total: filteredDefaults.length + customTemplates.length,
        });
      }
    }

    const allTemplates = [...systemTemplates, ...customTemplates];

    return NextResponse.json({
      templates: allTemplates,
      total: allTemplates.length,
    });
  } catch (error) {
    logger.error('Workflow templates error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// POST /api/workflow-templates - Create a custom template
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const result = safeParse(CreateTemplateSchema, rawBody);
    if (!result.success) {
      return NextResponse.json({ error: 'Name, config, and organizationId are required' }, { status: 400 });
    }
    const { name, description, type, icon, config, organizationId } = result.data;

    const [template] = await db
      .insert(workflowTemplates)
      .values({
        name,
        description,
        type: type || 'custom',
        icon,
        config: { ...config },
        organizationId,
        createdById: session.user.id,
        isSystem: false,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    logger.error('Create template error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
