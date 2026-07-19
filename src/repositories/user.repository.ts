import { db } from "@/lib/db";

export const UserRepository = {
  async findById(id: string) {
    const { data, error } = await db
      .from("User")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByEmail(email: string) {
    const { data, error } = await db
      .from("User")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByUsername(username: string) {
    const { data, error } = await db
      .from("User")
      .select("*")
      .eq("username", username.trim().toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(data: {
    id: string;
    name: string;
    username: string;
    email: string;
    passwordHash: string;
    image?: string | null;
  }) {
    const { data: created, error } = await db
      .from("User")
      .insert({
        ...data,
        username: data.username.trim().toLowerCase(),
      })
      .select()
      .single();

    if (error) throw error;
    return created;
  },

  async update(id: string, data: any) {
    const { data: updated, error } = await db
      .from("User")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  },

  async delete(id: string) {
    const { error } = await db
      .from("User")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },
};
