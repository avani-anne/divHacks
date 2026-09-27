// Optional Google Street View panorama for the Map tab.

let googleMapsLoading = null;

function loadGoogleMaps() {
  if (window.google?.maps?.StreetViewPanorama) return Promise.resolve();
  if (!googleMapsLoading) {
    googleMapsLoading = new Promise((resolve, reject) => {
      window.gspStreetViewReady = resolve;
      const script = Object.assign(document.createElement('script'), {
        src: `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=gspStreetViewReady`,
        async: true,
        defer: true,
        onerror: reject,
      });
      document.head.append(script);
    });
  }
  return googleMapsLoading;
}

const StreetView = {
  active: false,
  panorama: null,

  async enable() {
    this.active = true;
    const message = $('#streetview-message');
    message.hidden = false;

    if (!GOOGLE_MAPS_API_KEY) {
      message.textContent = 'Add a restricted Google Maps Platform API key in js/config.js to enable Street View.';
      return;
    }

    message.textContent = 'Loading Street View…';
    try {
      await loadGoogleMaps();
    } catch {
      if (this.active) message.textContent = 'Could not load Google Street View. Check the API key and your connection.';
      return;
    }
    if (!this.active) return;

    if (!this.panorama) {
      this.panorama = new google.maps.StreetViewPanorama($('#streetview-panorama'), {
        pov: { heading: 0, pitch: 0 },
        addressControl: true,
        fullscreenControl: true,
        linksControl: true,
        motionTracking: false,
        motionTrackingControl: false,
      });
    }

    const center = map.getCenter();
    new google.maps.StreetViewService().getPanorama({
      location: { lat: center.lat, lng: center.lng },
      radius: 500,
    }, (data, status) => {
      if (!this.active) return;
      if (status === google.maps.StreetViewStatus.OK) {
        this.panorama.setPano(data.location.pano);
        this.panorama.setPosition(data.location.latLng);
        this.panorama.setVisible(true);
        message.hidden = true;
      } else {
        this.panorama.setVisible(false);
        message.textContent = 'No Street View imagery was found within 500 meters. Try another spot on the map.';
      }
    });
  },

  disable() {
    if (!this.active) return;
    this.active = false;
    if (this.panorama) {
      const position = this.panorama.getPosition();
      if (position) map.setView([position.lat(), position.lng()], Math.max(map.getZoom(), 16));
      this.panorama.setVisible(false);
    }
    $('#streetview-message').hidden = true;
    map.invalidateSize();
  },
};