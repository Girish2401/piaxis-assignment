export interface Detail {
  id: number;
  title: string;
  category: string;
  tags: string[];
  description: string;
}

export interface UsageRule {
  detail_id: number;
  host_element: string;
  adjacent_element: string;
  exposure: string;
}

export const details: Detail[] = [
  {
    id: 1,
    title: "External Wall – Slab Junction Waterproofing",
    category: "Wall",
    tags: ["wall", "slab", "waterproofing", "external"],
    description: "Waterproof membrane continuity at external wall and slab junction",
  },
  {
    id: 2,
    title: "Window Sill Detail with Drip",
    category: "Window",
    tags: ["window", "sill", "drip", "external"],
    description: "External window sill detail with drip groove",
  },
  {
    id: 3,
    title: "Internal Wall – Floor Junction",
    category: "Wall",
    tags: ["wall", "floor", "internal"],
    description: "Junction detail between internal wall and finished floor",
  },
];

export const usageRules: UsageRule[] = [
  { detail_id: 1, host_element: "External Wall", adjacent_element: "Slab", exposure: "External" },
  { detail_id: 2, host_element: "Window", adjacent_element: "External Wall", exposure: "External" },
  { detail_id: 3, host_element: "Internal Wall", adjacent_element: "Floor", exposure: "Internal" },
];
