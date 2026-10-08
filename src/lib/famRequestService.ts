/**
 * Service layer for persisting pending requests to Supabase fam_requests table.
 */

import { createClient } from '@/lib/supabase/client';
import type { PendingRequest } from '@/lib/familyData';

function toRow(req: PendingRequest): Record<string, unknown> {
  return {
    req_id: req.reqId,
    type: req.type,
    data: req.data ? JSON.parse(JSON.stringify(req.data)) : null,
    target_id: req.targetId ?? null,
    by_user: req.by,
    created_at: req.createdAt,
    status: 'pending',
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: Record<string, unknown>): PendingRequest {
  return {
    reqId: row.req_id as string,
    type: row.type as 'add' | 'edit' | 'delete',
    data: row.data as PendingRequest['data'],
    targetId: (row.target_id as string) ?? undefined,
    by: row.by_user as string,
    createdAt: row.created_at as string,
  };
}

/** Fetch all pending requests from Supabase. */
export async function fetchPendingRequests(): Promise<PendingRequest[]> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('fam_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[famRequestService] fetchPendingRequests error:', error.message, error.code);
      return [];
    }
    return (data as Record<string, unknown>[]).map(fromRow);
  } catch (err) {
    console.error('[famRequestService] fetchPendingRequests exception:', err);
    return [];
  }
}

/** Insert a new pending request into Supabase. */
export async function insertRequest(req: PendingRequest): Promise<boolean> {
  const supabase = createClient();
  try {
    const row = toRow(req);
    console.log('[famRequestService] insertRequest row:', row);
    const { error } = await supabase
      .from('fam_requests')
      .upsert(row, { onConflict: 'req_id' });

    if (error) {
      console.error('[famRequestService] insertRequest error:', error.message, error.code, error.details);
      return false;
    }
    console.log('[famRequestService] insertRequest success:', req.reqId);
    return true;
  } catch (err) {
    console.error('[famRequestService] insertRequest exception:', err);
    return false;
  }
}

/** Mark a request as approved or rejected (updates status). */
export async function updateRequestStatus(
  reqId: string,
  status: 'approved' | 'rejected'
): Promise<boolean> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('fam_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('req_id', reqId);

    if (error) {
      console.error('[famRequestService] updateRequestStatus error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[famRequestService] updateRequestStatus exception:', err);
    return false;
  }
}
