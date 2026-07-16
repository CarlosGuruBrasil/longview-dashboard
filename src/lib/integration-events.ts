import { ensureSchema, sql } from '@/lib/pg';
import logger from '@/lib/logger';

export type IntegrationEventStatus =
  | 'received'
  | 'processed'
  | 'sent'
  | 'warning'
  | 'error'
  | 'skipped';

type IntegrationEventInput = {
  systemSource: string;
  systemTarget?: string;
  entityType?: string;
  entityId?: string | number | null;
  externalId?: string | number | null;
  status: IntegrationEventStatus;
  summary: string;
  detail?: string | null;
  payload?: unknown;
};

export async function recordIntegrationEvent(input: IntegrationEventInput): Promise<void> {
  try {
    await ensureSchema();
    await sql`
      INSERT INTO integration_events (
        system_source,
        system_target,
        entity_type,
        entity_id,
        external_id,
        status,
        summary,
        detail,
        payload
      ) VALUES (
        ${input.systemSource},
        ${input.systemTarget ?? ''},
        ${input.entityType ?? 'lead'},
        ${input.entityId == null ? '' : String(input.entityId)},
        ${input.externalId == null ? '' : String(input.externalId)},
        ${input.status},
        ${input.summary},
        ${input.detail ?? ''},
        ${(input.payload ?? {}) as never}
      )
    `;
  } catch (error) {
    logger.warn({ error, input }, '[integration-events] failed to persist event');
  }
}
