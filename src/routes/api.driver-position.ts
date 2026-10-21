import { createFileRoute } from "@tanstack/react-router";

// Positions GPS envoyées par le téléphone du livreur (voir gps-endpoint.server).
export const Route = createFileRoute("/api/driver-position")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleDriverPosition } = await import("@/lib/market/gps-endpoint.server");
        return handleDriverPosition(request);
      },
    },
  },
});
