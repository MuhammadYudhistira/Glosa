export type SceneFocus = "overview" | "admin"
export type SceneState = { focus: SceneFocus; dim: boolean; blur: boolean }

const ADMIN_DESK_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]

export function sceneStateFor(pathname: string): SceneState | null {
  const path = pathname.replace(/\/+$/, "") || "/"
  if (path === "/") return { focus: "overview", dim: true, blur: false }
  if (ADMIN_DESK_PATHS.includes(path) || path.startsWith("/auth/")) {
    return { focus: "admin", dim: false, blur: false }
  }
  if (path === "/welcome") return { focus: "admin", dim: true, blur: true }
  return null
}
