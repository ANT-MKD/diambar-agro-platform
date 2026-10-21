import { useState } from "react";
import { MapPinOff, Satellite, Smartphone, WifiOff, X } from "lucide-react";
import { openGpsSettings, type GpsStatus } from "@/lib/tracking/device-gps";

/** Lien de téléchargement de l'application Android (facultatif). */
const ANDROID_APP_URL = (import.meta.env.VITE_ANDROID_APP_URL as string | undefined)?.trim();
const DISMISS_KEY = "diambar.gps-browser-tip";

/**
 * Bandeau en haut de l'espace livreur : il n'apparaît que s'il y a quelque
 * chose à faire (autorisation refusée, réseau coupé, page à garder ouverte).
 */
export function GpsStatusBanner({ status, retry }: { status: GpsStatus; retry: () => void }) {
  const [tipHidden, setTipHidden] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (status.state === "off") return null;

  if (status.state === "denied") {
    return (
      <Banner tone="danger" icon={MapPinOff}>
        <p className="font-semibold">Localisation refusée</p>
        <p>
          Le restaurant et l'équipe Diambar ne voient pas où vous êtes.{" "}
          {status.native
            ? "Autorisez la localisation « Toujours » ou « Pendant l'utilisation » pour Diambar Agro, et activez la localisation du téléphone."
            : "Autorisez la localisation pour ce site (icône à gauche de l'adresse), et activez la localisation du téléphone."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {status.native && (
            <button
              onClick={() => void openGpsSettings()}
              className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
            >
              Ouvrir les réglages
            </button>
          )}
          <button
            onClick={retry}
            className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold"
          >
            Réessayer
          </button>
        </div>
      </Banner>
    );
  }

  if (status.state === "unsupported") {
    return (
      <Banner tone="warning" icon={MapPinOff}>
        Ce navigateur ne donne pas votre position. Utilisez l'application Android Diambar Agro ou
        Chrome sur votre téléphone.
      </Banner>
    );
  }

  if (status.sendFailing) {
    return (
      <Banner tone="warning" icon={WifiOff}>
        Position non transmise (pas de réseau). Nouvel essai automatique dès le retour du réseau.
      </Banner>
    );
  }

  if (status.state === "starting") {
    return (
      <Banner tone="info" icon={Satellite}>
        Recherche du signal GPS… Restez à l'extérieur si possible.
      </Banner>
    );
  }

  // Dans le navigateur, la position ne part que si la page reste ouverte.
  if (!status.native && !tipHidden) {
    return (
      <Banner
        tone="info"
        icon={Smartphone}
        onClose={() => {
          setTipHidden(true);
          try {
            sessionStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // Navigation privée : le conseil reviendra au prochain chargement.
          }
        }}
      >
        <p>
          GPS actif tant que cette page reste ouverte à l'écran. Pour transmettre votre position
          pendant que vous suivez Waze ou Google Maps, ou écran éteint, utilisez l'application
          Android Diambar Agro.
        </p>
        {ANDROID_APP_URL ? (
          <a
            href={ANDROID_APP_URL}
            className="mt-2 inline-flex rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Télécharger l'application Android
          </a>
        ) : (
          <p className="mt-1 text-muted-foreground">Demandez-la à l'équipe Diambar.</p>
        )}
      </Banner>
    );
  }

  return null;
}

const TONES = {
  danger: "border-destructive/40 bg-destructive/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  info: "border-primary/30 bg-primary/5",
};

function Banner({
  tone,
  icon: Icon,
  onClose,
  children,
}: {
  tone: keyof typeof TONES;
  icon: typeof Satellite;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={`mb-4 flex items-start gap-3 rounded-xl border p-3 text-xs leading-relaxed ${TONES[tone]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Masquer"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md hover:bg-accent"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
