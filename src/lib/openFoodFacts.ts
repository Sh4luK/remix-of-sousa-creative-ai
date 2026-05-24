import { supabase } from "@/integrations/supabase/client";

export interface OFFProduct {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  imageUrl?: string;
}

const CATEGORY_MAP: [RegExp, string][] = [
  [/arroz/i, "arroz"],
  [/feij[aã]o/i, "feijao"],
  [/a[cç][uú]car/i, "acucar"],
  [/caf[eé]/i, "cafe"],
  [/[oó]leo/i, "oleo"],
  [/macarr[aã]o|massa|noodle/i, "macarrao"],
  [/biscoito|bolacha|cookie/i, "biscoitos"],
  [/refrigerante|soda|guaraná|coca.cola|pepsi/i, "refrigerantes"],
  [/[aá]gua/i, "agua"],
  [/cerveja|beer/i, "cervejas"],
  [/carne|beef|bov/i, "carnes"],
  [/frango|chicken|peru/i, "frango"],
  [/frios|salsicha|presunto|mortadela/i, "frios"],
  [/leite|milk/i, "leite"],
  [/detergente|sabão.lavar|dish/i, "detergente"],
  [/papel.higi[eê]nico|toilet/i, "papel-higienico"],
  [/sabão|sabao|laundry/i, "sabao"],
  [/copo.descart/i, "copos-descartaveis"],
  [/prato.descart/i, "pratos-descartaveis"],
  [/talher.descart/i, "talheres-descartaveis"],
  [/saco.lixo|garbage/i, "sacos-lixo"],
];

function inferCategory(name: string, categoryTags: string[]): string {
  const haystack = name + " " + categoryTags.join(" ");
  for (const [pattern, cat] of CATEGORY_MAP) {
    if (pattern.test(haystack)) return cat;
  }
  return "outros";
}

export async function searchOFF(query: string, limit = 8): Promise<OFFProduct[]> {
  if (query.trim().length < 2) return [];

  try {
    const { data, error } = await supabase.functions.invoke("search-off", {
      body: { q: query.trim(), limit },
    });

    if (error) return [];

    const rows = data as { barcode: string; name: string; brand: string; categoriesTags: string[]; imageUrl: string | null }[];

    return rows.map((p): OFFProduct => ({
      barcode: p.barcode,
      name: p.name,
      brand: p.brand,
      category: inferCategory(p.name, p.categoriesTags ?? []),
      imageUrl: p.imageUrl ?? undefined,
    }));
  } catch {
    return [];
  }
}
