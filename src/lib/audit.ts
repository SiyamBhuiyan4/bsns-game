import prisma from './prisma';
import { AuditAction, Prisma } from '@prisma/client';

export interface CreateAuditLogParams {
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  payload?: Prisma.InputJsonValue | Record<string, unknown> | null;
  tx?: any;
}

export async function createAuditLog(params: CreateAuditLogParams) {
  try {
    const db = params.tx || prisma;
    return await db.auditLog.create({
      data: {
        actor_id: params.actorId || null,
        action: params.action,
        entity: params.entity,
        entity_id: params.entityId || null,
        payload: (params.payload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw to avoid failing main transaction unless necessary
    return null;
  }
}

export const writeAuditLog = createAuditLog;
