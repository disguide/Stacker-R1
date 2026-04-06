## 2024-03-24 - Initial
## 2024-11-09 - Missing getItemType on FlashList
**Learning:** When using `@shopify/flash-list` with multiple item types in the list data (e.g., headers, footers, rows), failing to provide the `getItemType` prop prevents FlashList from efficiently recycling views. It will attempt to reuse the view hierarchy of a row item for a header, or vice versa, causing heavy re-renders and poor scroll performance.
**Action:** Always provide `getItemType={(item) => item.type}` or similar on `FlashList` instances that display heterogeneous lists, allowing proper view recycling per-type.
