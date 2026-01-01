import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "./db";
import {
  type AuditLogCategory,
  type AuditLogSeverity,
  auditLogExports,
  auditLogs,
  type NewAuditLog,
} from "./db/schema";
import { env } from "./env/server";

export interface AuditLogContext {
  actorId?: string;
  actorEmail?: string;
  actorType?: "user" | "system" | "api_key" | "sso";
  organizationId?: string;
  requestId?: string;
  sessionId?: string;
}

export interface AuditLogEntry {
  category: AuditLogCategory;
  action: string;
  description?: string;
  severity?: AuditLogSeverity;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  categories?: AuditLogCategory[];
  actions?: string[];
  actorIds?: string[];
  severity?: AuditLogSeverity[];
  resourceType?: string;
  resourceId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogExportOptions {
  format: "csv" | "json";
  filters: AuditLogFilters;
}

/**
 * AuditLogger - Comprehensive audit logging service for enterprise compliance
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern
export class AuditLogger {
  /**
   * Log an audit event
   */
  static async log(entry: AuditLogEntry, context: AuditLogContext = {}): Promise<string> {
    const headerList = await headers();
    const ipAddress = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip");
    const userAgent = headerList.get("user-agent");
    const requestId = headerList.get("x-request-id") || crypto.randomUUID();

    const id = crypto.randomUUID();
    const auditLog: NewAuditLog = {
      id,
      actorId: context.actorId || null,
      actorEmail: context.actorEmail || null,
      actorType: context.actorType || "user",
      organizationId: context.organizationId || null,
      category: entry.category,
      action: entry.action,
      description: entry.description || null,
      severity: entry.severity || "info",
      resourceType: entry.resourceType || null,
      resourceId: entry.resourceId || null,
      resourceName: entry.resourceName || null,
      previousValue: entry.previousValue || null,
      newValue: entry.newValue || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      requestId: context.requestId || requestId,
      sessionId: context.sessionId || null,
      metadata: entry.metadata || null,
    };

    await db.insert(auditLogs).values(auditLog);

    // Log to console in development
    if (env.NODE_ENV === "development") {
      console.log(`[Audit] ${entry.category}.${entry.action}: ${entry.description || "No description"}`);
    }

    return id;
  }

  /**
   * Log authentication events
   */
  static async logAuth(
    action: "login" | "logout" | "login_failed" | "password_reset" | "2fa_enabled" | "2fa_disabled" | "sso_login",
    context: AuditLogContext,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const descriptions: Record<string, string> = {
      login: "User logged in successfully",
      logout: "User logged out",
      login_failed: "Login attempt failed",
      password_reset: "Password was reset",
      "2fa_enabled": "Two-factor authentication enabled",
      "2fa_disabled": "Two-factor authentication disabled",
      sso_login: "User logged in via SSO",
    };

    return AuditLogger.log(
      {
        category: "authentication",
        action: `user.${action}`,
        description: descriptions[action],
        severity: action === "login_failed" ? "warning" : "info",
        metadata,
      },
      context,
    );
  }

  /**
   * Log authorization events
   */
  static async logAuthz(
    action: "permission_granted" | "permission_denied" | "role_assigned" | "role_removed",
    context: AuditLogContext,
    details: {
      resourceType?: string;
      resourceId?: string;
      resourceName?: string;
      permission?: string;
      roleName?: string;
      targetUserId?: string;
    },
  ): Promise<string> {
    const descriptions: Record<string, string> = {
      permission_granted: `Permission granted: ${details.permission}`,
      permission_denied: `Permission denied: ${details.permission}`,
      role_assigned: `Role assigned: ${details.roleName}`,
      role_removed: `Role removed: ${details.roleName}`,
    };

    return AuditLogger.log(
      {
        category: "authorization",
        action: `access.${action}`,
        description: descriptions[action],
        severity: action === "permission_denied" ? "warning" : "info",
        resourceType: details.resourceType,
        resourceId: details.resourceId,
        resourceName: details.resourceName,
        metadata: { ...details },
      },
      context,
    );
  }

