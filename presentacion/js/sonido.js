// Ganchos de efectos de sonido. La presentación en vivo no reproduce audio: estos eventos los
// escucha el grabador de vídeo (video/grabar.mjs) para sincronizar los efectos con cada animación.
window.sfx = function (name, detail = {}) {
  window.dispatchEvent(new CustomEvent('sfx', { detail: { name, ...detail } }))
}
