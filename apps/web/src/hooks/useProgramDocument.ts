'use client';

import { useEffect, useState } from 'react';
import { loadProgramDocument } from '@/lib/program-document';

export function useProgramDocument(sourceProgram: any, enabled = true) {
  const [program, setProgram] = useState(sourceProgram);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setProgram(sourceProgram);
    setError(null);

    if (!enabled || !sourceProgram) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    if (sourceProgram.metadataJson !== undefined) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    loadProgramDocument(sourceProgram)
      .then((loadedProgram) => {
        if (active) setProgram(loadedProgram);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the complete production sheet.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    enabled,
    sourceProgram?.id,
    sourceProgram?.programNumber,
    sourceProgram?.programSerialNo,
    sourceProgram?.metadataJson,
  ]);

  return { program, loading, error };
}
