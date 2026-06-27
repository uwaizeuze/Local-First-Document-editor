import { api } from "@/lib/axios";
import { RegisterFormValues } from "@/schemas/auth.schema";

export const authService = {
  register: async (payload: RegisterFormValues) => {
    const { data } = await api.post("/auth/register", payload);

    return data;
  },
};
