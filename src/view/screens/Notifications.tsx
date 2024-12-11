import React from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect, useIsFocused} from '@react-navigation/native'
import {useQueryClient} from '@tanstack/react-query'

import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {ComposeIcon2} from '#/lib/icons'
import {
  NativeStackScreenProps,
  NotificationsTabNavigatorParams,
} from '#/lib/routes/types'
import {s} from '#/lib/styles'
import {logger} from '#/logger'
import {isNative, isWeb} from '#/platform/detection'
import {emitSoftReset, listenSoftReset} from '#/state/events'
import {RQKEY as NOTIFS_RQKEY} from '#/state/queries/notifications/feed'
import {
  useUnreadNotifications,
  useUnreadNotificationsApi,
} from '#/state/queries/notifications/unread'
import {truncateAndInvalidate} from '#/state/queries/util'
import {useSetMinimalShellMode} from '#/state/shell'
import {useComposerControls} from '#/state/shell/composer'
import {NotificationFeed} from '#/view/com/notifications/NotificationFeed'
import {Pager} from '#/view/com/pager/Pager'
import {TabBar} from '#/view/com/pager/TabBar'
import {FAB} from '#/view/com/util/fab/FAB'
import {ListMethods} from '#/view/com/util/List'
import {LoadLatestBtn} from '#/view/com/util/load-latest/LoadLatestBtn'
import {MainScrollProvider} from '#/view/com/util/MainScrollProvider'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {web} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {SettingsGear2_Stroke2_Corner0_Rounded as SettingsIcon} from '#/components/icons/SettingsGear2'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'

type Props = NativeStackScreenProps<
  NotificationsTabNavigatorParams,
  'Notifications'
>
export function NotificationsScreen({}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const {gtTablet} = useBreakpoints()
  const {openComposer} = useComposerControls()
  const unreadNotifs = useUnreadNotifications()
  const hasNew = !!unreadNotifs
  const {checkUnread: checkUnreadAll} = useUnreadNotificationsApi()
  const [isLoadingAll, setIsLoadingAll] = React.useState(false)
  const [isLoadingConversations, setIsLoadingConversations] =
    React.useState(false)
  const [activeTab, setActiveTab] = React.useState(0)
  const isLoading = activeTab === 0 ? isLoadingAll : isLoadingConversations

  const onPageSelected = React.useCallback(
    (index: number) => {
      setActiveTab(index)
    },
    [setActiveTab],
  )

  const queryClient = useQueryClient()
  const checkUnreadConversations = React.useCallback(
    async ({invalidate}: {invalidate: boolean}) => {
      if (invalidate) {
        return truncateAndInvalidate(queryClient, NOTIFS_RQKEY('mentions'))
      } else {
        // TODO
      }
    },
    [queryClient],
  )

  const sections = React.useMemo(() => {
    return [
      {
        title: _(msg`All`),
        component: (
          <NotificationsTab
            filter="all"
            hasNew={hasNew}
            setIsLoadingLatest={setIsLoadingAll}
            checkUnread={checkUnreadAll}
          />
        ),
      },
      {
        title: _(msg`Mentions`),
        component: (
          <NotificationsTab
            filter="mentions"
            hasNew={hasNew}
            setIsLoadingLatest={setIsLoadingConversations}
            checkUnread={checkUnreadConversations}
          />
        ),
      },
    ]
  }, [_, hasNew, checkUnreadAll, checkUnreadConversations])

  return (
    <Layout.Screen testID="notificationsScreen">
      <Layout.Header.Outer>
        <Layout.Header.MenuButton />
        <Layout.Header.Content>
          <Button
            label={_(msg`Notifications`)}
            accessibilityHint={_(msg`Refresh notifications`)}
            onPress={emitSoftReset}
            style={[a.justify_start]}>
            {({hovered}) => (
              <Layout.Header.TitleText
                style={[a.w_full, hovered && a.underline]}>
                <Trans>Notifications</Trans>
                {isWeb && gtTablet && hasNew && (
                  <View
                    style={[
                      a.rounded_full,
                      {
                        width: 8,
                        height: 8,
                        bottom: 3,
                        left: 6,
                        backgroundColor: t.palette.primary_500,
                      },
                    ]}
                  />
                )}
              </Layout.Header.TitleText>
            )}
          </Button>
        </Layout.Header.Content>
        <Layout.Header.Slot>
          <Link
            to="/notifications/settings"
            label={_(msg`Notification settings`)}
            size="small"
            variant="ghost"
            color="secondary"
            shape="round"
            style={[a.justify_center]}>
            <ButtonIcon icon={isLoading ? Loader : SettingsIcon} size="lg" />
          </Link>
        </Layout.Header.Slot>
      </Layout.Header.Outer>
      <Pager
        onPageSelected={onPageSelected}
        renderTabBar={props => (
          <Layout.Center style={web([a.sticky, a.z_10, {top: 0}])}>
            <TabBar items={sections.map(section => section.title)} {...props} />
          </Layout.Center>
        )}
        initialPage={0}>
        {sections.map((section, i) => (
          <View key={i}>{section.component}</View>
        ))}
      </Pager>
      <FAB
        testID="composeFAB"
        onPress={() => openComposer({})}
        icon={<ComposeIcon2 strokeWidth={1.5} size={29} style={s.white} />}
        accessibilityRole="button"
        accessibilityLabel={_(msg`New post`)}
        accessibilityHint=""
      />
    </Layout.Screen>
  )
}

