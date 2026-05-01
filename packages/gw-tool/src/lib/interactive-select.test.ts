/**
 * Tests for the interactive multi-select prompt module
 */

import { assertEquals } from "@std/assert";
import {
  multiSelect,
  type SelectSection,
  type TerminalIO,
} from "./interactive-select.ts";

// ── Test helpers ────────────────────────────────────────────

/** Encode a sequence of keypresses as raw bytes */
function encodeKeys(...keys: string[]): Uint8Array[] {
  return keys.map((key) => {
    switch (key) {
      case "up":
        return new Uint8Array([0x1b, 0x5b, 0x41]);
      case "down":
        return new Uint8Array([0x1b, 0x5b, 0x42]);
      case "space":
        return new Uint8Array([0x20]);
      case "enter":
        return new Uint8Array([0x0d]);
      case "ctrl-c":
        return new Uint8Array([0x03]);
      case "escape":
        return new Uint8Array([0x1b]);
      case "a":
        return new Uint8Array([0x61]);
      default:
        return new Uint8Array([key.charCodeAt(0)]);
    }
  });
}

/** Create a mock TerminalIO that feeds pre-recorded keypresses */
function createMockIO(
  keys: Uint8Array[],
): { io: TerminalIO; output: string[] } {
  let keyIndex = 0;
  const outputLines: string[] = [];
  const decoder = new TextDecoder();

  const io: TerminalIO = {
    read: async (buf: Uint8Array) => {
      // Small delay to prevent tight loops in test
      await new Promise((r) => setTimeout(r, 1));
      if (keyIndex >= keys.length) return null;
      const key = keys[keyIndex++];
      buf.set(key);
      return key.length;
    },
    write: (data: Uint8Array) => {
      outputLines.push(decoder.decode(data));
    },
    setRaw: (_raw: boolean) => {
      // no-op in tests
    },
    isTerminal: () => true,
  };

  return { io, output: outputLines };
}

function createTestSections(): SelectSection[] {
  return [
    {
      title: "Worktrees",
      items: [
        { label: "feat/old", value: "wt:feat/old" },
        {
          label: "main",
          value: "wt:main",
          disabled: true,
          disabledReason: "default branch",
        },
        { label: "feat/new", value: "wt:feat/new" },
      ],
    },
    {
      title: "Branches",
      items: [
        { label: "fix/bug", value: "br:fix/bug" },
        {
          label: "gw_root",
          value: "br:gw_root",
          protected: true,
        },
      ],
    },
  ];
}

// ── Tests ───────────────────────────────────────────────────

Deno.test("multiSelect - returns empty on immediate enter", async () => {
  const keys = encodeKeys("enter");
  const { io } = createMockIO(keys);

  const result = await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
    },
    io,
  );

  assertEquals(result.cancelled, false);
  assertEquals(result.selected, []);
});

Deno.test("multiSelect - ctrl-c cancels", async () => {
  const keys = encodeKeys("ctrl-c");
  const { io } = createMockIO(keys);

  const result = await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
    },
    io,
  );

  assertEquals(result.cancelled, true);
  assertEquals(result.selected, []);
});

Deno.test("multiSelect - escape cancels", async () => {
  const keys = encodeKeys("escape");
  const { io } = createMockIO(keys);

  const result = await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
    },
    io,
  );

  assertEquals(result.cancelled, true);
});

Deno.test("multiSelect - space toggles item and enter confirms", async () => {
  // Cursor starts on first section header (Worktrees)
  // down -> first item (feat/old)
  // space -> select it
  // enter -> confirm
  const keys = encodeKeys("down", "space", "enter");
  const { io } = createMockIO(keys);

  const result = await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
    },
    io,
  );

  assertEquals(result.cancelled, false);
  assertEquals(result.selected, ["wt:feat/old"]);
});

Deno.test("multiSelect - disabled items are skipped by cursor", async () => {
  // Start on Worktrees header
  // down -> feat/old (index 0)
  // down -> feat/new (index 2, skips disabled main)
  // space -> select feat/new
  // enter -> confirm
  const keys = encodeKeys("down", "down", "space", "enter");
  const { io } = createMockIO(keys);

  const result = await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
    },
    io,
  );

  assertEquals(result.cancelled, false);
  assertEquals(result.selected, ["wt:feat/new"]);
});

