// Backend integration point: replace fetchFamilyData with a call to your actual API or GitHub Pages JSON

export interface Person {
  id: string;
  name: string;
  gender: 'ذكر' | 'أنثى' | '';
  motherName?: string;
  fatherId: string;
  fatherName?: string;
  branch: string;
  birthDate?: string;
  deathDate?: string;
  leafColor?: string;
  edgeColor?: string;
  nodeScale?: number;
  manualX: number;
  manualY: number;
  notes?: string;
  // Per-person cell customization (persisted with the person record)
  cardBgColor?: string;
  cardTextColor?: string;
  cardWidth?: number;
  cardHeight?: number;
  cardFontSize?: number;
  cardBorderColor?: string;
  cardBorderWidth?: number;
  cardBorderRadius?: number;
}

export interface PendingRequest {
  reqId: string;
  type: 'add' | 'edit' | 'delete';
  data?: Person;
  targetId?: string;
  by: string;
  createdAt: string;
}

export interface AppSettings {
  lineStyle: 'curve' | 'straight' | 'step';
  bgStyle: 'bg-default' | 'bg-grid' | 'bg-dots';
  maleShape: 'rect' | 'pill' | 'ellipse';
  femaleShape: 'ellipse' | 'pill' | 'rect';
  baseFontSize: number;
  generationOverrides: Record<number, { color: string; scale: number; fontSize: number }>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  lineStyle: 'curve',
  bgStyle: 'bg-default',
  maleShape: 'rect',
  femaleShape: 'ellipse',
  baseFontSize: 14,
  generationOverrides: {},
};

/**
 * Normalize settings loaded from JSON/JSONB storage.
 * JSON serialization converts numeric object keys to strings (e.g. {1: ...} → {"1": ...}).
 * This helper converts generationOverrides keys back to numbers so that
 * lookups like `generationOverrides[1]` work correctly after a round-trip
 * through Supabase JSONB or JSON.parse.
 */
export function normalizeSettings(raw: Record<string, unknown>): AppSettings {
  const base = { ...DEFAULT_SETTINGS, ...raw } as AppSettings;
  if (raw.generationOverrides && typeof raw.generationOverrides === 'object') {
    const normalized: Record<number, { color: string; scale: number; fontSize: number }> = {};
    for (const [k, v] of Object.entries(raw.generationOverrides as Record<string, unknown>)) {
      const numKey = parseInt(k, 10);
      if (!isNaN(numKey) && v && typeof v === 'object') {
        normalized[numKey] = v as { color: string; scale: number; fontSize: number };
      }
    }
    base.generationOverrides = normalized;
  }
  return base;
}

