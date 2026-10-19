import { useLoaderData } from "@tanstack/react-router";
import { DEFAULT_PUBLIC_INFO, type PublicInfo } from "@/lib/public-info-model";

/** Coordonnées et tarifs du site public (chargés par la route racine). */
export function usePublicInfo(): PublicInfo {
  return useLoaderData({ from: "__root__" }) ?? DEFAULT_PUBLIC_INFO;
}
