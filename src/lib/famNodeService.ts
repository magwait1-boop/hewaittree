/**
 * Service layer for persisting family tree nodes to Supabase.
 * Handles snake_case (DB) ↔ camelCase (app) conversion.
 */

import { createClient } from '@/lib/supabase/client';
import type { Person } from '@/lib/familyData';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert empty string to null; otherwise return the value as-is. */
function emptyToNull(val: string | undefined | null): string | null {
  if (val === undefined || val === null || val.trim() === '') return null;
  return val;
}

/** Parse a float, returning null if the result is NaN or the input is empty. */
function parseFloatOrNull(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

/** Parse a float, returning 0 if the result is NaN or the input is empty. */
function parseFloatOrZero(val: unknown): number {
  if (val === undefined || val === null || val === '') return 0;
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

// ── Converters ────────────────────────────────────────────────────────────────

function toRow(p: Person): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    // NOT NULL columns — use empty string fallback instead of null
    gender: p.gender ?? '',
    mother_name: emptyToNull(p.motherName),
    father_id: p.fatherId || '',
    father_name: emptyToNull(p.fatherName),
    branch: p.branch ?? '',
    // Date columns must be null, not empty string, to avoid Postgres type errors
    birth_date: emptyToNull(p.birthDate),
    death_date: emptyToNull(p.deathDate),
    leaf_color: emptyToNull(p.leafColor),
    edge_color: emptyToNull(p.edgeColor),
    edge_width: parseFloatOrNull(p.edgeWidth),
    // Numeric fields — ensure proper float/number types
    node_scale: parseFloatOrNull(p.nodeScale),
    manual_x: parseFloatOrZero(p.manualX),
    manual_y: parseFloatOrZero(p.manualY),
    notes: emptyToNull(p.notes),
    card_bg_color: emptyToNull(p.cardBgColor),
    card_text_color: emptyToNull(p.cardTextColor),
    card_width: parseFloatOrNull(p.cardWidth),
    card_height: parseFloatOrNull(p.cardHeight),
    card_font_size: parseFloatOrNull(p.cardFontSize),
    card_border_color: emptyToNull(p.cardBorderColor),
    card_border_width: parseFloatOrNull(p.cardBorderWidth),
    card_border_radius: parseFloatOrNull(p.cardBorderRadius),
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: Record<string, unknown>): Person {
  return {
    id: row.id as string,
    name: row.name as string,
    gender: (row.gender as Person['gender']) || '',
    motherName: (row.mother_name as string) ?? undefined,
    fatherId: (row.father_id as string) ?? '',
    fatherName: (row.father_name as string) ?? undefined,
    branch: (row.branch as string) ?? '',
    birthDate: (row.birth_date as string) ?? undefined,
    deathDate: (row.death_date as string) ?? undefined,
    leafColor: (row.leaf_color as string) ?? undefined,
    edgeColor: (row.edge_color as string) ?? undefined,
    edgeWidth: row.edge_width != null ? Number(row.edge_width) : undefined,
    nodeScale: row.node_scale != null ? Number(row.node_scale) : undefined,
    manualX: parseFloatOrZero(row.manual_x),
    manualY: parseFloatOrZero(row.manual_y),
    notes: (row.notes as string) ?? undefined,
    cardBgColor: (row.card_bg_color as string) ?? undefined,
    cardTextColor: (row.card_text_color as string) ?? undefined,
    cardWidth: row.card_width != null ? Number(row.card_width) : undefined,
    cardHeight: row.card_height != null ? Number(row.card_height) : undefined,
    cardFontSize: row.card_font_size != null ? Number(row.card_font_size) : undefined,
    cardBorderColor: (row.card_border_color as string) ?? undefined,
    cardBorderWidth: row.card_border_width != null ? Number(row.card_border_width) : undefined,
    cardBorderRadius: row.card_border_radius != null ? Number(row.card_border_radius) : undefined,
  };
}

/** Public export of fromRow for use in Realtime subscription handlers. */
export { fromRow as fromRowPublic };

// ── API ───────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000; // Supabase/PostgREST default max per request
const UPSERT_BATCH = 200; // Safe batch size for upsert/insert payloads

// ── Settings Service ──────────────────────────────────────────────────────────

const SETTINGS_KEY = 'fam_tree_settings';

/**
 * Fetch app settings from Supabase. Returns null on error or if not found.
 */
export async function fetchSettings(): Promise<Record<string, unknown> | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      console.error('[famNodeService] fetchSettings error:', error.message);
      return null;
    }
    if (!data) return null;
    return data.value as Record<string, unknown>;
  } catch (err: unknown) {
    console.error('[famNodeService] fetchSettings exception:', err);
    return null;
  }
}

/**
 * Save app settings to Supabase (upsert by key).
 */
export async function saveSettings(settings: Record<string, unknown>): Promise<boolean> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: SETTINGS_KEY, value: settings, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('[famNodeService] saveSettings error:', error.message);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.error('[famNodeService] saveSettings exception:', err);
    return false;
  }
}