// Mock data — 40 realistic members representing the structure
// Backend integration: replace with fetch('family_tree.json') call
export const MOCK_PERSONS: Person[] = [
  { id: 'p_1787035980456_950787', name: 'حويت', gender: 'ذكر', fatherId: '', branch: 'الأصل', birthDate: '1885-08-03', leafColor: '#e1d019', edgeColor: '', nodeScale: 3, manualX: 3395.75, manualY: -2593.02 },
  { id: 'p_root_son1', name: 'أحمد حويت', gender: 'ذكر', fatherId: 'p_1787035980456_950787', branch: 'احمد1', leafColor: '#add7a0', edgeColor: '#ddb892', nodeScale: 1.4, manualX: 2200, manualY: -2200 },
  { id: 'p_root_son2', name: 'موسى حويت', gender: 'ذكر', fatherId: 'p_1787035980456_950787', branch: 'موسى1', leafColor: '#add7a0', edgeColor: '#ddb892', nodeScale: 1.4, manualX: 3400, manualY: -2200 },
  { id: 'p_root_son3', name: 'حسين حويت', gender: 'ذكر', fatherId: 'p_1787035980456_950787', branch: 'حسين1', leafColor: '#add7a0', edgeColor: '#ddb892', nodeScale: 1.4, manualX: 4600, manualY: -2200 },
  { id: 'p_a1_001', name: 'محمد أحمد', gender: 'ذكر', fatherId: 'p_root_son1', branch: 'احمد1', leafColor: '#add7a0', edgeColor: '#ddb892', nodeScale: 1.2, manualX: 1800, manualY: -1800 },
  { id: 'p_a1_002', name: 'علي أحمد', gender: 'ذكر', fatherId: 'p_root_son1', branch: 'احمد1', leafColor: '#add7a0', edgeColor: '#ddb892', nodeScale: 1.2, manualX: 2200, manualY: -1800 },
  { id: 'p_a1_003', name: 'إبراهيم أحمد', gender: 'ذكر', fatherId: 'p_root_son1', branch: 'احمد1', leafColor: '#add7a0', edgeColor: '#ddb892', nodeScale: 1.2, manualX: 2600, manualY: -1800 },
  { id: 'p_m1_001', name: 'عمر موسى', gender: 'ذكر', fatherId: 'p_root_son2', branch: 'موسى1', leafColor: '#add7a0', edgeColor: '#db0677', nodeScale: 1.2, manualX: 3000, manualY: -1800 },
  { id: 'p_m1_002', name: 'يوسف موسى', gender: 'ذكر', fatherId: 'p_root_son2', branch: 'موسى1', leafColor: '#add7a0', edgeColor: '#db0677', nodeScale: 1.2, manualX: 3400, manualY: -1800 },
  { id: 'p_m1_003', name: 'إسماعيل موسى', gender: 'ذكر', fatherId: 'p_root_son2', branch: 'موسى1', leafColor: '#add7a0', edgeColor: '#db0677', nodeScale: 1.2, manualX: 3800, manualY: -1800 },
  { id: 'p_h1_001', name: 'خالد حسين', gender: 'ذكر', fatherId: 'p_root_son3', branch: 'حسين1', leafColor: '#add7a0', edgeColor: '#dc2626', nodeScale: 1.2, manualX: 4200, manualY: -1800 },
  { id: 'p_h1_002', name: 'طارق حسين', gender: 'ذكر', fatherId: 'p_root_son3', branch: 'حسين1', leafColor: '#add7a0', edgeColor: '#dc2626', nodeScale: 1.2, manualX: 4600, manualY: -1800 },
  { id: 'p_h1_003', name: 'وليد حسين', gender: 'ذكر', fatherId: 'p_root_son3', branch: 'حسين1', leafColor: '#add7a0', edgeColor: '#dc2626', nodeScale: 1.2, manualX: 5000, manualY: -1800 },
  { id: 'p_a1_001_s1', name: 'حسن محمد', gender: 'ذكر', fatherId: 'p_a1_001', branch: 'احمد1', leafColor: '#add7a0', edgeColor: '#ddb892', nodeScale: 1, manualX: 1600, manualY: -1400 },
  { id: 'p_a1_001_s2', name: 'سمير محمد', gender: 'ذكر', fatherId: 'p_a1_001', branch: 'احمد1', leafColor: '#add7a0', edgeColor: '#ddb892', nodeScale: 1, manualX: 1900, manualY: -1400 },
  { id: 'p_a1_001_d1', name: 'فاطمة محمد', gender: 'أنثى', fatherId: 'p_a1_001', branch: 'احمد1', leafColor: '#fcd9d9', edgeColor: '#ddb892', nodeScale: 1, manualX: 2200, manualY: -1400 },
  { id: 'p_a1_002_s1', name: 'كريم علي', gender: 'ذكر', fatherId: 'p_a1_002', branch: 'احمد1', leafColor: '#add7a0', edgeColor: '#ddb892', nodeScale: 1, manualX: 2500, manualY: -1400 },
  { id: 'p_a1_003_s1', name: 'نور إبراهيم', gender: 'أنثى', fatherId: 'p_a1_003', branch: 'احمد1', leafColor: '#fcd9d9', edgeColor: '#ddb892', nodeScale: 1, manualX: 2800, manualY: -1400 },
  { id: 'p_m1_001_s1', name: 'رامي عمر', gender: 'ذكر', fatherId: 'p_m1_001', branch: 'موسى1', leafColor: '#add7a0', edgeColor: '#db0677', nodeScale: 1, manualX: 2900, manualY: -1400 },
  { id: 'p_m1_001_s2', name: 'أميرة عمر', gender: 'أنثى', fatherId: 'p_m1_001', branch: 'موسى1', leafColor: '#fcd9d9', edgeColor: '#db0677', nodeScale: 1, manualX: 3200, manualY: -1400 },
  { id: 'p_m1_002_s1', name: 'ماجد يوسف', gender: 'ذكر', fatherId: 'p_m1_002', branch: 'موسى1', leafColor: '#add7a0', edgeColor: '#db0677', nodeScale: 1, manualX: 3500, manualY: -1400 },
  { id: 'p_h1_001_s1', name: 'عادل خالد', gender: 'ذكر', fatherId: 'p_h1_001', branch: 'حسين1', leafColor: '#add7a0', edgeColor: '#dc2626', nodeScale: 1, manualX: 4100, manualY: -1400 },
  { id: 'p_h1_002_s1', name: 'منى طارق', gender: 'أنثى', fatherId: 'p_h1_002', branch: 'حسين1', leafColor: '#fcd9d9', edgeColor: '#dc2626', nodeScale: 1, manualX: 4500, manualY: -1400 },
  { id: 'p_h1_002_s2', name: 'زياد طارق', gender: 'ذكر', fatherId: 'p_h1_002', branch: 'حسين1', leafColor: '#add7a0', edgeColor: '#dc2626', nodeScale: 1, manualX: 4800, manualY: -1400 },
  { id: 'p_gen5_001', name: 'لؤي حسن', gender: 'ذكر', fatherId: 'p_a1_001_s1', branch: 'احمد1', leafColor: '#fdffb6', edgeColor: '#70db06', nodeScale: 1, manualX: 1500, manualY: -1000 },
  { id: 'p_gen5_002', name: 'دانا سمير', gender: 'أنثى', fatherId: 'p_a1_001_s2', branch: 'احمد1', leafColor: '#fcd9d9', edgeColor: '#70db06', nodeScale: 1, manualX: 1800, manualY: -1000 },
  { id: 'p_gen5_003', name: 'يزن كريم', gender: 'ذكر', fatherId: 'p_a1_002_s1', branch: 'احمد1', leafColor: '#fdffb6', edgeColor: '#70db06', nodeScale: 1, manualX: 2400, manualY: -1000 },
  { id: 'p_gen5_004', name: 'سلمى رامي', gender: 'أنثى', fatherId: 'p_m1_001_s1', branch: 'موسى1', leafColor: '#fcd9d9', edgeColor: '#1edb06', nodeScale: 1, manualX: 2900, manualY: -1000 },
  { id: 'p_gen5_005', name: 'أنس ماجد', gender: 'ذكر', fatherId: 'p_m1_002_s1', branch: 'موسى1', leafColor: '#add7a0', edgeColor: '#1edb06', nodeScale: 1, manualX: 3400, manualY: -1000 },
  { id: 'p_gen5_006', name: 'تالا عادل', gender: 'أنثى', fatherId: 'p_h1_001_s1', branch: 'حسين1', leafColor: '#fcd9d9', edgeColor: '#dc2626', nodeScale: 1, manualX: 4000, manualY: -1000 },
  { id: 'p_gen5_007', name: 'فارس زياد', gender: 'ذكر', fatherId: 'p_h1_002_s2', branch: 'حسين1', leafColor: '#add7a0', edgeColor: '#dc2626', nodeScale: 1, manualX: 4700, manualY: -1000 },
  { id: 'p_gen6_001', name: 'ريم لؤي', gender: 'أنثى', fatherId: 'p_gen5_001', branch: 'احمد1', leafColor: '#fcd9d9', edgeColor: '#a2db06', nodeScale: 0.9, manualX: 1400, manualY: -600 },
  { id: 'p_gen6_002', name: 'جود يزن', gender: 'أنثى', fatherId: 'p_gen5_003', branch: 'احمد1', leafColor: '#fcd9d9', edgeColor: '#a2db06', nodeScale: 0.9, manualX: 2300, manualY: -600 },
  { id: 'p_gen6_003', name: 'زيد أنس', gender: 'ذكر', fatherId: 'p_gen5_005', branch: 'موسى1', leafColor: '#add7a0', edgeColor: '#1edb06', nodeScale: 0.9, manualX: 3300, manualY: -600 },
  { id: 'p_gen6_004', name: 'لانا فارس', gender: 'أنثى', fatherId: 'p_gen5_007', branch: 'حسين1', leafColor: '#fcd9d9', edgeColor: '#677a89', nodeScale: 0.9, manualX: 4600, manualY: -600 },
  { id: 'p_branch_abdnaser', name: 'عبدالناصر حويت', gender: 'ذكر', fatherId: 'p_1787035980456_950787', branch: 'عبدالناصر', leafColor: '#bdb2ff', edgeColor: '#3e06db', nodeScale: 1.3, manualX: 1400, manualY: -2200 },
  { id: 'p_abdnaser_s1', name: 'مجدي عبدالناصر', gender: 'ذكر', fatherId: 'p_branch_abdnaser', branch: 'مجدي', leafColor: '#add7a0', edgeColor: '#3e06db', nodeScale: 1, manualX: 1200, manualY: -1800 },
  { id: 'p_abdnaser_s2', name: 'شعبان عبدالناصر', gender: 'ذكر', fatherId: 'p_branch_abdnaser', branch: 'شعبان', leafColor: '#add7a0', edgeColor: '#3e06db', nodeScale: 1, manualX: 1600, manualY: -1800 },
  { id: 'p_makena_001', name: 'المكنة حويت', gender: 'ذكر', fatherId: 'p_1787035980456_950787', branch: 'المكنة', leafColor: '#add7a0', edgeColor: '#cb8e48', nodeScale: 1.2, manualX: 5200, manualY: -2200 },
  { id: 'p_makena_s1', name: 'رضا المكنة', gender: 'ذكر', fatherId: 'p_makena_001', branch: 'المكنة', leafColor: '#add7a0', edgeColor: '#cb8e48', nodeScale: 1, manualX: 5100, manualY: -1800 },
  { id: 'p_makena_s2', name: 'وفاء المكنة', gender: 'أنثى', fatherId: 'p_makena_001', branch: 'المكنة', leafColor: '#fcd9d9', edgeColor: '#cb8e48', nodeScale: 1, manualX: 5400, manualY: -1800 },
];

