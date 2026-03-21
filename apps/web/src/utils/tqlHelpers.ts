/** TQL detection regex — matches field:value patterns like `status:done` or `-priority:high` */
const TQL_PATTERN = /(?:^|\s)(?:NOT\s+)?-?[a-zA-Z]+[:><=]/;

/** Returns true if the input string looks like a TQL query */
export function isTQLQuery(input: string): boolean {
  return TQL_PATTERN.test(input);
}
