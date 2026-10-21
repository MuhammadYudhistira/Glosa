import { createClient } from "@supabase/supabase-js"
import { expect, type Page } from "@playwright/test"
import { requireEnv } from "./env"

export type TestMember = {
  email: string
  username: string
  name: string
  password: string
}

/** Every E2E email contains "e2e-" so global teardown can find and delete it. */
export const E2E_MARKER = "e2e-"

/**
 * Emails also carry the run's id (set in playwright.config.ts), so a run's
 * teardown can tell its own members from those of a run still going on in
 * another CI job.
 */
export function runMarker(): string {
  const run = process.env.E2E_RUN
  if (!run) throw new Error("E2E_RUN is not set: run through playwright test")
  return `${E2E_MARKER}${run}-`
}

export function admin() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}

export function newMember(emailFor?: (id: string) => string): TestMember {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  return {
    email: emailFor
      ? emailFor(`${runMarker()}${id}`)
      : `${runMarker()}${id}@glosa.test`,
    username: `e2e_${id}`.slice(0, 20),
    name: "Anggota Uji",
    password: "rahasia-123",
  }
}

/** A confirmed member created directly through the admin API (no email sent). */
export async function createConfirmedMember(
  member = newMember()
): Promise<TestMember> {
  const { error } = await admin().auth.admin.createUser({
    email: member.email,
    password: member.password,
    email_confirm: true,
    user_metadata: { username: member.username, display_name: member.name },
  })
  if (error) throw error
  return member
}

/** Registers an unconfirmed member and returns their confirmation link path (no email sent). */
export async function signupConfirmPath(member: TestMember): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "signup",
    email: member.email,
    password: member.password,
    options: { data: { username: member.username, display_name: member.name } },
  })
  if (error) throw error
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup`
}

export async function recoveryPath(email: string): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "recovery",
    email,
  })
  if (error) throw error
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery`
}

/** Waits until React has hydrated, so typing and submitting go through the app's handlers. */
export async function hydrated(page: Page) {
  await page.waitForLoadState("networkidle")
}

export async function signIn(
  page: Page,
  member: TestMember,
  password = member.password
) {
  await page.goto("/login")
  await hydrated(page)
  await page.getByLabel("Email").fill(member.email)
  await page.getByLabel("Kata sandi", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Tanda tangan & masuk" }).click()
}

export async function userIdOf(email: string): Promise<string> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin().auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw error
    const user = data.users.find((candidate) => candidate.email === email)
    if (user) return user.id
    if (data.users.length < 1000) throw new Error(`No user with email ${email}`)
  }
}

export async function signInAndOnboard(page: Page, member: TestMember) {
  await signIn(page, member)
  await expect(page).toHaveURL(/\/welcome$/)
  await hydrated(page)
  await page.getByRole("button", { name: /Masuk ke perpustakaan/ }).click()
  await expect(page).toHaveURL(/\/lobby$/)
}
