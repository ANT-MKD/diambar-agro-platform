import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supportTicketActions, type SupportTicket, type TicketRole } from "@/data/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SupportTicketFormProps {
  role: TicketRole;
  fromName: string;
  onCreated?: (ticket: SupportTicket) => void;
}

export function SupportTicketForm({ role, fromName, onCreated }: SupportTicketFormProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderRef, setOrderRef] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || message.trim().length < 10) {
      toast.error("Décrivez votre problème en au moins 10 caractères");
      return;
    }
    const ticket = supportTicketActions.create({
      subject: subject.trim(),
      message: message.trim(),
      fromName,
      fromRole: role,
      orderRef: orderRef.trim() || undefined,
    });
    toast.success(`Ticket ${ticket.id.toUpperCase()} envoyé — notre équipe répond sous 4h`);
    setSubject("");
    setMessage("");
    setOrderRef("");
    onCreated?.(ticket);
  };

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl max-w-xl space-y-4 p-6">
      <div>
        <Label htmlFor="subject">Sujet</Label>
        <Input
          id="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1.5"
          placeholder="Paiement, livraison, compte…"
        />
      </div>
      <div>
        <Label htmlFor="orderRef">Référence commande (optionnel)</Label>
        <Input
          id="orderRef"
          value={orderRef}
          onChange={(e) => setOrderRef(e.target.value)}
          className="mt-1.5"
          placeholder="CMD-2851"
        />
      </div>
      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          required
          minLength={10}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <Button type="submit">Envoyer au support</Button>
    </form>
  );
}
