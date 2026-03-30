import type { Move, MoveState } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MoveHistoryLine = {
  moveId: string;
  materialId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  unitCost: number | null;
  state: MoveState;
  presetCode: string | null;
  reference: string | null;
  timestamp: Date;
};

export type MoveHistoryReport = {
  totalMoves: number;
  lines: MoveHistoryLine[];
};

// ---------------------------------------------------------------------------
// Report generator
// ---------------------------------------------------------------------------

export function generateMoveHistory(
  moves: Move[],
  filters?: {
    materialId?: string;
    locationId?: string;
    presetCode?: string;
    state?: string;
    fromDate?: Date;
    toDate?: Date;
  },
  sort?: {
    field: 'timestamp' | 'materialId' | 'quantity';
    direction: 'asc' | 'desc';
  },
): MoveHistoryReport {
  let filtered = moves;

  if (filters?.materialId) {
    filtered = filtered.filter((m) => m.materialId === filters.materialId);
  }

  if (filters?.locationId) {
    filtered = filtered.filter(
      (m) =>
        m.fromLocationId === filters.locationId ||
        m.toLocationId === filters.locationId,
    );
  }

  if (filters?.presetCode) {
    filtered = filtered.filter((m) => m.presetCode === filters.presetCode);
  }

  if (filters?.state) {
    filtered = filtered.filter((m) => m.state === filters.state);
  }

  if (filters?.fromDate) {
    const from = filters.fromDate;
    filtered = filtered.filter((m) => m.timestamp >= from);
  }

  if (filters?.toDate) {
    const to = filters.toDate;
    filtered = filtered.filter((m) => m.timestamp <= to);
  }

  const lines: MoveHistoryLine[] = filtered.map((m) => ({
    moveId: m.id,
    materialId: m.materialId,
    fromLocationId: m.fromLocationId,
    toLocationId: m.toLocationId,
    quantity: m.quantity,
    unitCost: m.unitCost,
    state: m.state,
    presetCode: m.presetCode,
    reference: m.reference,
    timestamp: m.timestamp,
  }));

  if (sort) {
    const dir = sort.direction === 'asc' ? 1 : -1;
    lines.sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      if (av instanceof Date && bv instanceof Date) {
        return (av.getTime() - bv.getTime()) * dir;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return 0;
    });
  }

  return {
    totalMoves: lines.length,
    lines,
  };
}
