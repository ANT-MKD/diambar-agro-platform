import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NotificationCenter } from "@/components/common/notification-center";
import { useRestaurantNotifications, restaurantNotifActions } from "@/data/store";
import type { AppNotification } from "@/data/mocks";

export const Route = createFileRoute("/restaurant/notifications/")({
  head: () => ({
    meta: [
      { title: "Notifications · Restaurant" },
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
  { key: "payment", label: "Factures" },
  { key: "stock", label: "Disponibilités" },
  { key: "message", label: "Messages" },
  { key: "system", label: "Système" },
];

function NotificationsPage() {
  const items = useRestaurantNotifications();
  const navigate = useNavigate();

  const open = (n: AppNotification) => {
    restaurantNotifActions.markRead(n.id);
    if (n.type === "order") navigate({ to: "/restaurant/orders" });
    else if (n.type === "payment") navigate({ to: "/restaurant/invoices" });
    else if (n.type === "stock") navigate({ to: "/restaurant/marketplace" });
    else if (n.type === "message") {
      if (n.refId) {
        navigate({
          to: "/restaurant/messages/$conversationId",
          params: { conversationId: n.refId },
        });
      } else {
        navigate({ to: "/restaurant/messages" });
      }
    }
  };

  return (
    <NotificationCenter
      items={items}
      actions={restaurantNotifActions}
      onOpen={open}
      types={TYPES}
      rulesTo="/restaurant/notifications/rules"
    />
  );
}
