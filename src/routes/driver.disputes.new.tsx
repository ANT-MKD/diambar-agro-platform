import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Truck, Search } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DisputeForm } from "@/components/disputes/dispute-form";
import { useMissions } from "@/data/store";
import { farmers, restaurants, driverProfile } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/driver/disputes/new")({
  head: () => ({
    meta: [
      { title: "Nouveau litige — Espace livreur Diambar Agro" },
      {
        name: "description",
        content: "Sélectionnez la mission concernée et décrivez le problème rencontré.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewDriverDispute,
});

function NewDriverDispute() {
  const navigate = useNavigate();
  const missions = useMissions();
  const [missionId, setMissionId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const myMissions = useMemo(
    () =>
      missions
        .filter((m) => m.driverId === "d1")
        .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),
    [missions],
  );
  const filteredMissions = myMissions.filter(
    (m) =>
      m.reference.toLowerCase().includes(q.toLowerCase()) ||
      m.orderRef.toLowerCase().includes(q.toLowerCase()),
  );

  const mission = myMissions.find((m) => m.id === missionId) ?? null;
  const farmer = mission ? farmers.find((f) => f.id === mission.farmerId) : null;
  const restaurant = mission ? restaurants.find((r) => r.id === mission.restaurantId) : null;

  if (mission) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader
          title="Nouveau litige"
          subtitle={`${mission.reference} · commande ${mission.orderRef}`}
          actions={
            <Button variant="outline" className="gap-2" onClick={() => setMissionId(null)}>
              <ArrowLeft className="h-4 w-4" />
              Changer de mission
            </Button>
          }
        />
        <DisputeForm
          openedByRole="driver"
          openedByName={driverProfile.name}
          againstOptions={[
            { role: "restaurant", name: restaurant?.name ?? mission.dropoff.address },
            { role: "farmer", name: farmer?.farm ?? mission.pickup.address },
            { role: "platform", name: "Plateforme Diambar" },
          ]}
          orderRef={mission.orderRef}
          missionId={mission.id}
          hasGpsTrack
          maxAmount={mission.payout}
          defaultCategory="delivery"
          onCancel={() => setMissionId(null)}
          onCreated={(id) =>
            navigate({ to: "/driver/disputes/$disputeId", params: { disputeId: id } })
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Nouveau litige"
        subtitle="1. Sélectionnez la mission concernée"
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate({ to: "/driver/disputes" })}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        }
      />
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une mission (ex: MIS-4200)"
          className="pl-9"
        />
      </div>
      {filteredMissions.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Aucune mission"
          description="Vous n'avez encore aucune mission à contester."
        />
      ) : (
        <div className="space-y-2 max-h-[28rem] overflow-auto">
          {filteredMissions.map((m) => {
            const f = farmers.find((x) => x.id === m.farmerId);
            const r = restaurants.find((x) => x.id === m.restaurantId);
            return (
              <button
                key={m.id}
                onClick={() => setMissionId(m.id)}
                className="w-full text-left rounded-xl border border-border p-3 hover:bg-accent/40 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-sm">{m.reference}</span>
                  <span className="text-sm font-bold">{formatFCFA(m.payout)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {f?.farm} → {r?.name} · {m.scheduledFor.slice(0, 10)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
