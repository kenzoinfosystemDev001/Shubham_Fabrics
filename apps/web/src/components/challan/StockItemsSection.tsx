'use client';

import React from 'react';
import { CopyPlus, Plus, Trash2 } from 'lucide-react';
import { QuantityUnitField, averageError, quantityPairError, type QtyUnit } from '@/components/challan/AverageField';

// The Items section (Fabric -> Colour -> entries of Size, Average, Unit, Remarks), same layout as the
// Programming / Fabric Store challan form, for departments that send material they hold. Fabric and Colour
// are chosen from the department's own ready lines, so every entry stays linked to its stock line and the
// existing quantity checks; an entry's Size is the quantity sent, in that line's unit (MTR and PCS are never
// converted). Average and Unit are quantities with their own MTR / PCS, saved with the line. Several entries
// of one colour are sent as separate challan lines of the same stock line.

/** A stock line the department can send from (a work line, or a dyeing record). */
export interface StockSource {
  id: string;
  fabric: string;
  colour: string;
  uom: string; // MTR | PCS
  available: number;
  /** Extra detail shown with the colour choice, e.g. "Challan 100 · Dyed". */
  detail?: string;
}

export interface StockEntry {
  key: string;
  size: string;
  average: string;
  averageUnit: QtyUnit;
  unitQuantity: string;
  unitQuantityUom: QtyUnit;
  remarks: string;
}
export interface StockColour {
  key: string;
  sourceId: string;
  entries: StockEntry[];
}
export interface StockFabric {
  key: string;
  fabric: string;
  colours: StockColour[];
}

/** One challan line to send: the stock line, quantity (Size) and the entry's Average, Unit quantity and Remarks. */
export interface StockLine {
  sourceId: string;
  quantity: number;
  average: number | null;
  averageUnit: 'MTR' | 'PCS' | null;
  unitQuantity: number;
  unitQuantityUom: 'MTR' | 'PCS';
  remarks: string;
}

const uid = () => Math.random().toString(36).slice(2);
export const newStockEntry = (): StockEntry => ({ key: uid(), size: '', average: '', averageUnit: '', unitQuantity: '', unitQuantityUom: '', remarks: '' });
export const newStockColour = (): StockColour => ({ key: uid(), sourceId: '', entries: [newStockEntry()] });
export const newStockFabric = (): StockFabric => ({ key: uid(), fabric: '', colours: [newStockColour()] });

const FIELD_BASE =
  'w-full h-9 px-3 border rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition';
const FIELD = `${FIELD_BASE} bg-white border-neutral-200 hover:border-neutral-300`;
const REQUIRED = <span className="text-danger-500 ml-0.5" aria-hidden="true">*</span>;
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Turns the filled section into challan lines, or an error to show. Every colour needs a line chosen and
 * every entry a Size; the entries of one stock line together may not exceed what it has available.
 */
export function stockLinesOf(fabrics: StockFabric[], sources: StockSource[]): { lines: StockLine[] } | { error: string } {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const lines: StockLine[] = [];
  const used = new Map<string, number>();
  for (const [fi, f] of fabrics.entries()) {
    if (!f.fabric) return { error: `Fabric ${fi + 1}: choose the fabric.` };
    for (const [ci, c] of f.colours.entries()) {
      const src = byId.get(c.sourceId);
      if (!src) return { error: `${f.fabric}, colour ${ci + 1}: choose the colour.` };
      for (const [ei, e] of c.entries.entries()) {
        const where = `${f.fabric} · ${src.colour || 'colour'} · entry ${ei + 1}`;
        const size = Number(e.size);
        if (e.size.trim() === '' || !Number.isFinite(size) || size <= 0) return { error: `${where}: enter the Size (quantity) greater than 0.` };
        const extrasError = averageError(e.average, e.averageUnit) || quantityPairError(e.unitQuantity, e.unitQuantityUom, 'Unit quantity', true);
        if (extrasError) return { error: `${where}: ${extrasError}.` };
        const hasAverage = e.average.trim() !== '';
        used.set(src.id, round((used.get(src.id) || 0) + size));
        lines.push({
          sourceId: src.id,
          quantity: round(size),
          average: hasAverage ? Number(e.average) : null,
          averageUnit: hasAverage ? (e.averageUnit as 'MTR' | 'PCS') : null,
          unitQuantity: Number(e.unitQuantity),
          unitQuantityUom: e.unitQuantityUom as 'MTR' | 'PCS',
          remarks: e.remarks.trim(),
        });
      }
    }
  }
  if (lines.length === 0) return { error: 'Add at least one item.' };
  for (const [id, total] of used) {
    const src = byId.get(id)!;
    if (total > src.available + 0.0005) {
      return { error: `${src.fabric} · ${src.colour || '—'}: entries add up to ${total} ${src.uom}, but only ${src.available} ${src.uom} is available.` };
    }
  }
  return { lines };
}