export const BRANCH_COLORS: Record<string, string> = {
  'احمد1': '#10b981',
  'موسى1': '#db0677',
  'حسين1': '#dc2626',
  'الأصل': '#e1d019',
  'احمد': '#059669',
  'عبدالناصر': '#8b5cf6',
  'المكنة': '#f59e0b',
  'مجدي': '#6366f1',
  'شعبان': '#ec4899',
  'فرع موسى': '#06b6d4',
  'حسين': '#ef4444',
  'موسى': '#14b8a6',
};

export function buildChildrenMap(persons: Person[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const p of persons) {
    if (p.fatherId) {
      if (!map.has(p.fatherId)) map.set(p.fatherId, []);
      map.get(p.fatherId)!.push(p.id);
    }
  }
  return map;
}

export function buildPersonMap(persons: Person[]): Map<string, Person> {
  const map = new Map<string, Person>();
  for (const p of persons) map.set(p.id, p);
  return map;
}

export function buildNameIndex(persons: Person[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const p of persons) {
    const parts = p.name.split(' ');
    for (const part of parts) {
      const key = part.trim();
      if (!key) continue;
      if (!index.has(key)) index.set(key, []);
      index.get(key)!.push(p.id);
    }
    // full name key
    if (!index.has(p.name)) index.set(p.name, []);
    if (!index.get(p.name)!.includes(p.id)) index.get(p.name)!.push(p.id);
  }
  return index;
}

