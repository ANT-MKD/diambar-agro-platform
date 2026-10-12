// Modèles des emails envoyés par la plateforme (français, HTML + texte brut).
// Fonctions pures : testables sans envoi. Le HTML reste simple (tableau, styles
// en ligne) pour s'afficher correctement dans Gmail, Outlook et sur téléphone.

export type EmailContent = { subject: string; html: string; text: string; tag: string };

const BRAND = "Diambar Agro";
const GREEN = "#166534";

/** Échappe le texte venu des utilisateurs (noms, motifs) avant de l'insérer en HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "code"; code: string }
  | { kind: "button"; label: string; url: string }
  | { kind: "quote"; text: string }
  | { kind: "small"; text: string };

function render(title: string, blocks: Block[]): { html: string; text: string } {
  const htmlBlocks = blocks
    .map((b) => {
      switch (b.kind) {
        case "p":
          return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937">${escapeHtml(b.text)}</p>`;
        case "code":
          return `<p style="margin:8px 0 24px;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;font-family:Menlo,Consolas,monospace">${escapeHtml(b.code)}</p>`;
        case "button":
          return `<p style="margin:8px 0 24px"><a href="${escapeHtml(b.url)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:999px">${escapeHtml(b.label)}</a></p><p style="margin:0 0 16px;font-size:12px;color:#6b7280;word-break:break-all">Si le bouton ne marche pas, copiez ce lien : ${escapeHtml(b.url)}</p>`;
        case "quote":
          return `<p style="margin:0 0 16px;padding:12px 16px;background:#fef3c7;border-radius:12px;font-size:15px;line-height:1.6;color:#78350f;white-space:pre-line">${escapeHtml(b.text)}</p>`;
        case "small":
          return `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#6b7280">${escapeHtml(b.text)}</p>`;
      }
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px 28px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<tr><td>
<p style="margin:0 0 24px;font-size:14px;font-weight:700;letter-spacing:1px;color:${GREEN};text-transform:uppercase">${BRAND}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827">${escapeHtml(title)}</h1>
${htmlBlocks}
<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#9ca3af">${BRAND} · Produits frais du producteur au restaurant · Dakar, Sénégal<br>Message automatique : ne communiquez jamais ce code ou ce lien à quelqu'un d'autre.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  const text = [
    BRAND.toUpperCase(),
    "",
    title,
    "",
    ...blocks.map((b) => {
      switch (b.kind) {
        case "code":
          return `Code : ${b.code}\n`;
        case "button":
          return `${b.label} : ${b.url}\n`;
        case "quote":
          return `« ${b.text} »\n`;
        default:
          return `${b.text}\n`;
      }
    }),
    "—",
    `${BRAND} · Dakar, Sénégal. Message automatique : ne communiquez jamais ce code ou ce lien.`,
  ].join("\n");
  return { html, text };
}

function email(tag: string, subject: string, title: string, blocks: Block[]): EmailContent {
  return { subject, tag, ...render(title, blocks) };
}

export const ROLE_NAMES: Record<string, string> = {
  farmer: "producteur",
  restaurant: "restaurant",
  driver: "livreur",
  admin: "administrateur",
};

// --- Codes et liens ------------------------------------------------------------

export function registrationCodeEmail(p: { firstName: string; code: string }): EmailContent {
  return email(
    "inscription-code",
    `${p.code} : votre code d'inscription Diambar Agro`,
    `Bonjour ${p.firstName}, voici votre code`,
    [
      {
        kind: "p",
        text: "Saisissez ce code sur la page d'inscription pour vérifier votre adresse email :",
      },
      { kind: "code", code: p.code },
      {
        kind: "small",
        text: "Il est valable 10 minutes. Si vous n'avez pas demandé à vous inscrire, ignorez ce message.",
      },
    ],
  );
}

export function loginCodeEmail(p: { name: string; code: string }): EmailContent {
  return email(
    "connexion-code",
    `${p.code} : votre code de connexion Diambar Agro`,
    "Votre code de connexion",
    [
      { kind: "p", text: `Bonjour ${p.name}, saisissez ce code pour terminer votre connexion :` },
      { kind: "code", code: p.code },
      {
        kind: "small",
        text: "Il est valable 5 minutes. Si ce n'est pas vous qui essayez de vous connecter, changez votre mot de passe tout de suite.",
      },
    ],
  );
}

export function passwordResetEmail(p: { name: string; url: string }): EmailContent {
  return email(
    "mot-de-passe-lien",
    "Choisir un nouveau mot de passe — Diambar Agro",
    "Nouveau mot de passe",
    [
      { kind: "p", text: `Bonjour ${p.name}, vous avez demandé à changer de mot de passe.` },
      { kind: "button", label: "Choisir un nouveau mot de passe", url: p.url },
      {
        kind: "small",
        text: "Ce lien est valable 30 minutes et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable.",
      },
    ],
  );
}

export function passwordChangedEmail(p: { name: string; supportUrl: string }): EmailContent {
  return email(
    "mot-de-passe-modifie",
    "Votre mot de passe a été modifié — Diambar Agro",
    "Mot de passe modifié",
    [
      {
        kind: "p",
        text: `Bonjour ${p.name}, le mot de passe de votre compte vient d'être modifié. Vos autres connexions ont été fermées.`,
      },
      { kind: "p", text: "Si ce n'est pas vous, contactez-nous immédiatement :" },
      { kind: "button", label: "Contacter Diambar Agro", url: p.supportUrl },
    ],
  );
}

// --- Inscription et validation ----------------------------------------------------

export function applicationReceivedEmail(p: { firstName: string; role: string }): EmailContent {
  return email(
    "dossier-recu",
    "Votre inscription est bien reçue — Diambar Agro",
    `Merci ${p.firstName}, votre compte est créé`,
    [
      {
        kind: "p",
        text: `Votre compte ${ROLE_NAMES[p.role] ?? ""} est en cours de vérification par notre équipe. Cela prend en général moins de 48 heures ouvrées.`,
      },
      {
        kind: "p",
        text: "Nous pourrons vous appeler au numéro que vous avez donné pour confirmer quelques informations. Vous recevrez un email dès que votre compte sera activé.",
      },
    ],
  );
}

export function accountApprovedEmail(p: { firstName: string; loginUrl: string }): EmailContent {
  return email(
    "compte-valide",
    "Votre compte Diambar Agro est activé",
    `Bienvenue ${p.firstName}, votre compte est activé`,
    [
      {
        kind: "p",
        text: "Notre équipe a vérifié votre dossier : vous pouvez maintenant vous connecter avec votre email et votre mot de passe.",
      },
      { kind: "button", label: "Se connecter", url: p.loginUrl },
    ],
  );
}

export function correctionRequestedEmail(p: {
  firstName: string;
  note: string;
  contactUrl: string;
}): EmailContent {
  return email(
    "correction-demandee",
    "Une précision est demandée sur votre inscription — Diambar Agro",
    "Une précision est demandée",
    [
      {
        kind: "p",
        text: `Bonjour ${p.firstName}, pour terminer la vérification de votre compte, notre équipe a besoin d'une précision :`,
      },
      { kind: "quote", text: p.note },
      {
        kind: "p",
        text: "Répondez-nous depuis la page contact : votre dossier sera revu dès réception.",
      },
      { kind: "button", label: "Répondre à l'équipe", url: p.contactUrl },
    ],
  );
}

export function applicationRejectedEmail(p: {
  firstName: string;
  note: string;
  contactUrl: string;
}): EmailContent {
  return email(
    "dossier-refuse",
    "Votre inscription n'a pas été validée — Diambar Agro",
    "Inscription non validée",
    [
      {
        kind: "p",
        text: `Bonjour ${p.firstName}, après vérification, votre inscription n'a pas été validée pour la raison suivante :`,
      },
      { kind: "quote", text: p.note },
      { kind: "p", text: "Si vous pensez qu'il s'agit d'une erreur, contactez-nous." },
      { kind: "button", label: "Contacter Diambar Agro", url: p.contactUrl },
    ],
  );
}

export function newApplicationAdminEmail(p: {
  applicantName: string;
  role: string;
  city: string | null;
  reviewUrl: string;
}): EmailContent {
  return email(
    "admin-nouvelle-inscription",
    `Nouvelle inscription à valider : ${p.applicantName}`,
    "Nouvelle inscription à valider",
    [
      {
        kind: "p",
        text: `${p.applicantName} (${ROLE_NAMES[p.role] ?? p.role}${p.city ? `, ${p.city}` : ""}) vient de s'inscrire et attend votre validation.`,
      },
      { kind: "button", label: "Examiner le dossier", url: p.reviewUrl },
    ],
  );
}

// --- Équipe -----------------------------------------------------------------------

export function staffInviteEmail(p: {
  firstName: string;
  roleLabel: string;
  inviterName: string;
  url: string;
}): EmailContent {
  return email(
    "invitation-equipe",
    "Invitation à rejoindre l'équipe Diambar Agro",
    `${p.firstName}, rejoignez l'équipe Diambar Agro`,
    [
      {
        kind: "p",
        text: `${p.inviterName} vous invite à rejoindre l'administration de Diambar Agro avec le rôle « ${p.roleLabel} ».`,
      },
      { kind: "button", label: "Créer mon compte", url: p.url },
      { kind: "small", text: "Ce lien personnel est valable 72 heures et ne sert qu'une fois." },
    ],
  );
}
