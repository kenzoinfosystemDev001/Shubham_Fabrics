# Column mapping

## Worksheet and header row

- **Worksheet:** every sheet is read at upload, up to the configured limits. When exactly one
  non-empty sheet has a recognizable header, it is preselected. Otherwise the user chooses one; the
  first sheet is never assumed.
- **Header row:** the header row is the row among the first 20 that names the most distinct fields,
  with at least two required. Title rows and blank rows above it are allowed. The user can choose a
  different row.

## Automatic mapping is exact

Headers are normalized before matching:
- Unicode NFKC is applied and zero-width characters are removed.
- Text is lower-cased.
- Bracketed hints such as `(Mtr)` are dropped, `&` becomes `and`, and punctuation becomes spaces.

A column is mapped automatically only when its normalized header equals the field's label, or one
of its known names, exactly. There is no similarity scoring, so "Fabric Composition Details" does
not map to anything.

| Field | Recognized headers (besides the label) |
|---|---|
| Fabric Name | fabric, item name, item, material name, material, fabric description, quality, quality name |
| Fabric Type | type, stock type, entry type, dyed undyed, kora dyed |
| Colour | color, colour name, color name, fabric colour, fabric color |
| Shade | shade no, shade number, shade code, colour code, color code |
| Composition | content, fibre content, fiber content, blend |
| Width | fabric width, width inches, width inch, panna |
| Quantity | qty, received qty, received quantity, bill qty, bill quantity, meters, metres, mtrs, pieces, pcs |
| Unit | uom, unit of measure, unit of measurement, units |
| Roll Number | roll no, roll id, roll, roll code, than no, than number, than |
| Batch / Lot | batch, batch no, batch number, lot, lot no, lot number |
| Supplier Name | supplier, vendor, vendor name, mill, mill name, party, party name |
| Bill / Invoice No | bill no, bill number, invoice no, invoice number, invoice, bill, supplier invoice, supplier invoice no |
| Bill Date | invoice date, date of bill, date of invoice |
| Received Date | receiving date, receipt date, date received, inward date, grn date |
| PO Number | po, po no, purchase order, purchase order no, purchase order number |
| Unit Rate | rate, rate per unit, unit price, price |
| Storage Location | location, rack, rack no, bin, store location |
| Remarks | remark, notes, note, comments |

## Ambiguity and user control

- When two columns match the same field (for example "Qty" and "Quantity"), neither is mapped and
  the user is told which columns conflict.
- The mapping screen shows, for every field, the chosen column and why it was chosen: either "Header
  matches ... exactly" or "Chosen by you".
- A mapping is applied straight after upload only when it is complete and unambiguous. Otherwise the
  wizard opens on the mapping step.
- The server re-checks every mapping: the field must exist, the column must exist, no column may be
  mapped to two fields, and every required field must be mapped.
- Changing the worksheet or the header row clears row corrections, because those belong to one
  layout.
