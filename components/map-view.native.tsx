import React, { forwardRef } from "react";
import { View } from "react-native";
import RNMapView, { Marker as RNMarker, Circle as RNCircle } from "react-native-maps";

interface MapProps {
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

export const MapView = forwardRef<any, MapProps>((props, ref) => {
  return <RNMapView ref={ref} {...props} />;
});

MapView.displayName = "MapView";

export const Marker = RNMarker;
export const Circle = RNCircle;
export const isMapAvailable = true;
