import React, { forwardRef, useEffect, useRef, useImperativeHandle, useCallback } from "react";
import { View } from "react-native";

// ---- Leaflet Web Map ----
// Uses OpenStreetMap tiles via Leaflet loaded from CDN.
// No API key required.

let leafletLoaded = false;
let leafletLoadPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (leafletLoaded) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Not in browser"));
      return;
    }

    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.onload = () => {
      leafletLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Leaflet"));
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

interface MapViewProps {
  style?: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  children?: React.ReactNode;
}

export const MapView = forwardRef<any, MapViewProps>(({ style, initialRegion, children }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration?: number) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([region.latitude, region.longitude], getZoomFromDelta(region.latitudeDelta), {
          duration: (duration || 500) / 1000,
        });
      }
    },
  }));

  const getZoomFromDelta = (delta: number) => {
    return Math.round(Math.log2(360 / delta));
  };

  useEffect(() => {
    let mounted = true;

    loadLeaflet().then(() => {
      if (!mounted || !containerRef.current) return;
      const L = (window as any).L;
      if (!L || mapInstanceRef.current) return;

      const lat = initialRegion?.latitude ?? 48.8566;
      const lng = initialRegion?.longitude ?? 2.3522;
      const zoom = initialRegion ? getZoomFromDelta(initialRegion.latitudeDelta) : 14;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], zoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Add small attribution in bottom-right
      L.control.attribution({ position: "bottomright", prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>')
        .addTo(map);

      mapInstanceRef.current = map;

      // Force a resize after mount to fix tile rendering
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);
    });

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map center when initialRegion changes
  useEffect(() => {
    if (mapInstanceRef.current && initialRegion) {
      mapInstanceRef.current.setView(
        [initialRegion.latitude, initialRegion.longitude],
        getZoomFromDelta(initialRegion.latitudeDelta)
      );
    }
  }, [initialRegion?.latitude, initialRegion?.longitude]);

  return (
    <View style={[{ position: "relative" }, style]}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "inherit",
          zIndex: 0,
        }}
      />
      {/* Render children (overlay buttons, status badges) on top of the map */}
      <LeafletMarkerManager mapRef={mapInstanceRef} markersRef={markersRef} circlesRef={circlesRef}>
        {children}
      </LeafletMarkerManager>
    </View>
  );
});

MapView.displayName = "MapView";

// ---- Marker Manager: Reads Marker/Circle children and renders them on the Leaflet map ----

function LeafletMarkerManager({
  mapRef,
  markersRef,
  circlesRef,
  children,
}: {
  mapRef: React.MutableRefObject<any>;
  markersRef: React.MutableRefObject<any[]>;
  circlesRef: React.MutableRefObject<any[]>;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    // Clear previous markers and circles
    markersRef.current.forEach((m) => m.remove());
    circlesRef.current.forEach((c) => c.remove());
    markersRef.current = [];
    circlesRef.current = [];

    // Extract marker/circle data from children
    const processChildren = (nodes: React.ReactNode) => {
      React.Children.forEach(nodes, (child) => {
        if (!React.isValidElement(child)) return;

        const props = child.props as any;

        if ((child.type as any)?._leafletType === "marker" && props.coordinate) {
          const icon = L.divIcon({
            className: "custom-marker",
            html: `<div style="
              width: 14px; height: 14px; border-radius: 50%;
              background: ${props.pinColor || "#F59E0B"};
              border: 2.5px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            "></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          const marker = L.marker([props.coordinate.latitude, props.coordinate.longitude], { icon }).addTo(map);

          if (props.title) {
            let popupContent = `<strong>${props.title}</strong>`;
            if (props.description) popupContent += `<br/><span style="font-size:11px;color:#666">${props.description}</span>`;
            marker.bindPopup(popupContent, { closeButton: false, offset: [0, -5] });
          }

          markersRef.current.push(marker);
        }

        if ((child.type as any)?._leafletType === "circle" && props.center) {
          const circle = L.circle([props.center.latitude, props.center.longitude], {
            radius: props.radius || 50,
            fillColor: props.fillColor || "rgba(124,58,237,0.12)",
            fillOpacity: 0.4,
            color: props.strokeColor || "rgba(124,58,237,0.4)",
            weight: props.strokeWidth || 1,
          }).addTo(map);

          circlesRef.current.push(circle);
        }

        // Process fragments and nested children
        if (props.children) {
          processChildren(props.children);
        }
      });
    };

    processChildren(children);
  }, [children, mapRef, markersRef, circlesRef]);

  return null;
}

// ---- Marker & Circle components (data carriers for LeafletMarkerManager) ----

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string;
}

export const Marker: React.FC<MarkerProps> & { _leafletType?: string } = (_props) => null;
Marker._leafletType = "marker";

interface CircleProps {
  center: { latitude: number; longitude: number };
  radius?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export const Circle: React.FC<CircleProps> & { _leafletType?: string } = (_props) => null;
Circle._leafletType = "circle";

export const isMapAvailable = true;
