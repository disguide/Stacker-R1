## Bolt's Journal
## 2024-03-01 - FlashList `getItemType` Property
**Learning:** Found a codebase-specific performance pattern: When using `FlashList` with mixed components like Headers, Tasks, and Footers, adding `getItemType` to `FlashList` components enables highly efficient view recycling based on the returned item type. If missing, `FlashList` will struggle to determine when to recycle components and thus lose its performance benefits, leading to frame drops during scrolling.
**Action:** When creating or optimizing a `FlashList` rendering varying item types, always explicitly pass a `getItemType={(item) => item.type}` prop to enable proper view recycling.
