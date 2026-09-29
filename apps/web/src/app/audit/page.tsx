'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function AuditLedgerPage() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs({
        entity: entityFilter || undefined,
        action: actionFilter || undefined,
        limit: 100,
      });
      setAuditLogs(res.records);
      setTotal(res.total);
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [entityFilter, actionFilter]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🛡️</span> Immutable Audit & Traceability Ledger
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Complete cryptographic audit trail of all factory mutations, actor IDs, timestamps, and state diffs
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-slate-400 px-3 py-1.5 rounded bg-slate-900 border border-slate-800">
            Total Audit Records: <span className="font-bold text-slate-200">{total}</span>
          </span>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs font-mono">
        <div>
          <span className="text-slate-400 mr-2">Target Entity:</span>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
          >
            <option value="">All Entities</option>
            <option value="Program">Program</option>
            <option value="Challan">Challan</option>
            <option value="ProductionTransaction">ProductionTransaction</option>
            <option value="QualityInspection">QualityInspection</option>
            <option value="User">User</option>
          </select>
        </div>

        <div>
          <span className="text-slate-400 mr-2">Action:</span>
          <input
            type="text"
            placeholder="Filter action (e.g. CHALLAN_ISSUED)..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 w-64"
          />
        </div>

        <button
          onClick={loadLogs}
          className="ml-auto px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
        >
          Refresh Ledger
        </button>
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 font-mono text-xs">Loading Audit Logs...</div>
      ) : auditLogs.length === 0 ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs bg-slate-900 border border-slate-800 rounded-lg">
          No audit records found matching criteria.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action Event</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Entity ID</th>
                <th className="p-3">Actor / Operator</th>
                <th className="p-3">Role</th>
                <th className="p-3 text-right">State Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {auditLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-bold text-blue-400">{log.action}</td>
                      <td className="p-3 text-slate-300 font-semibold">{log.entity}</td>
                      <td className="p-3 text-slate-500 text-[11px] truncate max-w-[120px]" title={log.entityId}>
                        {log.entityId}
                      </td>
                      <td className="p-3 text-slate-200">{log.actor?.fullName || log.actor?.username}</td>
                      <td className="p-3 text-emerald-400 text-[11px]">{log.actor?.role}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-[11px]"
                        >
                          {isExpanded ? 'Hide Payload' : 'View Payload ➔'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-950">
                        <td colSpan={7} className="p-4 border-b border-slate-800">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                            {log.beforeState && (
                              <div>
                                <span className="font-bold text-amber-400 block mb-1">State Before Mutation:</span>
                                <pre className="bg-slate-900 border border-slate-800 p-2.5 rounded overflow-x-auto text-slate-300">
                                  {JSON.stringify(JSON.parse(log.beforeState), null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.afterState && (
                              <div>
                                <span className="font-bold text-emerald-400 block mb-1">State After Mutation:</span>
                                <pre className="bg-slate-900 border border-slate-800 p-2.5 rounded overflow-x-auto text-slate-300">
                                  {JSON.stringify(JSON.parse(log.afterState), null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
