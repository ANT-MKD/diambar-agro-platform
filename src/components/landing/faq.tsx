import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faq } from "@/data/mocks";

export function Faq() {
  return (
    <section id="faq" className="py-24 bg-card/30">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center mb-10">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-wider">Support</p>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-bold">Questions fréquentes</h2>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {faq.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="glass rounded-2xl px-5 border-0">
              <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
