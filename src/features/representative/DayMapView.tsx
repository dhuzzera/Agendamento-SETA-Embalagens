import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Calendar as CalIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type MapAppt = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  city: string | null;
  state: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  client_name: string;
  client_company: string | null;
};

export function DayMapView() {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["day-map", profile?.id, selectedDate],
    enabled: !!profile?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: appts } = await supabase
        .from("appointments")
        .select(
          "id, appointment_date, start_time, end_time, city, state, location, latitude, longitude, client_id",
        )
        .eq("representative_id", profile!.id)
        .eq("appointment_date", selectedDate)
        .eq("meeting_type", "presencial")
        .in("status", ["scheduled", "rescheduled"])
        .order("start_time");

      if (!appts?.length) return [];

      const clientIds = [...new Set(appts.map((a) => a.client_id))];
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, company")
        .in("id", clientIds);

      const clientMap = new Map(
        (clients ?? []).map((c) => [c.id, { name: c.name, company: c.company }]),
      );

      return appts.map((a) => ({
        id: a.id,
        appointment_date: a.appointment_date,
        start_time: a.start_time,
        end_time: a.end_time,
        city: a.city,
        state: a.state,
        location: a.location,
        latitude: a.latitude,
        longitude: a.longitude,
        client_name: clientMap.get(a.client_id)?.name ?? "—",
        client_company: clientMap.get(a.client_id)?.company ?? null,
      }));
    },
  });

  const withCoords = useMemo(
    () => (appointments ?? []).filter((a) => a.latitude != null && a.longitude != null),
    [appointments],
  );

  const center = useMemo(() => {
    if (withCoords.length === 0) return null;
    const lat = withCoords.reduce((s, a) => s + a.latitude!, 0) / withCoords.length;
    const lng = withCoords.reduce((s, a) => s + a.longitude!, 0) / withCoords.length;
    return { lat, lng };
  }, [withCoords]);

  const openGoogleMapsRoute = () => {
    if (!appointments?.length) return;
    const stops = appointments
      .map((a) => {
        if (a.latitude != null && a.longitude != null)
          return `${a.latitude},${a.longitude}`;
        return [a.location, a.city, a.state].filter(Boolean).join(", ");
      })
      .filter(Boolean);

    if (stops.length === 0) return;

    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1);

    const originParts = [
      profile?.address,
      profile?.address_number ? `nº ${profile.address_number}` : "",
      profile?.city,
      profile?.state,
    ]
      .filter(Boolean)
      .join(", ");

    const params = new URLSearchParams({
      api: "1",
      travelmode: "driving",
      destination,
    });
    if (originParts) params.set("origin", originParts);
    if (waypoints.length) params.set("waypoints", waypoints.join("|"));

    window.open(
      `https://www.google.com/maps/dir/?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-primary" />
          Mapa de visitas do dia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Data</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44"
            />
          </div>
          {appointments && appointments.length > 0 && (
            <Button size="sm" onClick={openGoogleMapsRoute}>
              <Navigation className="mr-1.5 h-3.5 w-3.5" />
              Rota no Google Maps ({appointments.length})
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-lg border bg-muted/30">
            <p className="text-sm text-muted-foreground">Carregando…</p>
          </div>
        ) : !appointments?.length ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30">
            <CalIcon className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhuma visita presencial neste dia.
            </p>
          </div>
        ) : (
          <>
            {/* Map */}
            {center && withCoords.length > 0 && <LeafletMap appointments={withCoords} center={center} />}

            {/* List */}
            <div className="divide-y rounded-lg border">
              {appointments.map((a, i) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 p-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.client_name}</span>
                      {a.client_company && (
                        <span className="text-xs text-muted-foreground">
                          • {a.client_company}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}
                      {a.city && ` • ${a.city}${a.state ? ` - ${a.state}` : ""}`}
                    </div>
                    {a.location && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        📍 {a.location}
                      </p>
                    )}
                  </div>
                  {a.latitude != null && a.longitude != null && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      Mapa
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LeafletMap({
  appointments,
  center,
}: {
  appointments: MapAppt[];
  center: { lat: number; lng: number };
}) {
  const [mapReady, setMapReady] = useState(false);
  const mapId = "day-map-" + appointments[0]?.appointment_date;

  useEffect(() => {
    // Dynamically import Leaflet to avoid SSR issues
    let cancelled = false;
    const loadMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled) return;
      setMapReady(true);

      // Wait for DOM
      await new Promise((r) => setTimeout(r, 50));

      const container = document.getElementById(mapId);
      if (!container) return;

      // Clean up existing map
      if ((container as HTMLElement & { _leaflet_id?: number })._leaflet_id) {
        (container as HTMLElement & { _leaflet_id?: number })._leaflet_id = undefined;
        container.innerHTML = "";
      }

      const map = L.map(container).setView([center.lat, center.lng], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);

      const bounds = L.latLngBounds([]);

      appointments.forEach((a, i) => {
        if (a.latitude == null || a.longitude == null) return;
        const marker = L.marker([a.latitude, a.longitude]).addTo(map);
        marker.bindPopup(
          `<b>${i + 1}. ${a.client_name}</b><br/>${a.start_time.slice(0, 5)} – ${a.end_time.slice(0, 5)}<br/>${a.location ?? ""}`,
        );
        bounds.extend([a.latitude, a.longitude]);
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }

      // Draw route line
      if (appointments.length > 1) {
        const coords = appointments
          .filter((a) => a.latitude != null && a.longitude != null)
          .map((a) => [a.latitude!, a.longitude!] as [number, number]);
        L.polyline(coords, {
          color: "#1a3264",
          weight: 3,
          opacity: 0.7,
          dashArray: "8, 8",
        }).addTo(map);
      }
    };

    void loadMap();
    return () => { cancelled = true; };
  }, [appointments, center, mapId]);

  return (
    <div
      id={mapId}
      className="h-72 w-full rounded-lg border sm:h-80"
      style={{ zIndex: 0 }}
    />
  );
}
