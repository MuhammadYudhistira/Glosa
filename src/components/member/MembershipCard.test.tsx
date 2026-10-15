import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { SessionUser } from "@/lib/session-types"
import { MembershipCard } from "./MembershipCard"

const member: SessionUser = {
  id: "u1",
  email: "yudhis@contoh.com",
  provider: "email",
  username: "yudhis",
  displayName: "Yudhis",
  memberNo: 342,
  plan: "free",
  storageLimitBytes: 104857600,
  memberSince: "2026-10-15T03:00:00Z",
  onboarded: false,
}

describe("MembershipCard", () => {
  it("shows the member details printed on the card", () => {
    render(<MembershipCard member={member} />)
    const card = screen.getByRole("figure", { name: "Kartu anggota Glosa" })
    expect(card).toHaveTextContent("Yudhis")
    expect(card).toHaveTextContent("@yudhis")
    expect(card).toHaveTextContent("000342")
    expect(card).toHaveTextContent("Okt 2026")
    expect(card).toHaveTextContent("GRATIS · 100 MB")
  })

  it("never prints the email address", () => {
    render(<MembershipCard member={member} />)
    expect(screen.queryByText(/yudhis@contoh\.com/)).toBeNull()
  })
})