function NotificationsTab({
  filter,
  hasNew,
  checkUnread,
  setIsLoadingLatest,
}: {
  filter: 'all' | 'mentions'
  hasNew: boolean
  checkUnread: ({invalidate}: {invalidate: boolean}) => Promise<void>
  setIsLoadingLatest: (v: boolean) => void
}) {
  const {_} = useLingui()
  const setMinimalShellMode = useSetMinimalShellMode()
  const [isScrolledDown, setIsScrolledDown] = React.useState(false)
  const scrollElRef = React.useRef<ListMethods>(null)
  const queryClient = useQueryClient()
  const isScreenFocused = useIsFocused()

  // event handlers
  // =
  const scrollToTop = React.useCallback(() => {
    scrollElRef.current?.scrollToOffset({animated: isNative, offset: 0})
    setMinimalShellMode(false)
  }, [scrollElRef, setMinimalShellMode])

  const onPressLoadLatest = React.useCallback(() => {
    scrollToTop()
    if (hasNew) {
      // render what we have now
      truncateAndInvalidate(queryClient, NOTIFS_RQKEY(filter))
    } else {
      // check with the server
      setIsLoadingLatest(true)
      checkUnread({invalidate: true})
        .catch(() => undefined)
        .then(() => setIsLoadingLatest(false))
    }
  }, [
    scrollToTop,
    queryClient,
    checkUnread,
    hasNew,
    setIsLoadingLatest,
    filter,
  ])

  const onFocusCheckLatest = useNonReactiveCallback(() => {
    // on focus, check for latest, but only invalidate if the user
    // isnt scrolled down to avoid moving content underneath them
    let currentIsScrolledDown
    if (isNative) {
      currentIsScrolledDown = isScrolledDown
    } else {
      // On the web, this isn't always updated in time so
      // we're just going to look it up synchronously.
      currentIsScrolledDown = window.scrollY > 200
    }
    checkUnread({invalidate: !currentIsScrolledDown})
  })

  // on-visible setup
  // =
  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
      logger.debug('NotificationsScreen: Focus')
      onFocusCheckLatest()
    }, [setMinimalShellMode, onFocusCheckLatest]),
  )
  React.useEffect(() => {
    if (!isScreenFocused) {
      return
    }
    return listenSoftReset(onPressLoadLatest)
  }, [onPressLoadLatest, isScreenFocused])

  return (
    <>
      <MainScrollProvider>
        <NotificationFeed
          filter={filter}
          refreshNotifications={() => checkUnread({invalidate: true})}
          onScrolledDownChange={setIsScrolledDown}
          scrollElRef={scrollElRef}
        />
      </MainScrollProvider>
      {(isScrolledDown || hasNew) && (
        <LoadLatestBtn
          onPress={onPressLoadLatest}
          label={_(msg`Load new notifications`)}
          showIndicator={hasNew}
        />
      )}
    </>
  )
}
