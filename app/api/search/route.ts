import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

// Static Orama search: the index is built at compile time and served as a
// static JSON payload, so search works with zero server state. The client
// (RootProvider `search.options.type === "static"`) downloads this index.
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source);