export function StockItemsSection({
  sources,
  value,
  onChange,
  disabled,
  emptyText = 'Choose a Production Sheet to add items.',
}: {
  sources: StockSource[];
  value: StockFabric[];
  onChange: (next: StockFabric[]) => void;
  disabled?: boolean;
  emptyText?: string;
}) {
  const fabricNames = Array.from(new Set(sources.map((s) => s.fabric).filter(Boolean)));
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const colourCount = value.reduce((n, f) => n + f.colours.length, 0);

  const setFabric = (fk: string, patch: (f: StockFabric) => StockFabric) => onChange(value.map((f) => (f.key === fk ? patch(f) : f)));
  const setColour = (fk: string, ck: string, patch: (c: StockColour) => StockColour) =>
    setFabric(fk, (f) => ({ ...f, colours: f.colours.map((c) => (c.key === ck ? patch(c) : c)) }));
  const setEntry = (fk: string, ck: string, ek: string, patch: Partial<StockEntry>) =>
    setColour(fk, ck, (c) => ({ ...c, entries: c.entries.map((e) => (e.key === ek ? { ...e, ...patch } : e)) }));

  // Entered so far per stock line, to show what is left as entries are added.
  const usedOf = (sourceId: string) =>
    round(value.flatMap((f) => f.colours).filter((c) => c.sourceId === sourceId).flatMap((c) => c.entries).reduce((s, e) => s + (Number(e.size) || 0), 0));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-neutral-900">Items</h3>
          <span className="text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
            {value.length} {value.length === 1 ? 'fabric' : 'fabrics'} · {colourCount} {colourCount === 1 ? 'colour' : 'colours'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange([...value, newStockFabric()])}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-brand-50 text-brand-800 border border-brand-300 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add fabric</span>
        </button>
      </div>

      {disabled ? (
        <p className="text-sm text-neutral-500 border border-dashed border-neutral-200 rounded-xl px-4 py-6 text-center">{emptyText}</p>
      ) : sources.length === 0 ? (
        <p className="text-sm text-neutral-500 border border-dashed border-neutral-200 rounded-xl px-4 py-6 text-center">Nothing on this Production Sheet is ready to send.</p>
      ) : (
        value.map((f, fi) => {
          const colourSources = sources.filter((s) => s.fabric === f.fabric);
          return (
            <div key={f.key} className="border border-neutral-200 rounded-xl bg-white shadow-xs overflow-hidden">
              {/* Fabric */}
              <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-lg bg-brand-50 border border-brand-100 text-[11px] font-bold text-brand-800 tabular-nums">
                  {fi + 1}
                </span>
                <label className="flex-1 min-w-[200px] flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 shrink-0">Fabric{REQUIRED}</span>
                  <select
                    required
                    aria-label={`Fabric ${fi + 1}`}
                    value={f.fabric}
                    onChange={(e) => setFabric(f.key, () => ({ ...f, fabric: e.target.value, colours: [newStockColour()] }))}
                    className={`${FIELD} font-semibold max-w-md cursor-pointer`}
                  >
                    <option value="">Fabric name</option>
                    {fabricNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <span className="text-xs text-neutral-500 tabular-nums">
                  {f.colours.length} {f.colours.length === 1 ? 'colour' : 'colours'}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(value.length > 1 ? value.filter((x) => x.key !== f.key) : [newStockFabric()])}
                  className="p-2 text-neutral-400 hover:text-danger-600 rounded-lg hover:bg-danger-50 transition cursor-pointer"
                  title="Remove this fabric"
                  aria-label={`Remove fabric ${fi + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Colours */}
              <div className="divide-y divide-neutral-200">
                {f.colours.map((c, ci) => {
                  const src = sourceById.get(c.sourceId);
                  const left = src ? round(src.available - usedOf(src.id)) : null;
                  return (
                    <div key={c.key}>
                      <div className="px-4 py-2.5 flex flex-wrap items-center gap-3 bg-white">
                        <span className="text-xs font-semibold text-neutral-400 tabular-nums w-6">{ci + 1}</span>
                        <label className="flex items-center gap-2 min-w-[220px] flex-1 max-w-md">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 shrink-0">Color{REQUIRED}</span>
                          <select
                            required
                            aria-label={`Colour ${ci + 1} of fabric ${fi + 1}`}
                            value={c.sourceId}
                            onChange={(e) => setColour(f.key, c.key, (x) => ({ ...x, sourceId: e.target.value }))}
                            disabled={!f.fabric}
                            className={`${FIELD} font-semibold cursor-pointer disabled:bg-neutral-50`}
                          >
                            <option value="">{f.fabric ? 'Choose colour' : 'Choose the fabric first'}</option>
                            {colourSources.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.colour || 'No colour'}
                                {s.detail ? ` · ${s.detail}` : ''} · {s.available} {s.uom} available
                              </option>
                            ))}
                          </select>
                        </label>
                        <span className="ml-auto text-xs text-neutral-500 tabular-nums">
                          {c.entries.length} {c.entries.length === 1 ? 'entry' : 'entries'}
                          {src && left !== null && (
                            <span className={left < 0 ? 'font-semibold text-danger-700' : 'font-semibold text-neutral-800'}> · {left} {src.uom} left</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFabric(f.key, (x) => ({ ...x, colours: x.colours.length > 1 ? x.colours.filter((y) => y.key !== c.key) : [newStockColour()] }))
                          }
                          className="p-2 text-neutral-400 hover:text-danger-600 rounded-lg hover:bg-danger-50 transition cursor-pointer"
                          title="Remove this colour"
                          aria-label={`Remove colour ${ci + 1} of fabric ${fi + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Entries */}
                      <div className="overflow-x-auto px-4 pb-2">
                        <table className="w-full table-fixed text-left text-sm border-collapse border border-neutral-200 rounded-lg min-w-[900px]">
                          <thead className="bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap">
                            <tr>
                              <th className="py-2.5 pl-3 pr-2 w-56">Size{REQUIRED}</th>
                              <th className="py-2.5 px-2 w-56">Average</th>
                              <th className="py-2.5 px-2 w-56">Unit{REQUIRED}</th>
                              <th className="py-2.5 px-2">Remarks</th>
                              <th className="py-2.5 pl-2 pr-3 w-14"><span className="sr-only">Remove</span></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {c.entries.map((e, ei) => {
                              return (
                                <tr key={e.key} className="hover:bg-neutral-50/60 transition">
                                  {/* Size: the quantity sent, in the stock line's own unit (never converted) */}
                                  <td className="py-2 pl-3 pr-2">
                                    <QuantityUnitField
                                      label="Size"
                                      value={e.size}
                                      unit={src?.uom === 'MTR' || src?.uom === 'PCS' ? src.uom : ''}
                                      onValue={(size) => setEntry(f.key, c.key, e.key, { size })}
                                      required
                                      disabled={!src}
                                      min="0.001"
                                      max={src?.available}
                                      lockedTitle={src ? `This line is recorded in ${src.uom}; meters and pieces are never converted` : undefined}
                                      inputClassName={`${FIELD} font-semibold`}
                                    />
                                  </td>
                                  {/* Average, with its own MTR / PCS */}
                                  <td className="py-2 px-2">
                                    <QuantityUnitField
                                      label="Average"
                                      value={e.average}
                                      unit={e.averageUnit}
                                      onValue={(average) => setEntry(f.key, c.key, e.key, { average })}
                                      onUnit={(averageUnit) => setEntry(f.key, c.key, e.key, { averageUnit })}
                                      inputClassName={FIELD}
                                    />
                                  </td>
                                  {/* Unit quantity, with its own MTR / PCS */}
                                  <td className="py-2 px-2">
                                    <QuantityUnitField
                                      label="Unit quantity"
                                      value={e.unitQuantity}
                                      unit={e.unitQuantityUom}
                                      onValue={(unitQuantity) => setEntry(f.key, c.key, e.key, { unitQuantity })}
                                      onUnit={(unitQuantityUom) => setEntry(f.key, c.key, e.key, { unitQuantityUom })}
                                      required
                                      disabled={!src}
                                      inputClassName={FIELD}
                                    />
                                  </td>
                                  <td className="py-2 px-2">
                                    <input
                                      type="text"
                                      aria-label="Remarks"
                                      maxLength={300}
                                      value={e.remarks}
                                      onChange={(ev) => setEntry(f.key, c.key, e.key, { remarks: ev.target.value })}
                                      className={FIELD}
                                    />
                                  </td>
                                  <td className="py-2 pl-2 pr-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setColour(f.key, c.key, (x) => ({ ...x, entries: x.entries.length > 1 ? x.entries.filter((y) => y.key !== e.key) : [newStockEntry()] }))
                                      }
                                      className="p-2 text-neutral-400 hover:text-danger-600 rounded-lg hover:bg-danger-50 transition cursor-pointer"
                                      title="Remove this entry"
                                      aria-label={`Remove entry ${ei + 1} of colour ${ci + 1}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <button
                          type="button"
                          onClick={() => setColour(f.key, c.key, (x) => ({ ...x, entries: [...x.entries, newStockEntry()] }))}
                          className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add entry{src?.colour ? ` to ${src.colour}` : ''}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 py-2.5 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setFabric(f.key, (x) => ({ ...x, colours: [...x.colours, newStockColour()] }))}
                  disabled={!f.fabric}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-700 hover:bg-brand-50 transition cursor-pointer disabled:opacity-50"
                >
                  <CopyPlus className="w-3.5 h-3.5" />
                  <span>Add colour{f.fabric ? ` to ${f.fabric}` : ''}</span>
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
