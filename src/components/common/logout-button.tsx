import { LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { logoutFn } from "@/lib/auth/functions";

export function LogoutButton({ className }: { className?: string }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutFn();
    navigate({ to: "/login" });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      aria-label="Se déconnecter"
      className={
        className ??
        "grid h-7 w-7 place-items-center rounded-lg hover:bg-accent text-muted-foreground"
      }
    >
      <LogOut className="h-3.5 w-3.5" />
    </button>
  );
}
