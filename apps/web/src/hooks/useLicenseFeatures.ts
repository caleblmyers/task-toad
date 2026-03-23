import { useState, useEffect } from 'react';
import { gql } from '../api/client';

const LICENSE_QUERY = `query { org { licenseFeatures } }`;

let cachedFeatures: string[] | null = null;

export function useLicenseFeatures() {
  const [features, setFeatures] = useState<string[]>(cachedFeatures ?? []);
  const [loading, setLoading] = useState(cachedFeatures === null);

  useEffect(() => {
    if (cachedFeatures !== null) return;
    gql<{ org: { licenseFeatures: string[] } }>(LICENSE_QUERY)
      .then(({ org }) => {
        cachedFeatures = org.licenseFeatures;
        setFeatures(cachedFeatures);
      })
      .catch(() => {
        cachedFeatures = [];
        setFeatures([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return {
    features,
    hasFeature: (f: string) => features.includes(f),
    loading,
  };
}
