import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (lat: number, lng: number) => void;
};

/**
 * Dialog para escolher localização tocando no mapa (Leaflet + OpenStreetMap).
 * Carrega o CSS do Leaflet sob demanda.
 */
export function MapPickerDialog({ open, onOpenChange, initialLat, initialLng, onConfirm }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    const ensureCss = () => {
      if (document.getElementById("leaflet-css")) return;
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    };
    ensureCss();

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      // Fix default icon paths via CDN
      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      const center: [number, number] =
        initialLat != null && initialLng != null
          ? [initialLat, initialLng]
          : [-23.55, -46.633]; // São Paulo default

      const map = L.map(containerRef.current).setView(center, initialLat != null ? 15 : 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (initialLat != null && initialLng != null) {
        markerRef.current = L.marker([initialLat, initialLng], { icon, draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const ll = markerRef.current.getLatLng();
          setPos({ lat: ll.lat, lng: ll.lng });
        });
      }

      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const ll = markerRef.current.getLatLng();
            setPos({ lat: ll.lat, lng: ll.lng });
          });
        }
        setPos({ lat, lng });
      });

      mapRef.current = map;
      setLoading(false);
      // Force resize after dialog animation
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [open, initialLat, initialLng]);

  const useCurrent = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((p) => {
      const lat = p.coords.latitude;
      const lng = p.coords.longitude;
      setPos({ lat, lng });
      if (mapRef.current) {
        mapRef.current.setView([lat, lng], 16);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 sm:p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Escolher no mapa</DialogTitle>
          <DialogDescription className="text-xs">
            Toque no mapa para marcar o local. Você pode arrastar o pin para ajustar.
          </DialogDescription>
        </DialogHeader>
        <div className="relative h-[55vh] w-full bg-muted">
          {loading && (
            <div className="absolute inset-0 z-[400] flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          <div ref={containerRef} className="h-full w-full" />
        </div>
        <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {pos ? (
              <span className="font-mono">{pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}</span>
            ) : (
              <span>Toque no mapa para marcar</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={useCurrent}>
              📍 Minha localização
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!pos}
              onClick={() => {
                if (pos) {
                  onConfirm(pos.lat, pos.lng);
                  onOpenChange(false);
                }
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
