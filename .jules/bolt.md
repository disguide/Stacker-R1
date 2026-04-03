## 2024-03-24 - FlashList getItemType for Heterogeneous Lists
**Learning:** When using `FlashList` with different types of items (e.g., headers, footers, tasks), omitting the `getItemType` prop forces FlashList to attempt recycling incompatible view hierarchies, leading to performance degradation, visual glitches, and unnecessary re-renders.
**Action:** Always provide the `getItemType` prop when `FlashList` contains multiple distinct item types to allow efficient and correct view recycling.
