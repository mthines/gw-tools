export function validateType(value: unknown, typeToValidate: string): boolean {
  return typeof value === typeToValidate;
}
