# SHUBHAM FABRICS MES — FINISHING QUANTITY ACCOUNTING

## 1. Core Mathematical Invariant
At every finishing output recording event, the following equation must strictly balance:
$$\text{Input Quantity} = \text{Good Finished Garments} + \text{Rework Quantity} + \text{Reject Quantity} + \text{Balance Quantity (WIP)}$$

Where:
- $\text{Input Quantity}$: Received pieces confirmed during physical receipt.
- $\text{Good Finished Garments}$: Garments meeting all finishing specs (trimmed, clean, pressed).
- $\text{Rework Quantity}$: Garments with minor issues returning to table for touch-up.
- $\text{Reject Quantity}$: Permanently damaged garments quarantined as scrap.
- $\text{Balance Quantity}$: Unfinished garments remaining on the floor.

## 2. Downstream Handover Balance Invariant
$$\text{Outgoing Handover Quantity} \le \text{Total Good Finished Garments} - \sum \text{Previously Issued Downstream Quantity}$$

Over-issuance beyond the verified good balance is strictly blocked by the backend API.
