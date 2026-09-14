import { describe, expect, it } from "vitest";
import { act, renderHook } from "../test-utils/render-hook";
import { supportTicketActions, useSupportTickets, useSupportTicketsFor } from "./support";

describe("supportTicketActions.create", () => {
  it("prepends a new open ticket, visible to the author and to admin", () => {
    const all = renderHook(() => useSupportTickets());
    const mine = renderHook(() => useSupportTicketsFor("Test Farmer"));

    act(() => {
      supportTicketActions.create({
        subject: "Test subject",
        message: "Test message body",
        fromName: "Test Farmer",
        fromRole: "farmer",
        category: "other",
      });
    });

    expect(all.result.current[0]).toMatchObject({
      subject: "Test subject",
      status: "open",
      fromName: "Test Farmer",
    });
    expect(mine.result.current).toHaveLength(1);
    expect(mine.result.current[0].subject).toBe("Test subject");
  });

  it("does not leak a ticket into another user's list", () => {
    const someoneElse = renderHook(() => useSupportTicketsFor("Someone Else"));
    act(() => {
      supportTicketActions.create({
        subject: "Not for them",
        message: "message",
        fromName: "A Different Farmer",
        fromRole: "farmer",
        category: "other",
      });
    });
    expect(someoneElse.result.current).toHaveLength(0);
  });
});

describe("supportTicketActions.setStatus", () => {
  it("updates only the targeted ticket's status", () => {
    const tickets = renderHook(() => useSupportTickets());
    let id = "";
    act(() => {
      id = supportTicketActions.create({
        subject: "To be closed",
        message: "message",
        fromName: "Closer Tester",
        fromRole: "restaurant",
        category: "other",
      }).id;
    });

    act(() => {
      supportTicketActions.setStatus(id, "closed");
    });

    const ticket = tickets.result.current.find((t) => t.id === id);
    expect(ticket?.status).toBe("closed");
  });
});
