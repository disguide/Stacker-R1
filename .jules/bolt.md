## 2025-04-05 - Initial Setup

## 2025-04-05 - FlashList requires getItemType for heterogeneous lists
**Learning:** Missing `getItemType` in a `FlashList` rendering different components (headers, tasks, footers) causes inefficient view recycling, undermining FlashList's performance benefits.
**Action:** Always specify `getItemType` on `FlashList` when the data array contains items of varying structures or types.
