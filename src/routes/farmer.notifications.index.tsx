import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NotificationCenter } from "@/components/common/notification-center";
import { useFarmerNotifications, farmerNotifActions } from "@/data/store";
import type { AppNotification } from "@/data/mocks";

export const Route = createFileRoute("/farmer/notifications/")({
  head: () => ({
    meta: [
      { title: "Notifications · Diambar Agro" },
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
  { key: "order", label: "Commandes" },
  { key: "payment", label: "Paiements" },
  { key: "stock", label: "Stock" },
  { key: "message", label: "Messages" },
  { key: "system", label: "Système" },
];

function NotificationsPage() {
  const items = useFarmerNotifications();
  const navigate = useNavigate();

  const open = (n: AppNotification) => {
    farmerNotifActions.markRead(n.id);
    if (n.type === "order") navigate({ to: "/farmer/orders" });
    else if (n.type === "payment") navigate({ to: "/farmer/revenue" });
    else if (n.type === "stock") navigate({ to: "/farmer/stock" });
    else if (n.type === "message") {
      if (n.refId) {
        navigate({ to: "/farmer/messages/$conversationId", params: { conversationId: n.refId } });
      } else {
        navigate({ to: "/farmer/messages" });
      }
    }
  };

  return (
    <NotificationCenter
      items={items}
      actions={farmerNotifActions}
      onOpen={open}
      types={TYPES}
      rulesTo="/farmer/notifications/rules"
    />
  );
}
