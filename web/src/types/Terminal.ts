/** One terminal line to complete (content/terminal.json, feat/terminal-loop). */
export interface TerminalTask {
  /** What the line should do, in French. */
  goal: string;
  /** One line of code containing exactly one "____" blank. */
  code: string;
  /** Candidate fillers (displayed shuffled). */
  choices: string[];
  /** Index of the right filler in `choices`. */
  answer: number;
}
