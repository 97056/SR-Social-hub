"use client";

import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";

export type ClientBrand = {
  id: string;
  name: string;
  logoUrl: string | null;
  companyName: string;
};

export function useClientBrand(clientId: string) {
  const [brand, setBrand] = useState<ClientBrand | null>(null);

  useEffect(() => {
    if (!getToken() || !clientId) return;
    apiFetch<{
      client: {
        id: string;
        name: string;
        logoUrl?: string | null;
        companyName: string;
      };
    }>(`/clients/${clientId}/workspace`)
      .then((w) =>
        setBrand({
          id: w.client.id,
          name: w.client.name,
          logoUrl: w.client.logoUrl ?? null,
          companyName: w.client.companyName,
        }),
      )
      .catch(() => setBrand(null));
  }, [clientId]);

  return brand;
}
