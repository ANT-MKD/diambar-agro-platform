import { createFileRoute, redirect } from "@tanstack/react-router";

type Role = "restaurant" | "farmer" | "driver";
const ROLES: Role[] = ["restaurant", "farmer", "driver"];

// Ancienne page « Demander l'accès » : l'inscription est désormais directe
// (chaque compte est ensuite vérifié par l'équipe). Les anciens liens mènent
// à l'inscription, avec le profil s'il était précisé.
export const Route = createFileRoute("/demande-acces")({
  validateSearch: (s: Record<string, unknown>): { role?: Role } => ({
    role: ROLES.includes(s.role as Role) ? (s.role as Role) : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/register", search: search.role ? { role: search.role } : {} });
  },
});
