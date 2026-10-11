import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NotificationCenter } from "@/components/common/notification-center";
import { useDriverNotifications, driverNotifActions } from "@/data/store";
import type { AppNotification } from "@/data/mocks";

export const Route = createFileRoute("/driver/notifications/")({
  head: () => ({
    meta: [
      { title: "Notifications · Livreur" },
      {
        name: "description",
        content:
          "Centre de notifications : filtres, statut lu/non lu et règles de déclenchement par canal.",
      },
    ],
  }),
  component: NotificationsPage,
});

const TYPES = [
  { key: "order", label: "Missions" },
  { key: "payment", label: "Paiements" },
  { key: "message", label: "Messages" },
  { key: "system", label: "Système" },
];

function NotificationsPage() {
  const items = useDriverNotifications();
  const navigate = useNavigate();

  const open = (n: AppNotification) => {
    driverNotifActions.markRead(n.id);
    // Lien direct vers l'élément concerné (commande, mission, litige…).
    if (n.link) {
      navigate({ to: n.link as never });
      return;
    }
    if (n.type === "order") navigate({ to: "/driver/missions" });
    else if (n.type === "payment") navigate({ to: "/driver/wallet" });
    else if (n.type === "message") {
      if (n.refId) {
        navigate({
          to: "/driver/messages/$conversationId",
          params: { conversationId: n.refId },
        });
      } else {
        navigate({ to: "/driver/messages" });
      }
    }
  };

  return (
    <NotificationCenter
      items={items}
      actions={driverNotifActions}
      onOpen={open}
      types={TYPES}
      rulesTo="/driver/notifications/rules"
    />
  );
}
