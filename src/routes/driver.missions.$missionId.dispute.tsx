import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { DisputeForm } from "@/components/disputes/dispute-form";
import { useMission } from "@/data/store";
import { driverProfile } from "@/data/mocks";

export const Route = createFileRoute("/driver/missions/$missionId/dispute")({
  head: () => ({
    meta: [
      { title: "Signaler un incident — Espace livreur Diambar Agro" },
      {
        name: "description",
        content: "Déclarer un incident de course : client absent, colis refusé, adresse erronée.",
      },
      { property: "og:title", content: "Signaler un incident — Livreur" },
      { property: "og:description", content: "Déclarer un incident de course sur une mission." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DriverOpenDispute,
});

function DriverOpenDispute() {
  const { missionId } = Route.useParams();
  const mission = useMission(missionId);
  const navigate = useNavigate();
  if (!mission)
    return <p className="py-12 text-center text-muted-foreground">Mission introuvable</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Signaler un incident de course"
        subtitle={`${mission.reference} · commande ${mission.orderRef}`}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate({ to: "/driver/missions/$missionId", params: { missionId } })}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        }
      />
      <DisputeForm
        openedByRole="driver"
        openedByName={driverProfile.name}
        againstOptions={[
          { role: "restaurant", name: mission.dropoff.address },
          { role: "farmer", name: mission.pickup.address },
          { role: "platform", name: "Plateforme Diambar" },
        ]}
        orderRef={mission.orderRef}
        missionId={mission.id}
        hasGpsTrack
        maxAmount={mission.payout}
        defaultCategory="delivery"
        onCancel={() => navigate({ to: "/driver/missions/$missionId", params: { missionId } })}
        onCreated={(id) =>
          navigate({ to: "/driver/disputes/$disputeId", params: { disputeId: id } })
        }
      />
    </div>
  );
}
