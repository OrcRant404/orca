import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { EyeOff } from 'lucide-react-native'
import { colors, feedback, radii, typography } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'

export function MobileHiddenTabsButton({
  count,
  pending,
  onPress
}: {
  count: number
  pending: boolean
  onPress: () => void
}) {
  useMobileColorScheme()
  const t = useMobileTranslation()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('session.hidden.title', 'Hidden tabs')}
      accessibilityHint={count ? String(count) : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {pending ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <EyeOff size={18} color={colors.textMuted} />
      )}
      {count > 0 && (
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.count}>{count}</Text>
        </View>
      )}
    </Pressable>
  )
}
const styles = themedStyleSheet(() => ({
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: feedback.pressedOpacity },
  badge: {
    position: 'absolute',
    right: 1,
    top: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.bgRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  count: { fontSize: typography.metaSize, color: colors.textSecondary }
}))
