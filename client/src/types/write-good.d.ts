declare module 'write-good' {
  export interface WriteGoodSuggestion {
    index: number;
    offset: number;
    reason: string;
    rule?: string;
  }
  function writeGood(text: string, options?: Record<string, unknown>): WriteGoodSuggestion[];
  export default writeGood;
}
