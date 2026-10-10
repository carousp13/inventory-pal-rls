import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type Customer = Tables<"customers">;
export type Member = Tables<"company_members">;
export type Sale = Tables<"sales"> & {
  customers: { name: string } | null;
  sale_items: { quantity: number; unit_price: number; product_id: string | null; products: { name: string } | null }[];
};
export type Role = "master" | "admin" | "operator";

export const roleLabel: Record<Role, string> = { master: "Master", admin: "Administrador", operator: "Operador" };

/** Who am I: my company membership + platform master flag. */
export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) throw new Error("Não autenticado");
    const [{ data: member, error: e1 }, { data: master, error: e2 }, { data: cid, error: e3 }] = await Promise.all([
      supabase.from("company_members").select("*").eq("user_id", uid).maybeSingle(),
      supabase.rpc("is_master"),
      supabase.rpc("current_company_id"),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;
    const isMaster = !!master;
    const role: Role | null = isMaster ? "master" : ((member?.role as Role | undefined) ?? null);
    let companyName: string | null = null;
    if (cid) {
      const { data: c } = await supabase.from("companies").select("name").eq("id", cid).maybeSingle();
      companyName = c?.name ?? null;
    }
    return {
      userId: uid,
      isMaster,
      role,
      companyId: (cid as string | null) ?? null,
      companyName,
      canManageTeam: isMaster || member?.role === "admin",
    };
  },
});

async function myCompany() {
  const { data, error } = await supabase.rpc("current_company_id");
  if (error) throw error;
  if (!data) throw new Error("Sua conta não está ligada a uma empresa.");
  return data;
}

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const cid = await myCompany();
    const { data, error } = await supabase.from("products").select("*").eq("company_id", cid).order("name");
    if (error) throw error;
    return data;
  },
});

export const customersQuery = queryOptions({
  queryKey: ["customers"],
  queryFn: async () => {
    const cid = await myCompany();
    const { data, error } = await supabase.from("customers").select("*").eq("company_id", cid).order("name");
    if (error) throw error;
    return data;
  },
});

export const salesQuery = queryOptions({
  queryKey: ["sales"],
  queryFn: async () => {
    const cid = await myCompany();
    const { data, error } = await supabase
      .from("sales")
      .select("*, customers(name), sale_items(quantity, unit_price, product_id, products(name))")
      .eq("company_id", cid)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data as unknown as Sale[];
  },
});

export const membersQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["members", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_members").select("*").eq("company_id", companyId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const companiesQuery = queryOptions({
  queryKey: ["companies"],
  queryFn: async () => {
    const { data, error } = await supabase.from("companies").select("id, name, created_at, company_members(count)").order("name");
    if (error) throw error;
    return data as unknown as { id: string; name: string; created_at: string; company_members: { count: number }[] }[];
  },
});
