"use server";
import { revalidatePath } from "next/cache";

export async function approvePhoto() {
  const response = await fetch(`${process.env.API}/temp/approve-photos`, {
    method: "POST",
  });

  const res = await response.json();

  if (!response.ok) {
    // DON'T THROW — return normal JSON
    return { ok: false, message: res.message };
  }
  revalidatePath("/");
  revalidatePath("/employee-photos");
  return { ok: true, ...res };
}
