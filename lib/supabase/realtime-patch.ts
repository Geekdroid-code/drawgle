/**
 * Supabase Realtime UPDATE records are patches, not rows.
 *
 * Our tables use the default replica identity, so Postgres leaves large
 * (TOASTed) values that an UPDATE did not change out of the change stream,
 * and Realtime omits those columns from `payload.new`. Mapping such a record
 * as a whole row turns every omitted column into null: a charter-only update
 * erased the design tokens and every screen lost its styling until a refresh.
 *
 * Each mapped field names its source column. A field whose column is missing
 * from the record keeps the value the client already holds.
 */
export type FieldColumns<Data, Row> = { readonly [Field in keyof Data]-?: Extract<keyof Row, string> };

export function mergeRealtimeRecord<Row extends object, Data extends object>(
  current: Data,
  record: Partial<Row>,
  map: (row: Row) => Data,
  columns: FieldColumns<Data, Row>,
): Data {
  const next = map(record as Row);
  const merged = { ...next };
  for (const field of Object.keys(columns) as Array<keyof Data>) {
    if (!(columns[field] in record)) merged[field] = current[field];
  }
  return merged;
}

/** True for an INSERT, or an UPDATE that happened to carry every mapped column. */
export function isCompleteRecord<Row extends object, Data>(record: Partial<Row>, columns: FieldColumns<Data, Row>) {
  return Object.values<string>(columns).every((column) => column in record);
}