  /**
   * Log content management events
   */
  static async logContent(
    action: "created" | "updated" | "deleted" | "shared" | "downloaded",
    resourceType: "video" | "channel" | "collection" | "comment",
    context: AuditLogContext,
    details: {
      resourceId: string;
      resourceName?: string;
      previousValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
    },
  ): Promise<string> {
    return AuditLogger.log(
      {
        category: "content_management",
        action: `${resourceType}.${action}`,
        description: `${resourceType} ${action}: ${details.resourceName || details.resourceId}`,
        resourceType,
        resourceId: details.resourceId,
        resourceName: details.resourceName,
        previousValue: details.previousValue,
        newValue: details.newValue,
      },
      context,
    );
  }

  /**
   * Log organization management events
   */
  static async logOrgManagement(
    action: "member_added" | "member_removed" | "settings_updated" | "sso_configured" | "storage_configured",
    context: AuditLogContext,
    details: {
      targetUserId?: string;
      targetEmail?: string;
      previousValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
    },
  ): Promise<string> {
    const descriptions: Record<string, string> = {
      member_added: `Member added: ${details.targetEmail || details.targetUserId}`,
      member_removed: `Member removed: ${details.targetEmail || details.targetUserId}`,
      settings_updated: "Organization settings updated",
      sso_configured: "SSO configuration updated",
      storage_configured: "Storage configuration updated",
    };

    return AuditLogger.log(
      {
        category: "organization_management",
        action: `org.${action}`,
        description: descriptions[action],
        previousValue: details.previousValue,
        newValue: details.newValue,
        metadata: details,
      },
      context,
    );
  }

  /**
   * Log security events
   */
  static async logSecurity(
    action:
      | "session_revoked"
      | "api_key_created"
      | "api_key_revoked"
      | "suspicious_activity"
      | "rate_limit_exceeded"
      | "permission_escalation",
    context: AuditLogContext,
    details?: Record<string, unknown>,
  ): Promise<string> {
    const severityMap: Record<string, AuditLogSeverity> = {
      session_revoked: "warning",
      api_key_created: "info",
      api_key_revoked: "info",
      suspicious_activity: "error",
      rate_limit_exceeded: "warning",
      permission_escalation: "critical",
    };

    return AuditLogger.log(
      {
        category: "security",
        action: `security.${action}`,
        description: action.replace(/_/g, " "),
        severity: severityMap[action] || "info",
        metadata: details,
      },
      context,
    );
  }

