import { farmers, missions, restaurantOrders } from "@/data/mocks";
import type { MissionStatus, OrderStatus } from "@/data/mocks";
import { cityCoords } from "./geo";
import type { TrackingSessionConfig, TrackingStep } from "./types";

function missionStatusToStep(status: MissionStatus): TrackingStep {
  switch (status) {
    case "loaded":
      return "transit";
    case "delivered":
      return "dropoff";
    default:
      return "pickup";
  }
}

function orderStatusToStep(status: OrderStatus): TrackingStep {
  switch (status) {
    case "delivering":
      return "transit";
    case "delivered":
      return "dropoff";
    default:
      return "pickup";
  }
}

/** "Le Baobab, Dakar Plateau" -> "Dakar Plateau" */
function lastAddressSegment(address: string): string {
  const parts = address.split(",");
  return parts[parts.length - 1]?.trim() || address;
}

/**
 * Résout la config de suivi (points GPS réels + étape) pour un identifiant
 * de mission (MIS-xxxx) ou de commande restaurant (CMD-xxxx / id interne).
 *
 * Les missions portent déjà des coordonnées réelles (pickup/dropoff) —
 * elles sont utilisées en priorité. Pour une commande sans mission associée
 * dans les données de démo, on retombe sur les villes de l'agriculteur et
 * de l'adresse de livraison.
 */
export function resolveTrackingConfig(
  trackingId: string,
  driverName = "Oumar Ba",
): TrackingSessionConfig | null {
  const mission = missions.find((m) => m.reference === trackingId || m.orderRef === trackingId);
  if (mission) {
    return {
      trackingId,
      pickup: { lat: mission.pickup.lat, lng: mission.pickup.lng, label: mission.pickup.address },
      dropoff: {
        lat: mission.dropoff.lat,
        lng: mission.dropoff.lng,
        label: mission.dropoff.address,
      },
      step: missionStatusToStep(mission.status),
      driverName,
    };
  }

  const order = restaurantOrders.find((o) => o.reference === trackingId || o.id === trackingId);
  if (order) {
    const farmer = farmers.find((f) => f.id === order.farmerId);
    if (!farmer) return null;
    const dropoffCity = lastAddressSegment(order.deliveryAddress);
    return {
      trackingId,
      pickup: { ...cityCoords(farmer.city), label: farmer.farm },
      dropoff: { ...cityCoords(dropoffCity), label: order.deliveryAddress },
      step: orderStatusToStep(order.status),
      driverName,
    };
  }

  return null;
}
