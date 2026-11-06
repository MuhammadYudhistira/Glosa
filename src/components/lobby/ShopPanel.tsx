import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ActionResult } from "@/lib/action-result"
import { bookMessage } from "@/lib/book-messages"
import {
  SHOP_ITEMS,
  SLOTS,
  type ShopItem,
  type SlotId,
} from "@/lib/shop/catalog"
import type { ShopView } from "@/lib/shop/types"

const OFFLINE_NOTE = "Perlu koneksi internet"
const coins = (n: number) => `${n.toLocaleString("id-ID")} koin`

/** The lobby shop (spec 3C §6.2): the balance, then six slots of items. */
export function ShopPanel({
  view,
  offline,
  onRetry,
  onBuy,
  onPlace,
  onPreview,
}: {
  view: ShopView
  offline: boolean
  onRetry: () => void
  onBuy: (itemId: string) => Promise<ActionResult>
  onPlace: (slot: SlotId, itemId: string | null) => Promise<ActionResult>
  onPreview: (itemId: string | null) => void
}) {
  const [asking, setAsking] = useState<ShopItem | null>(null)
  const [busy, setBusy] = useState(false)
  // One message at a time, kept with the item that was acted on.
  const [error, setError] = useState<{ itemId: string; text: string } | null>(
    null
  )
  const { state } = view

  if (!state) {
    return (
      <div className="shop-panel">
        <h1 className="font-heading text-2xl">Toko lobi</h1>
        {view.status === "failed" ? (
          <>
            <p className="text-sm">Toko lobi belum bisa dimuat.</p>
            <Button disabled={offline} onClick={onRetry}>
              Coba lagi
            </Button>
            {offline && <p className="text-sm">{OFFLINE_NOTE}</p>}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        )}
      </div>
    )
  }

  async function act(itemId: string, run: () => Promise<ActionResult>) {
    setError(null)
    setBusy(true)
    try {
      const result = await run()
      if (!result.ok) setError({ itemId, text: bookMessage(result.code) })
    } finally {
      setBusy(false)
    }
  }

  const locked = offline || busy
  return (
    <div className="shop-panel">
      <header className="shop-head">
        <h1 className="font-heading text-2xl">Toko lobi</h1>
        <p className="shop-balance">{coins(state.balance)}</p>
        <p className="text-sm text-muted-foreground">
          1 koin per menit baca, +50 per buku selesai (dibaca minimal 1 jam)
        </p>
        {state.balance === 0 && state.owned.length === 0 && (
          <p className="text-sm">Baca untuk mendapat koin</p>
        )}
        {offline && <p className="text-sm">{OFFLINE_NOTE}</p>}
      </header>
      {SLOTS.map((slot) => (
        <section key={slot.id} aria-label={slot.name} className="shop-slot">
          <h2 className="font-heading text-lg">{slot.name}</h2>
          <ul className="shop-items">
            {SHOP_ITEMS.filter((item) => item.slot === slot.id).map((item) => {
              const owned = state.owned.includes(item.id)
              const placed = state.placed[slot.id] === item.id
              const short = item.price - state.balance
              return (
                <li key={item.id} aria-label={item.name} className="shop-item">
                  <img
                    src={`/lobby/shop/${item.id}.webp`}
                    alt=""
                    width={480}
                    height={360}
                    loading="lazy"
                    className="shop-thumb"
                  />
                  <div className="shop-item-body">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {coins(item.price)}
                    </p>
                    <div className="shop-actions">
                      {placed ? (
                        <>
                          <span className="text-sm">Terpasang</span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={locked}
                            onClick={() =>
                              void act(item.id, () => onPlace(slot.id, null))
                            }
                          >
                            Lepas
                          </Button>
                        </>
                      ) : owned ? (
                        <Button
                          size="sm"
                          disabled={locked}
                          onClick={() =>
                            void act(item.id, () => onPlace(slot.id, item.id))
                          }
                        >
                          Pasang
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={locked || short > 0}
                            onClick={() => setAsking(item)}
                          >
                            Beli
                          </Button>
                          {short > 0 && (
                            <span className="text-sm text-muted-foreground">
                              Kurang {coins(short)}
                            </span>
                          )}
                        </>
                      )}
                      {!placed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hidden lg:inline-flex"
                          aria-pressed={view.preview === item.id}
                          onClick={() =>
                            onPreview(view.preview === item.id ? null : item.id)
                          }
                        >
                          Lihat di lobi
                        </Button>
                      )}
                    </div>
                    {error?.itemId === item.id && (
                      <p role="alert" className="text-sm">
                        {error.text}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <Dialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) setAsking(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              Beli barang
            </DialogTitle>
            <DialogDescription>
              {asking && `Beli ${asking.name} seharga ${coins(asking.price)}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsking(null)}>
              Batal
            </Button>
            <Button
              disabled={locked}
              onClick={() => {
                const item = asking
                setAsking(null)
                if (item) void act(item.id, () => onBuy(item.id))
              }}
            >
              Beli
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