  /**
   * Query audit logs with filters
   */
  static async query(organizationId: string, filters: AuditLogFilters = {}) {
    const conditions = [eq(auditLogs.organizationId, organizationId)];

    if (filters.startDate) {
      conditions.push(gte(auditLogs.createdAt, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(auditLogs.createdAt, filters.endDate));
    }

    if (filters.categories && filters.categories.length > 0) {
      conditions.push(inArray(auditLogs.category, filters.categories));
    }

    if (filters.actions && filters.actions.length > 0) {
      conditions.push(inArray(auditLogs.action, filters.actions));
    }

    if (filters.actorIds && filters.actorIds.length > 0) {
      conditions.push(inArray(auditLogs.actorId, filters.actorIds));
    }

    if (filters.severity && filters.severity.length > 0) {
      conditions.push(inArray(auditLogs.severity, filters.severity));
    }

    if (filters.resourceType) {
      conditions.push(eq(auditLogs.resourceType, filters.resourceType));
    }

    if (filters.resourceId) {
      conditions.push(eq(auditLogs.resourceId, filters.resourceId));
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(...conditions));

    return {
      logs,
      total: countResult[0]?.count || 0,
      limit,
      offset,
    };
  }

  /**
   * Export audit logs to CSV or JSON
   */
  static async requestExport(
    organizationId: string,
    requestedBy: string,
    options: AuditLogExportOptions,
  ): Promise<string> {
    const exportId = crypto.randomUUID();

    await db.insert(auditLogExports).values({
      id: exportId,
      organizationId,
      requestedBy,
      format: options.format,
      status: "pending",
      filters: {
        startDate: options.filters.startDate?.toISOString(),
        endDate: options.filters.endDate?.toISOString(),
        categories: options.filters.categories,
        actions: options.filters.actions,
        actorIds: options.filters.actorIds,
        severity: options.filters.severity,
      },
    });

    // In a real implementation, this would trigger a background job
    // For now, we'll process it synchronously for smaller datasets
    void AuditLogger.processExport(exportId);

    return exportId;
  }

  /**
   * Process an export request (should be called by a background job)
   */
  static async processExport(exportId: string): Promise<void> {
    const exportRequest = await db.query.auditLogExports.findFirst({
      where: eq(auditLogExports.id, exportId),
    });

    if (!exportRequest) {
      throw new Error(`Export request not found: ${exportId}`);
    }

    try {
      // Update status to processing
      await db.update(auditLogExports).set({ status: "processing" }).where(eq(auditLogExports.id, exportId));

      // Build filters from stored filter data
      const filters: AuditLogFilters = {};
      const storedFilters = exportRequest.filters as {
        startDate?: string;
        endDate?: string;
        categories?: AuditLogCategory[];
        actions?: string[];
        actorIds?: string[];
        severity?: AuditLogSeverity[];
      } | null;

      if (storedFilters) {
        if (storedFilters.startDate) filters.startDate = new Date(storedFilters.startDate);
        if (storedFilters.endDate) filters.endDate = new Date(storedFilters.endDate);
        if (storedFilters.categories) filters.categories = storedFilters.categories;
        if (storedFilters.actions) filters.actions = storedFilters.actions;
        if (storedFilters.actorIds) filters.actorIds = storedFilters.actorIds;
        if (storedFilters.severity) filters.severity = storedFilters.severity;
      }

      // Query all matching logs (paginated for large datasets)
      const allLogs: (typeof auditLogs.$inferSelect)[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        const result = await AuditLogger.query(exportRequest.organizationId, {
          ...filters,
          limit: batchSize,
          offset,
        });

        allLogs.push(...result.logs);

        if (result.logs.length < batchSize) break;
        offset += batchSize;
      }

      // Generate export content
      let content: string;
      if (exportRequest.format === "json") {
        content = JSON.stringify(allLogs, null, 2);
      } else {
        // CSV format
        const csvHeaders = [
          "id",
          "timestamp",
          "category",
          "action",
          "description",
          "severity",
          "actor_id",
          "actor_email",
          "actor_type",
          "resource_type",
          "resource_id",
          "resource_name",
          "ip_address",
          "user_agent",
        ];
        const csvRows = allLogs.map((log) =>
          [
            log.id,
            log.createdAt.toISOString(),
            log.category,
            log.action,
            log.description || "",
            log.severity,
            log.actorId || "",
            log.actorEmail || "",
            log.actorType,
            log.resourceType || "",
            log.resourceId || "",
            log.resourceName || "",
            log.ipAddress || "",
            log.userAgent || "",
          ]
            .map((val) => `"${String(val).replace(/"/g, '""')}"`)
            .join(","),
        );
        content = [csvHeaders.join(","), ...csvRows].join("\n");
      }

      // In a real implementation, upload to storage and generate a signed URL
      // For now, we'll store a placeholder
      const downloadUrl = `data:${exportRequest.format === "json" ? "application/json" : "text/csv"};base64,${Buffer.from(content).toString("base64")}`;

      // Update export record
      await db
        .update(auditLogExports)
        .set({
          status: "completed",
          downloadUrl,
          recordCount: allLogs.length,
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        })
        .where(eq(auditLogExports.id, exportId));
    } catch (error) {
      // Update with error status
      await db
        .update(auditLogExports)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
        })
        .where(eq(auditLogExports.id, exportId));
    }
  }

  /**
   * Get export status
   */
  static async getExportStatus(exportId: string) {
    return db.query.auditLogExports.findFirst({
      where: eq(auditLogExports.id, exportId),
    });
  }

  /**
   * Get audit log statistics for an organization
   */
  static async getStats(organizationId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await db
      .select({
        category: auditLogs.category,
        severity: auditLogs.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, organizationId), gte(auditLogs.createdAt, startDate)))
      .groupBy(auditLogs.category, auditLogs.severity);

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const row of stats) {
      byCategory[row.category] = (byCategory[row.category] || 0) + row.count;
      bySeverity[row.severity] = (bySeverity[row.severity] || 0) + row.count;
    }

    return {
      byCategory,
      bySeverity,
      total: Object.values(byCategory).reduce((sum, count) => sum + count, 0),
      periodDays: days,
    };
  }
}

export default AuditLogger;
