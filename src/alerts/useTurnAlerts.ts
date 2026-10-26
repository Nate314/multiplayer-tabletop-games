import { useEffect, useRef } from 'react'
import { alertFor, alertText, tabTitle } from '../../shared/alerts.ts'
import type { GameInfo } from '../../shared/gameDefinition.ts'
import type { BasePublicState, Seat } from '../../shared/types.ts'
import usePreferences from '../hooks/usePreferences.ts'
import gameService from '../services/gameService.ts'
import { ALERTS_GRANTED, currentEnv, showAlert, subscribePush } from './support.ts'

const LANDING_TITLE = 'Multiplayer Tabletop Games'

// seats is this device's seats: one, a pass-and-play device's, or none for a spectator or table screen
export default function useTurnAlerts(info: GameInfo, gameState: BasePublicState, seats: Seat[]): void {
  const { notifications } = usePreferences()
  const roomId = `${info.id}/${gameState.gameId}`
  const seatsKey = seats.join(',')
  const title = tabTitle(info, gameState, seats)
  // Set once the server pushes for these seats, so the page does not show the same alert itself
  const pushed = useRef(false)
  const lastKeys = useRef<(string | null)[] | null>(null)

  useEffect(() => {
    document.title = title
    return () => { document.title = LANDING_TITLE }
  }, [title])

  // The service worker finds this tab by its ?game= address
  useEffect(() => {
    window.history.replaceState(null, '', '/?' + new URLSearchParams({ game: roomId }))
    return () => window.history.replaceState(null, '', '/')
  }, [roomId])

  // The server only refuses these from a spectator, so a device without seats sends nothing
  useEffect(() => {
    if (seatsKey === '') return
    const send = () => gameService.setVisible(document.visibilityState === 'visible')
    send()
    document.addEventListener('visibilitychange', send)
    return () => document.removeEventListener('visibilitychange', send)
  }, [seatsKey])

  // Rerun on a rematch too, since the server forgets the room's subscriptions when a new game begins
  useEffect(() => {
    pushed.current = false
    if (seatsKey === '') return
    if (!notifications) return void gameService.pushUnsubscribe()
    let live = true
    const subscribe = () => {
      if (currentEnv().permission !== 'granted') return
      subscribePush().then(endpoint => {
        if (!live || !endpoint) return
        gameService.pushSubscribe(endpoint)
        pushed.current = true
      })
    }
    subscribe()
    window.addEventListener(ALERTS_GRANTED, subscribe)
    return () => {
      live = false
      window.removeEventListener(ALERTS_GRANTED, subscribe)
    }
  }, [seatsKey, gameState.gameNumber, notifications])

  // Without push, a hidden page shows each new alert itself
  useEffect(() => {
    const alerts = seats.map(seat => alertFor(info, gameState, seat))
    const keys = alerts.map(alert => alert?.key ?? null)
    const before = lastKeys.current
    lastKeys.current = keys
    if (!before || before.length !== keys.length || document.visibilityState === 'visible' || !notifications
      || pushed.current || currentEnv().permission !== 'granted') return
    alerts.forEach((alert, index) => {
      if (!alert || alert.key === before[index]) return
      // Two or more seats is a shared device, which names the player, as the server's push does
      const name = seats.length > 1 ? gameState.playerNames[seats[index]] : undefined
      const { title: heading, body } = alertText(info, gameState, alert.kind, name)
      showAlert(heading, body, roomId)
    })
    // seats is read through seatsKey, so a new array of the same seats does not rerun this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, gameState, seatsKey, notifications, roomId])
}
