import { describe, expect, it } from "vitest";
import { parseNaturalTime, remindPresets } from "./reminder-time";
import { hrefForMessageReminder, buildMessageReminder } from "./message-reminder";
import type { Reminder } from "@/lib/storage/reminders";

// Monday 2026-01-05, noon local time — deterministic regardless of TZ since
// both the input `now` and the expectations use local-time constructors.
const NOW = new Date(2026, 0, 5, 12, 0, 0);
const local = (d: number, h: number, m = 0) => new Date(2026, 0, d, h, m, 0).getTime();

describe("parseNaturalTime", () => {
  it("parses relative offsets", () => {
    expect(parseNaturalTime("in 30m", NOW)).toBe(NOW.getTime() + 30 * 60_000);
    expect(parseNaturalTime("in 3 hours", NOW)).toBe(NOW.getTime() + 3 * 3_600_000);
    expect(parseNaturalTime("in 2 days", NOW)).toBe(NOW.getTime() + 48 * 3_600_000);
  });

  it("parses tomorrow with and without a clock time", () => {
    expect(parseNaturalTime("tomorrow", NOW)).toBe(local(6, 9));
    expect(parseNaturalTime("tomorrow 3pm", NOW)).toBe(local(6, 15));
    expect(parseNaturalTime("tomorrow at 15:30", NOW)).toBe(local(6, 15, 30));
  });

  it("bumps a bare clock time to tomorrow when it already passed today", () => {
    expect(parseNaturalTime("5pm", NOW)).toBe(local(5, 17));
    expect(parseNaturalTime("9am", NOW)).toBe(local(6, 9)); // noon already past 9am
  });

  it("parses weekday names and abbreviations as words", () => {
    expect(parseNaturalTime("friday 2pm", NOW)).toBe(local(9, 14));
    expect(parseNaturalTime("next mon", NOW)).toBe(local(12, 9)); // full week out from Monday
  });

  it("does not treat weekday abbreviations inside other words as weekdays", () => {
    // "wed" in wedding, "fri" in friend, "mon" in monthly — must fall through
    // to null (caller shows the try-again hint) instead of silently picking a day.
    expect(parseNaturalTime("before the wedding", NOW)).toBeNull();
    expect(parseNaturalTime("when my friend lands", NOW)).toBeNull();
    expect(parseNaturalTime("monthly", NOW)).toBeNull();
  });

  it("rejects the unparseable and the past", () => {
    expect(parseNaturalTime("whenever", NOW)).toBeNull();
    expect(parseNaturalTime("", NOW)).toBeNull();
    expect(parseNaturalTime("in 0m", NOW)).toBeNull();
  });
});

describe("remindPresets", () => {
  it("produces future times anchored to now", () => {
    const presets = remindPresets(NOW);
    expect(presets).toHaveLength(4);
    for (const p of presets) expect(p.fireAt).toBeGreaterThan(NOW.getTime());
    expect(presets[3].fireAt).toBe(local(6, 9)); // Tomorrow 9am
  });
});

describe("hrefForMessageReminder", () => {
  const base: Reminder = {
    id: "r1",
    task: "t",
    sourceHref: "/fallback",
    fireAt: 1,
    createdAt: 1,
  };

  it("splits an encoded channel context into the team route", () => {
    const href = hrefForMessageReminder({
      ...base,
      contextKind: "channel",
      contextId: "team-guid:19%3Aabc%40thread.tacv2",
      messageId: "17518",
    });
    expect(href).toBe("/workspace/t/team-guid/19%3Aabc%40thread.tacv2?anchor=17518");
  });

  it("routes a chat context to the DM path and falls back without contextId", () => {
    expect(
      hrefForMessageReminder({ ...base, contextKind: "chat", contextId: "19%3Axyz%40unq.gbl.spaces", messageId: "5" })
    ).toBe("/workspace/dm/19%3Axyz%40unq.gbl.spaces?anchor=5");
    expect(hrefForMessageReminder(base)).toBe("/fallback");
  });
});

describe("buildMessageReminder", () => {
  it("derives task, snippet, and a jumpable sourceHref", () => {
    const reminder = buildMessageReminder(
      {
        id: "m1",
        createdDateTime: "2026-01-01T00:00:00Z",
        body: { contentType: "text", content: "ship it" },
        from: { user: { id: "u1", displayName: "Alex" } },
      } as MSMessage,
      { contextId: "chat-1", kind: "chat", contextLabel: "Alex" },
      123
    );
    expect(reminder.task).toContain("Alex");
    expect(reminder.snippet).toBe("ship it");
    expect(reminder.sourceHref).toBe("/workspace/dm/chat-1?anchor=m1");
    expect(reminder.fireAt).toBe(123);
  });
});
