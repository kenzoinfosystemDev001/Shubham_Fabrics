'use client';

import { useEffect, useState } from 'react';
import { loadChallanDocument } from '@/lib/program-document';

/** Loads the complete challan (items + production sheet) for document views. */
export function useChallanDocument(sourceChallan: any, enabled = true) {
  const [challan, setChallan] = useState(sourceChallan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setChallan(sourceChallan);
    setError(null);

    if (!enabled || !sourceChallan) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    loadChallanDocument(sourceChallan)
      .then((loaded) => {
        if (active) setChallan(loaded);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the complete challan.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, sourceChallan?.id, sourceChallan?.challanNumber]);

  return { challan, loading, error };
}
