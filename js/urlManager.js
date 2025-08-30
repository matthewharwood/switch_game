// URL management for room codes
export function getRoomCodeFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room')?.toUpperCase() || null;
}

export function setRoomCodeInURL(roomCode) {
  const url = new URL(window.location);
  if (roomCode) {
    url.searchParams.set('room', roomCode);
  } else {
    url.searchParams.delete('room');
  }
  window.history.replaceState({}, '', url);
}

export function getShareableURL(roomCode) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('room', roomCode);
  return url.toString();
}

export function clearRoomFromURL() {
  const url = new URL(window.location);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
}