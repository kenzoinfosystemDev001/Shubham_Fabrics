# Packing & Inventory Updation — API Contract Reference

## Shubham Fabrics MES | REST Endpoints Specification

---

## 1. Authentication & Security
All packing endpoints require authentication via:
- Bearer token in `Authorization: Bearer <token>`
- Or `subham_mes_token` HTTP cookie
- Floor terminal fallback supported for authorized operator terminals.

---

## 2. API Endpoints

### 2.1 GET `/api/packing/dashboard`
Returns live operational metrics, incoming challans, recent cartons, and finished goods stock snapshot.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "awaitingInwardCount": 2,
      "awaitingInwardPcs": 450,
      "readyToPackCount": 3,
      "readyToPackPcs": 820,
      "inProgressCount": 1,
      "inProgressPcs": 150,
      "completedCount": 12,
      "completedPcs": 3500,
      "totalCartonsCount": 48,
      "totalFgStockPcs": 3500
    },
    "incomingChallans": [...],
    "recentCartons": [...],
    "fgStockBalances": [...]
  }
}
```

---

### 2.2 GET `/api/packing/incoming`
Query incoming Challans issued to the Packing department.

**Query Parameters**:
- `status`: Filter by status (`ALL`, `ISSUED`, `RECEIVED`, `IN_PROCESS`, `COMPLETED`, `ON_HOLD`)
- `search`: Case-insensitive search on challan number, program number, style code, or buyer.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "clz...",
      "challanNumber": "CH-FINAL-1234",
      "fromDepartment": "FINAL_CHECK",
      "toDepartment": "PACKING",
      "status": "ISSUED",
      "items": [
        { "size": "L", "quantity": 100, "uom": "PCS" }
      ],
      "program": {
        "programNumber": "PRG-2026-001",
        "styleCode": "STYLE-A1"
      }
    }
  ]
}
```

---

### 2.3 POST `/api/packing/challans/:id/receive`
Acknowledges physical receipt of garments from Final QC.

**Request Body**:
```json
{
  "receivedQuantity": 100,
  "remarks": "Verified 100 pcs in good condition",
  "markOnHold": false
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Challan CH-FINAL-1234 received successfully.",
  "data": {
    "id": "clz...",
    "status": "RECEIVED",
    "receivedAt": "2026-10-23T10:00:00.000Z"
  }
}
```

---

### 2.4 GET `/api/packing/queue`
Lists active jobs on the floor ready for carton packing.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "clz...",
      "challanNumber": "CH-FINAL-1234",
      "totalReceivedPieces": 100,
      "totalPackedPieces": 40,
      "remainingPieces": 60,
      "cartonCount": 1,
      "status": "IN_PROCESS"
    }
  ]
}
```

---

### 2.5 GET `/api/packing/jobs/:id`
Retrieves single job details including linked program, items, existing cartons, and audit events.

---

### 2.6 POST `/api/packing/jobs/:id/pack`
**Core Atomic Transaction**: Packs garments into a physical carton and commits to Finished Goods stock.

**Request Body**:
```json
{
  "packingQuantity": 50,
  "size": "L",
  "colour": "Navy Blue",
  "locationRack": "FG-A1",
  "locationShelf": "S1",
  "grossWeightKg": 15.5,
  "netWeightKg": 14.2,
  "remarks": "Carton 1 of 2"
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Packed 50 pieces into carton CTN-CH-FINAL-1234-1 successfully.",
  "data": {
    "carton": {
      "id": "clz...",
      "cartonNumber": "CTN-CH-FINAL-1234-1",
      "quantity": 50,
      "size": "L",
      "barcode": "CTN-CH-FINAL-1234-1"
    },
    "stockBalance": {
      "identifier": "STYLE-A1-L-NAVY-BLUE",
      "currentQuantity": 50
    },
    "remainingPieces": 10,
    "isCompleted": false
  }
}
```

---

### 2.7 GET `/api/packing/inventory`
Finished Goods Warehouse explorer.

**Query Parameters**:
- `search`: Filter SKU or carton barcode
- `status`: Carton status (`ALL`, `IN_FG_STORE`, `DISPATCHED`)

**Response `200 OK`**:
Returns `stockBalances`, `cartons`, and `ledgerEntries`.

---

### 2.8 GET `/api/packing/reports`
Shift and period analytics.

**Query Parameters**:
- `days`: Number of days to analyze (default: 30)

**Response `200 OK`**:
Returns `summary`, `styleBreakdown`, `sizeBreakdown`, and `recentCartons`.