Deno.test("multiSelect - space on section header toggles all items", async () => {
  // Cursor starts on Worktrees header
  // space -> select all in Worktrees (feat/old, feat/new; skip main)
  // enter -> confirm
  const keys = encodeKeys("space", "enter");
  const { io } = createMockIO(keys);

  const result = await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
    },
    io,
  );

  assertEquals(result.cancelled, false);
  assertEquals(result.selected, ["wt:feat/old", "wt:feat/new"]);
});

Deno.test("multiSelect - 'a' key toggles all in current section", async () => {
  // Navigate down to an item in Branches section
  // down -> feat/old
  // down -> feat/new
  // down -> separator (skipped)
  // down -> Branches header
  // down -> fix/bug
  // a -> select all in Branches
  // enter -> confirm
  const keys = encodeKeys("down", "down", "down", "down", "a", "enter");
  const { io } = createMockIO(keys);

  const result = await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
    },
    io,
  );

  assertEquals(result.cancelled, false);
  assertEquals(result.selected, ["br:fix/bug", "br:gw_root"]);
});

Deno.test("multiSelect - toggle all twice deselects all", async () => {
  // space -> select all in Worktrees
  // space -> deselect all in Worktrees
  // enter -> confirm (nothing selected)
  const keys = encodeKeys("space", "space", "enter");
  const { io } = createMockIO(keys);

  const result = await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
    },
    io,
  );

  assertEquals(result.cancelled, false);
  assertEquals(result.selected, []);
});

Deno.test("multiSelect - protected items can be selected", async () => {
  // Navigate to gw_root (protected)
  // down -> feat/old
  // down -> feat/new
  // down -> Branches header
  // down -> fix/bug
  // down -> gw_root
  // space -> select it
  // enter -> confirm
  const keys = encodeKeys(
    "down",
    "down",
    "down",
    "down",
    "down",
    "space",
    "enter",
  );
  const { io } = createMockIO(keys);

  const result = await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
    },
    io,
  );

  assertEquals(result.cancelled, false);
  assertEquals(result.selected, ["br:gw_root"]);
});

Deno.test("multiSelect - returns empty for empty sections", async () => {
  const result = await multiSelect(
    {
      message: "Test",
      sections: [],
    },
    createMockIO([]).io,
  );

  assertEquals(result.cancelled, false);
  assertEquals(result.selected, []);
});

Deno.test("multiSelect - throws for non-TTY environment", async () => {
  const io: TerminalIO = {
    read: () => Promise.resolve(null),
    write: () => {},
    setRaw: () => {},
    isTerminal: () => false,
  };

  let threw = false;
  try {
    await multiSelect({ message: "Test", sections: createTestSections() }, io);
  } catch (e) {
    threw = true;
    assertEquals((e as Error).message.includes("terminal"), true);
  }
  assertEquals(threw, true);
});

Deno.test("multiSelect - pre-selected items are included", async () => {
  const sections: SelectSection[] = [
    {
      title: "Items",
      items: [
        {
          label: "A",
          value: "a",
          selected: true,
        },
        { label: "B", value: "b" },
        {
          label: "C",
          value: "c",
          selected: true,
        },
      ],
    },
  ];

  // Just press enter to confirm pre-selections
  const keys = encodeKeys("enter");
  const { io } = createMockIO(keys);

  const result = await multiSelect({ message: "Test", sections }, io);

  assertEquals(result.selected, ["a", "c"]);
});

Deno.test("multiSelect - warning banner is rendered", async () => {
  const keys = encodeKeys("enter");
  const { io, output } = createMockIO(keys);

  await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
      warningBanner: "Danger zone!",
    },
    io,
  );

  const allOutput = output.join("");
  assertEquals(allOutput.includes("Danger zone!"), true);
});

Deno.test("multiSelect - multiple items across sections", async () => {
  // Select feat/old from Worktrees and fix/bug from Branches
  // down -> feat/old, space -> select
  // down -> feat/new (skip)
  // down -> Branches header
  // down -> fix/bug, space -> select
  // enter -> confirm
  const keys = encodeKeys(
    "down",
    "space",
    "down",
    "down",
    "down",
    "space",
    "enter",
  );
  const { io } = createMockIO(keys);

  const result = await multiSelect(
    {
      message: "Test",
      sections: createTestSections(),
    },
    io,
  );

  assertEquals(result.cancelled, false);
  assertEquals(result.selected, ["wt:feat/old", "br:fix/bug"]);
});
