import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useEffect } from "react"
import { LobbyPopup } from "@/components/lobby/LobbyPopup"
import { ShopPanel } from "@/components/lobby/ShopPanel"
import {
  buyItem,
  placeItem,
  previewItem,
  refreshShop,
  useShop,
} from "@/lib/shop/shop-client"

const lobi = getRouteApi("/_member/_lobi")

export const Route = createFileRoute("/_member/_lobi/shop")({
  head: () => ({ meta: [{ title: "Toko lobi — Glosa" }] }),
  component: ShopPage,
})

/** Toko lobi over the lobby (spec 3C §6.2). */
function ShopPage() {
  const { offline } = lobi.useLoaderData()
  const shop = useShop()
  // The newest balance on every visit; closing ends a preview (spec 3C §6.3).
  useEffect(() => {
    void refreshShop()
    return () => previewItem(null)
  }, [])
  return (
    <LobbyPopup label="Toko lobi" side>
      <ShopPanel
        view={shop}
        offline={offline}
        onRetry={() => void refreshShop()}
        onBuy={buyItem}
        onPlace={placeItem}
        onPreview={previewItem}
      />
    </LobbyPopup>
  )
}
