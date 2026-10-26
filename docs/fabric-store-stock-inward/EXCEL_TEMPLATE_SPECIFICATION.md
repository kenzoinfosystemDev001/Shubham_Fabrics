# Excel template specification

`GET /api/fabric-store/stock-imports/template` generates the template on every request from the
field list in `lib/fabric-stock-import/columns.mjs`. That is the same list the server maps and
validates against, so the template cannot drift from the backend. A test re-reads the generated
template and checks that every column maps to its field.

## Sheets

1. **Instructions**: required and optional fields, units, dates, quantities, how fabric is
   identified, rolls and duplicates, formulas, what is never invented, how to submit, and limits.
2. **Fabric Stock Inward**: one header row with the field labels (required fields marked `*`), frozen.
   - Drop-down lists for Fabric Type (UNDYED, DYED) and Unit (MTR, PCS).
   - Dates formatted `dd-mm-yyyy`.
   - Bill, roll, batch, PO and shade columns formatted as text, so leading zeros survive.
3. **Field Reference**: each column with whether it is required, its rule, an example and the other
   header names that are recognized.
4. **Fabrics in Stock**: fabric names already received in Fabric Store, which are the names to use.

## Columns

| Column | Required | Stored in `FabricInward` | Rule |
|---|---|---|---|
| Fabric Name | yes | `itemName` (the stocked name) | Must equal a fabric already in stock, or be resolved (mapped or accepted as new) |
| Fabric Type | yes | `entryType` | UNDYED (Kora, Grey, Greige, Raw) or DYED |
| Colour | no | `colour` | Stock is kept per colour |
| Shade | no | `shade` | Free text |
| Composition | no | `composition` | Free text |
| Width | no | `width` | Free text with its unit, for example `58 in` |
| Quantity | yes | `billQty` | > 0, <= 100000, at most 3 decimal places, dot for decimals |
| Unit | yes | `unit` | MTR or PCS |
| Roll Number | no | `rollNumber`, `rollKey` | Unique per supplier |
| Batch / Lot | no | `batchNumber` | Free text |
| Supplier Name | if a roll number is given | `supplierName` | Free text (no supplier master exists) |
| Bill / Invoice No | yes | `billNo` | Free text |
| Bill Date | yes | `billDate` | Excel date or DD-MM-YYYY |
| Received Date | yes | `receivingDate` | Excel date or DD-MM-YYYY, not in the future |
| PO Number | no | `purchaseOrderNumber` | Free text |
| Unit Rate | no | `unitRate` | >= 0, at most 3 decimal places |
| Storage Location | no | `storageLocation` | Free text rack or bin (no location master) |
| Remarks | no | `remarks` (plus the receipt reference) | <= 500 characters |

## Not in the template, and why

- **Fabric code:** no fabric code exists in the live model (the Fabric master is empty).
- **Warehouse:** there is a single Fabric Store and no warehouse model.
- **KG and yards:** Fabric Store stock is kept in MTR and PCS only, so other units are rejected
  rather than converted.
