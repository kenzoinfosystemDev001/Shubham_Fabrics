# Validation rules

Validation runs on the server (`rows.mjs` with context from `service.ts`) after mapping, after every
correction or fabric decision, on explicit revalidation, and again inside the posting transaction.
The browser only displays the results.

## Policy

- **All or nothing:** an import can be confirmed only when it has at least one postable row, no row
  has an error, and there is no file-level error.
- **Warnings** do not block posting, but the confirmation must include `acknowledgeWarnings: true`.
- **No silent fixes:** values are never rounded, defaulted or guessed. A value that cannot be read
  exactly is an error on its row.
- **Corrections** apply to the import only (stored per row and field). The uploaded file is never
  changed, and the correction is audited.

## Row errors

| Rule | Message (abridged) |
|---|---|
| Fabric Name present, <= 120 characters | Fabric Name is required |
| Fabric is in stock, mapped, or accepted as new | "X" has never been received in Fabric Store... |
| Fabric Type is UNDYED or DYED (with aliases) | must be UNDYED (Kora) or DYED |
| Quantity is a number | "abc" is not a number |
| Quantity is not negative | cannot be negative (-95) |
| Quantity is greater than zero | must be greater than zero |
| Quantity has a dot decimal | uses a comma for decimals |
| Quantity has at most 3 decimal places | more than 3 decimal places |
| Quantity is at most 100000 | above the limit |
| Unit is MTR or PCS | Unit "KG" is not supported... MTR or PCS only |
| Bill / Invoice No present | required |
| Bill Date and Received Date are real calendar dates | not a real date |
| Received Date is not in the future (factory day, Asia/Kolkata) | in the future |
| Supplier Name is present when a Roll Number is given | required when a Roll Number is given |
| Roll is not repeated in the file (supplier + roll number) | also appears on row N |
| Roll is not already in stock (supplier + roll number) | already in Fabric Store stock. It is not added again or overwritten |
| Formula cell has a saved result | is a formula with no saved value |
| Cell is not an Excel error such as `#REF!` | contains the Excel error |
| Text fields are within length limits | longer than ... characters |
| Unit Rate, when given, is a number >= 0 with at most 3 decimals | (same quantity rules) |

## Warnings

- Supplier and bill already have stock received against them. This may be a further delivery on the
  same bill.
- The same fabric, colour, unit, quantity, bill, roll and batch appears on an earlier row.
- Bill Date is after Received Date.

## File-level error

- The exact same file content (SHA-256) was already posted. Its receipt number is shown and the import
  cannot be confirmed. A new file name does not get around this check.

## Quantities and units

- Totals are kept per unit and per fabric, type, colour and unit.
- MTR and PCS are never added together: 100 MTR and 25 PCS display as `100 MTR · 25 PCS`.
- **Blank rows:** rows where every mapped cell is empty are skipped and not counted.