export function getGeneration(id: string, personMap: Map<string, Person>): number {
  let depth = 1;
  let curr = personMap.get(id);
  while (curr && curr.fatherId) {
    depth++;
    curr = personMap.get(curr.fatherId);
    if (depth > 50) break; // safety
  }
  return depth;
}

export function getLineage(id: string, personMap: Map<string, Person>): string {
  const names: string[] = [];
  let curr = personMap.get(id);
  let safety = 0;
  while (curr && safety < 50) {
    names.push(curr.name);
    curr = curr.fatherId ? personMap.get(curr.fatherId) : undefined;
    safety++;
  }
  return names.reverse().join(' ← ');
}

export function getTotalDescendants(
  id: string,
  childrenMap: Map<string, string[]>,
  memo: Map<string, number> = new Map()
): number {
  if (memo.has(id)) return memo.get(id)!;
  const children = childrenMap.get(id) || [];
  let count = children.length;
  for (const cid of children) {
    count += getTotalDescendants(cid, childrenMap, memo);
  }
  memo.set(id, count);
  return count;
}

export function searchPersons(
  query: string,
  persons: Person[],
  nameIndex: Map<string, string[]>
): string[] {
  if (!query.trim()) return [];
  const q = query.trim();
  // Try exact full name first
  const exactIds = nameIndex.get(q) || [];
  if (exactIds.length > 0) return exactIds;
  // Partial match via index
  const resultSet = new Set<string>();
  for (const [key, ids] of nameIndex.entries()) {
    if (key.includes(q) || q.includes(key)) {
      ids.forEach(id => resultSet.add(id));
    }
  }
  // Fallback linear scan for substring
  if (resultSet.size === 0) {
    for (const p of persons) {
      if (p.name.includes(q)) resultSet.add(p.id);
    }
  }
  return Array.from(resultSet);
}

export function getDescendantIds(
  id: string,
  childrenMap: Map<string, string[]>
): Set<string> {
  const result = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    let curr = queue.shift()!;
    const children = childrenMap.get(curr) || [];
    for (const c of children) {
      result.add(c);
      queue.push(c);
    }
  }
  return result;
}

export const SYSTEM_USERS: Record<string, { role: 'admin' | 'supervisor'; pass: string }> = {
  magwait:  { role: 'admin',      pass: '@mg2208!QAZ' },
  lateef74: { role: 'supervisor', pass: '@LAT12345678' },
  hewait18: { role: 'supervisor', pass: '@MAG12345678' },
  hewait20: { role: 'supervisor', pass: '@MAG12345678' },
};