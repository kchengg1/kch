import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Local, append-only record of everything the agent did (events.jsonl) plus
 * the notes it leaves for its next run (notes.jsonl) — its only memory.
 */
export class Journal {
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  event(type: string, data: Record<string, unknown>) {
    const line = JSON.stringify({ at: new Date().toISOString(), type, ...data });
    appendFileSync(join(this.dir, "events.jsonl"), line + "\n");
  }

  addNote(runId: string, note: string) {
    appendFileSync(
      join(this.dir, "notes.jsonl"),
      JSON.stringify({ at: new Date().toISOString(), runId, note }) + "\n",
    );
  }

  recentNotes(limit = 15): { at: string; note: string }[] {
    return this.readJsonl<{ at: string; note: string }>("notes.jsonl").slice(-limit);
  }

  recentEvents(type: string, limit = 20) {
    return this.readJsonl<{ at: string; type: string } & Record<string, unknown>>("events.jsonl")
      .filter((e) => e.type === type)
      .slice(-limit);
  }

  private readJsonl<T>(file: string): T[] {
    const path = join(this.dir, file);
    if (!existsSync(path)) return [];
    return readFileSync(path, "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as T];
        } catch {
          return [];
        }
      });
  }
}