/**
 * Fetch ALL persons from Supabase using paginated range queries.
 * Bypasses the default 1,000-row PostgREST limit by looping with .range(start, end).
 * Returns null on error.
 */
export async function fetchAllPersons(): Promise<Person[] | null> {
  const supabase = createClient();
  const allRows: Record<string, unknown>[] = [];
  let start = 0;

  try {
    while (true) {
      const end = start + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('fam_nodes')
        .select('*')
        .order('manual_y', { ascending: true })
        .range(start, end);

      if (error) {
        console.error('[famNodeService] fetchAllPersons error:', error.message);
        return null;
      }

      if (!data || data.length === 0) break;

      allRows.push(...(data as Record<string, unknown>[]));

      // If we received fewer rows than PAGE_SIZE, we've reached the end
      if (data.length < PAGE_SIZE) break;

      start += PAGE_SIZE;
    }

    console.log(`[famNodeService] fetchAllPersons: loaded ${allRows.length} rows total`);
    return allRows.map(fromRow);
  } catch (err: unknown) {
    console.error('[famNodeService] fetchAllPersons exception:', err);
    return null;
  }
}

/** Upsert a single person (insert or update by id). */
export async function upsertPerson(person: Person): Promise<boolean> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('fam_nodes')
      .upsert(toRow(person), { onConflict: 'id' });

    if (error) {
      console.error('[famNodeService] upsertPerson error:', error.message);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.error('[famNodeService] upsertPerson exception:', err);
    return false;
  }
}

/** Delete a person by id. */
export async function deletePerson(id: string): Promise<boolean> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('fam_nodes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[famNodeService] deletePerson error:', error.message);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.error('[famNodeService] deletePerson exception:', err);
    return false;
  }
}

/**
 * Replace ALL persons in the database (used after CSV import).
 * Deletes all existing rows, then inserts in batches of UPSERT_BATCH.
 * Calls onProgress(inserted, total) after each batch.
 */
export async function replaceAllPersons(
  persons: Person[],
  onProgress?: (inserted: number, total: number) => void
): Promise<boolean> {
  const supabase = createClient();
  try {
    // Delete all existing rows first
    const { error: delError } = await supabase
      .from('fam_nodes')
      .delete()
      .neq('id', '__never_matches__');

    if (delError) {
      console.error('[famNodeService] replaceAllPersons delete error:', delError.message);
      return false;
    }

    if (persons.length === 0) return true;

    // Insert in batches to avoid payload timeouts
    const total = persons.length;
    let inserted = 0;
    const totalBatches = Math.ceil(total / UPSERT_BATCH);

    for (let i = 0; i < total; i += UPSERT_BATCH) {
      const batch = persons.slice(i, i + UPSERT_BATCH).map(toRow);
      const batchNum = Math.floor(i / UPSERT_BATCH) + 1;
      console.log(`[famNodeService] replaceAllPersons: inserting batch ${batchNum}/${totalBatches} (rows ${i + 1}–${Math.min(i + UPSERT_BATCH, total)})`);

      const { error: insError } = await supabase
        .from('fam_nodes')
        .insert(batch);

      if (insError) {
        console.error('[famNodeService] replaceAllPersons insert error:', insError.message);
        return false;
      }

      inserted += batch.length;
      onProgress?.(inserted, total);
    }

    console.log(`[famNodeService] replaceAllPersons: completed — ${inserted} rows inserted`);
    return true;
  } catch (err: unknown) {
    console.error('[famNodeService] replaceAllPersons exception:', err);
    return false;
  }
}

/**
 * Merge persons into the database (upsert all) in batches of UPSERT_BATCH.
 * Calls onProgress(upserted, total) after each batch.
 */
export async function mergePersons(
  persons: Person[],
  onProgress?: (upserted: number, total: number) => void
): Promise<boolean> {
  const supabase = createClient();
  try {
    const total = persons.length;
    let upserted = 0;
    const totalBatches = Math.ceil(total / UPSERT_BATCH);

    for (let i = 0; i < total; i += UPSERT_BATCH) {
      const batch = persons.slice(i, i + UPSERT_BATCH).map(toRow);
      const batchNum = Math.floor(i / UPSERT_BATCH) + 1;
      console.log(`[famNodeService] mergePersons: upserting batch ${batchNum}/${totalBatches} (rows ${i + 1}–${Math.min(i + UPSERT_BATCH, total)})`);

      const { error } = await supabase
        .from('fam_nodes')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error('[famNodeService] mergePersons error:', error.message);
        return false;
      }

      upserted += batch.length;
      onProgress?.(upserted, total);
    }

    console.log(`[famNodeService] mergePersons: completed — ${upserted} rows upserted`);
    return true;
  } catch (err: unknown) {
    console.error('[famNodeService] mergePersons exception:', err);
    return false;
  }
}

/** Update only the position (manualX, manualY) of a person. */
export async function updatePersonPosition(id: string, manualX: number, manualY: number): Promise<void> {
  const supabase = createClient();
  try {
    await supabase
      .from('fam_nodes')
      .update({ manual_x: manualX, manual_y: manualY, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err: unknown) {
    console.error('[famNodeService] updatePersonPosition exception:', err);
  }
}
