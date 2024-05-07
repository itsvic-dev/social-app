import React from 'react'
import {AppState} from 'react-native'
import {BskyAgent} from '@atproto-labs/api'

import {MessagesEventBus} from '#/state/messages/events/agent'
import {MessagesEventBusState} from '#/state/messages/events/types'
import {useAgent} from '#/state/session'
import {useDmServiceUrlStorage} from '#/screens/Messages/Temp/useDmServiceUrlStorage'

const MessagesEventBusContext =
  React.createContext<MessagesEventBusState | null>(null)

export function useMessagesEventBus() {
  const ctx = React.useContext(MessagesEventBusContext)
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return ctx
}

export function MessagesEventBusProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const {serviceUrl} = useDmServiceUrlStorage()
  const {getAgent} = useAgent()
  const [bus] = React.useState(
    () =>
      new MessagesEventBus({
        agent: new BskyAgent({
          service: serviceUrl,
        }),
        __tempFromUserDid: getAgent().session?.did!,
      }),
  )
  const service = React.useSyncExternalStore(bus.subscribe, bus.getSnapshot)

  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        bus.resume()
      } else {
        bus.suspend()
      }
    }

    const sub = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      sub.remove()
    }
  }, [bus])

  return (
    <MessagesEventBusContext.Provider value={service}>
      {children}
    </MessagesEventBusContext.Provider>
  )
}
