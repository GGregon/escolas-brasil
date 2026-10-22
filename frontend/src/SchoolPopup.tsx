import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Popup, type Map } from 'maplibre-gl'

/** Mantém os controles React dentro de um popup ancorado no ponto do mapa. */
export function SchoolPopup({ map, coordinates, onClose, children }: {
  map: Map; coordinates: [number, number]; onClose: () => void; children: ReactNode
}) {
  const [container] = useState(() => document.createElement('div'))
  const close = useRef(onClose)
  close.current = onClose
  const [lon, lat] = coordinates

  useEffect(() => {
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 18, maxWidth: '340px', className: 'school-popup', focusAfterOpen: false })
      .setLngLat([lon, lat]).setDOMContent(container).addTo(map)
    const handleClose = () => close.current()
    popup.on('close', handleClose)
    return () => { popup.off('close', handleClose); popup.remove() }
  }, [map, container, lon, lat])

  return createPortal(children, container)
}
